const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const semver = require('semver');
const Logger = require('../utils/logger');

class IDEManager {
  constructor() {
    this.logger = new Logger('IDE');
    this.supportedIDEs = {
      cursor: {
        name: 'Cursor',
        commands: {
          listExtensions: '--list-extensions --show-versions',
          installExtension: '--install-extension',
          version: '--version'
        },
        envVar: 'CURSOR_PATH',
        priority: 1
      },
      vscode: {
        name: 'VS Code',
        commands: {
          listExtensions: '--list-extensions --show-versions',
          installExtension: '--install-extension',
          version: '--version'
        },
        envVar: 'VSCODE_PATH',
        priority: 2
      },
      windsurf: {
        name: 'Windsurf',
        commands: {
          listExtensions: '--list-extensions --show-versions',
          installExtension: '--install-extension',
          version: '--version'
        },
        envVar: 'WINDSURF_PATH',
        priority: 3
      },
      antigravity: {
        name: 'Antigravity',
        commands: {
          listExtensions: '--list-extensions --show-versions',
          installExtension: '--install-extension',
          version: '--version'
        },
        envVar: 'ANTIGRAVITY_PATH',
        priority: 4
      }
    };

    this.macPaths = {
      cursor: '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
      vscode: '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      windsurf: '/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf',
      antigravity: `${process.env.HOME}/.antigravity/antigravity/bin/antigravity`
    };

    // Windows paths for CLI executables
    this.windowsPaths = {
      cursor: [
        `${process.env.LOCALAPPDATA}\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd`,
        `${process.env.LOCALAPPDATA}\\cursor\\Cursor.exe`
      ],
      vscode: [
        `${process.env.LOCALAPPDATA}\\Programs\\Microsoft VS Code\\bin\\code.cmd`,
        'C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd'
      ],
      windsurf: [
        `${process.env.LOCALAPPDATA}\\Programs\\Windsurf\\resources\\app\\bin\\windsurf.cmd`,
        `${process.env.LOCALAPPDATA}\\windsurf\\Windsurf.exe`
      ],
      antigravity: [
        `${process.env.LOCALAPPDATA}\\Programs\\Antigravity\\resources\\app\\bin\\antigravity.cmd`
      ]
    };

    this.detectedIDEs = [];
  }

  detectAvailableIDEs() {
    this.logger.info('Detecting available IDEs...');
    const available = [];

    for (const [ide, config] of Object.entries(this.supportedIDEs)) {
      try {
        let command = process.env[config.envVar] || ide;
        let detected = false;

        try {
          execSync(`${command} ${config.commands.version}`, {
            stdio: 'ignore',
            timeout: 10000,
            env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
          });
          detected = true;
        } catch (cliError) {
          if (process.platform === 'darwin' && this.macPaths[ide]) {
            if (fs.existsSync(this.macPaths[ide])) {
              command = `"${this.macPaths[ide]}"`;
              detected = true;
              this.logger.success(`${config.name} detected at ${this.macPaths[ide]}`);
            }
          }
        }

        if (!detected) {
          const extensionPath = this.getExtensionPath(ide);
          if (extensionPath && fs.existsSync(extensionPath)) {
            detected = true;
            this.logger.success(`${config.name} detected via folder structure`);
          }
        }

        if (detected) {
          available.push({ ide, config, command, priority: config.priority });
          this.logger.success(`${config.name} detected`);
        }
      } catch (error) {
        this.logger.warn(`${config.name} detection failed: ${error.message}`);
      }
    }

    available.sort((a, b) => a.priority - b.priority);
    this.detectedIDEs = available;

    if (available.length > 0) {
      this.logger.info(`Found ${available.length} IDE(s): ${available.map(ide => ide.config.name).join(', ')}`);
    }

    return available;
  }

  getExtensionPath(ide) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const paths = {
      cursor: path.join(homeDir, '.cursor', 'extensions'),
      vscode: path.join(homeDir, '.vscode', 'extensions'),
      windsurf: path.join(homeDir, '.windsurf', 'extensions'),
      antigravity: path.join(homeDir, '.antigravity', 'extensions')
    };
    return paths[ide];
  }

  /**
   * Extract version from extension folder name
   * Handles formats like:
   * - augment.vscode-augment-0.691.0
   * - augment.vscode-augment-0.658.0-universal
   * - augment.vscode-augment-0.654.1-universal
   */
  extractVersionFromFolderName(folderName, extensionId) {
    const prefix = `${extensionId}-`;
    if (!folderName.startsWith(prefix)) {
      return null;
    }

    // Remove the prefix to get "0.691.0" or "0.658.0-universal"
    const remainder = folderName.slice(prefix.length);

    // Extract version using regex - matches semver at the start
    // Handles: 0.691.0, 0.658.0-universal, 0.654.1-darwin-arm64, etc.
    const versionMatch = remainder.match(/^(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      return versionMatch[1];
    }

    return null;
  }

  async getExtensionVersionFromDir(extensionDir, extensionId) {
    try {
      if (fs.existsSync(extensionDir)) {
        const extensions = fs.readdirSync(extensionDir);
        const prefix = `${extensionId}-`;
        const matchingFolders = extensions.filter(folder => folder.startsWith(prefix));

        if (matchingFolders.length > 0) {
          const versions = matchingFolders
            .map(folder => this.extractVersionFromFolderName(folder, extensionId))
            .filter(v => v && semver.valid(v))
            .sort((a, b) => semver.rcompare(a, b));

          if (versions.length > 0) {
            this.logger.info(`Found ${matchingFolders.length} extension folder(s), highest version: ${versions[0]}`);
            return versions[0];
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Error reading extension directory: ${error.message}`);
    }
    return null;
  }

  async scanForExtension(extensionId) {
    const results = [];

    for (const { ide, config, command } of this.detectedIDEs) {
      let version = null;
      let detectionMethod = null;

      try {
        // Primary method: Check extension directory (most reliable)
        const extensionDir = this.getExtensionPath(ide);
        if (extensionDir) {
          version = await this.getExtensionVersionFromDir(extensionDir, extensionId);
          if (version) {
            detectionMethod = 'directory';
          }
        }

        // Fallback: Try CLI if directory scan failed
        // Note: CLI can sometimes report stale versions, so we prefer directory
        if (!version && command) {
          try {
            const output = execSync(`${command} ${config.commands.listExtensions}`, {
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
              timeout: 15000
            });

            // All supported IDEs use --show-versions now, try version extraction
            const versionMatch = output.match(new RegExp(`${extensionId.replace(/\./g, '\\.')}@(\\d+\\.\\d+\\.\\d+)`));
            if (versionMatch) {
              const cliVersion = versionMatch[1];
              // If we already have a version from directory, compare and use the higher one
              // (CLI sometimes caches old version info)
              if (version) {
                if (semver.gt(cliVersion, version)) {
                  this.logger.warn(`CLI reports newer version ${cliVersion} than directory ${version} - using CLI version`);
                  version = cliVersion;
                  detectionMethod = 'cli';
                }
              } else {
                version = cliVersion;
                detectionMethod = 'cli';
              }
            } else if (output.includes(extensionId) && !version) {
              // Extension is listed but we couldn't get version
              version = 'Installed (unknown version)';
              detectionMethod = 'cli-noversion';
            }
          } catch (cliError) {
            this.logger.warn(`CLI check failed for ${config.name}: ${cliError.message}`);
          }
        }

        if (version && semver.valid(version)) {
          this.logger.success(`Found ${extensionId} in ${config.name}: ${version} (via ${detectionMethod})`);
        } else if (version) {
          this.logger.info(`Found ${extensionId} in ${config.name}: ${version}`);
        }
      } catch (error) {
        this.logger.warn(`${config.name} check failed: ${error.message}`);
      }

      results.push({ ide, config, command, version });
    }

    return results;
  }

  async installExtension(target, vsixPath, isDryRun = false) {
    const { config, command } = target;
    this.logger.info(`Installing extension in ${config.name}...`);

    if (isDryRun) {
      this.logger.warn(`DRY RUN: Would install in ${config.name}`);
      return true;
    }

    try {
      execSync(`${command} ${config.commands.installExtension} "${vsixPath}"`, {
        stdio: 'inherit',
        timeout: 60000,
        env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
      });
      this.logger.success(`Installed in ${config.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to install in ${config.name}: ${error.message}`);
      return false;
    }
  }
}

module.exports = IDEManager;

