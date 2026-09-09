#!/usr/bin/env node

const { execSync } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const semver = require('semver');
const chalk = require('chalk');

const IDEManager = require('./src/managers/ide-manager');
const CLIManager = require('./src/managers/cli-manager');
const Logger = require('./src/utils/logger');
const NotificationManager = require('./src/utils/notifications');

class AICodeUpdater {
  constructor() {
    this.isDryRun = process.argv.includes('--dry-run');
    this.isCronMode = !process.stdout.isTTY;
    this.tempDir = path.join(__dirname, 'temp');

    // Extension configuration
    this.extensionId = 'augment.vscode-augment';
    this.publisherId = 'augment';
    this.extensionName = 'vscode-augment';

    // Initialize managers
    this.ideManager = new IDEManager();
    this.cliManager = new CLIManager();
    this.logger = new Logger();
    this.notifications = new NotificationManager(this.isDryRun);

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async getLatestMarketplaceVersion() {
    try {
      this.logger.info('Fetching latest Augment version from VS Code Marketplace...');

      const response = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json;api-version=3.0-preview.1',
          'User-Agent': 'ai-code-updater/2.0.0'
        },
        body: JSON.stringify({
          filters: [{
            criteria: [{ filterType: 7, value: this.extensionId }],
            pageNumber: 1,
            pageSize: 1,
            sortBy: 0,
            sortOrder: 0
          }],
          assetTypes: [],
          flags: 0x200
        })
      });

      if (!response.ok) {
        throw new Error(`API failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.results?.[0]?.extensions?.[0]?.versions?.[0]) {
        throw new Error('No extension found');
      }

      const version = data.results[0].extensions[0].versions[0].version;
      this.logger.info(`Latest Augment version: ${version}`);
      return version;
    } catch (error) {
      this.logger.warn(`Marketplace API failed: ${error.message}, trying fallback...`);
      return this.getVersionFallback();
    }
  }

  async getVersionFallback() {
      const response = await fetch(`https://marketplace.visualstudio.com/items?itemName=${this.extensionId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
      });

    if (!response.ok) throw new Error(`Fallback failed: ${response.status}`);

      const html = await response.text();
    const patterns = [/"version":"([^"]+)"/, /Version\s+([0-9]+\.[0-9]+\.[0-9]+)/i];

    for (const pattern of patterns) {
        const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }

    throw new Error('Could not find version');
  }

  async downloadVsix(version) {
    this.logger.info(`Downloading VSIX for Augment v${version}...`);

    if (this.isDryRun) {
      this.logger.warn('DRY RUN: Would download VSIX');
      return path.join(this.tempDir, `${this.extensionId}-${version}.vsix`);
    }

    const url = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${this.publisherId}/vsextensions/${this.extensionName}/${version}/vspackage`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/octet-stream',
            'User-Agent': 'VSCode/1.85.0'
          },
          timeout: 60000
        });

        if (!response.ok) throw new Error(`Status: ${response.status}`);

        const buffer = await response.buffer();
        if (buffer.length === 0) throw new Error('Empty file');

        const filePath = path.join(this.tempDir, `${this.extensionId}-${version}.vsix`);
        fs.writeFileSync(filePath, buffer);

        this.logger.success(`Downloaded (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        return filePath;
    } catch (error) {
        this.logger.error(`Attempt ${attempt} failed: ${error.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }

    throw new Error('Download failed after 3 attempts');
  }

  cleanupFile(filePath) {
    try {
      if (!this.isDryRun && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.success(`Cleaned up: ${path.basename(filePath)}`);
      }
    } catch (error) {
      this.logger.warn(`Cleanup failed: ${error.message}`);
    }
  }

  async showMainMenu() {
    console.log('\n' + chalk.cyan.bold('🚀 AI Code Tools Updater'));
    console.log(chalk.gray('═'.repeat(60)));
    console.log(chalk.white('Manage updates for your AI coding tools\n'));

    const options = [
      { key: '1', label: 'Check & Update Augment Extension (VS Code/Cursor)', action: 'augment' },
      { key: '2', label: 'Check & Update Claude Code CLI', action: 'claude' },
      { key: '3', label: 'Check & Update Gemini CLI', action: 'gemini' },
      { key: '4', label: 'Check & Update OpenAI Codex CLI', action: 'codex' },
      { key: '5', label: 'Check & Update ALL tools', action: 'all' },
      { key: '6', label: 'Show status of all tools', action: 'status' },
      { key: 'q', label: 'Quit', action: 'quit' }
    ];

    options.forEach(opt => {
      const keyStyle = chalk.bold.cyan(opt.key);
      console.log(`  ${keyStyle})  ${opt.label}`);
    });

    console.log('');

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question(chalk.bold('Enter choice: '), (answer) => {
        rl.close();
        const choice = answer.toLowerCase().trim();
        const selected = options.find(o => o.key === choice);
        resolve(selected?.action || null);
      });
    });
  }

  async showStatus() {
    console.log('\n' + chalk.cyan.bold('📊 AI Tools Status'));
    console.log(chalk.gray('─'.repeat(60)));

    // Augment Extension Status
    console.log(chalk.bold('\n🔌 Augment Extension (VS Code/Cursor)'));
    try {
      this.ideManager.detectAvailableIDEs();
      const ideStatus = await this.ideManager.scanForExtension(this.extensionId);
      const latestAugment = await this.getLatestMarketplaceVersion();

      ideStatus.forEach(status => {
        const current = status.version || 'Not installed';
        const needsUpdate = !status.version || semver.gt(latestAugment, status.version);
        const statusIcon = needsUpdate ? chalk.yellow('⚠️') : chalk.green('✓');
        console.log(`  ${statusIcon} ${status.config.name.padEnd(12)} ${chalk.white(current.padEnd(15))} ${needsUpdate ? chalk.cyan('→ ' + latestAugment) : chalk.green('Up to date')}`);
      });

      if (ideStatus.length === 0) {
        console.log(chalk.gray('  No supported IDEs detected'));
      }
    } catch (error) {
      console.log(chalk.red(`  Error checking Augment: ${error.message}`));
    }

    // CLI Tools Status
    console.log(chalk.bold('\n🖥️  CLI Tools'));
    try {
      await this.cliManager.detectInstalledCLIs();
      const cliStatus = await this.cliManager.checkAllForUpdates();

      if (cliStatus.length === 0) {
        console.log(chalk.gray('  No CLI tools installed'));
      }

      for (const cli of cliStatus) {
        const statusIcon = cli.needsUpdate ? chalk.yellow('⚠️') : chalk.green('✓');
        const current = `v${cli.installedVersion}`;
        const latest = cli.latestVersion ? `→ v${cli.latestVersion}` : '';
        console.log(`  ${statusIcon} ${cli.config.name.padEnd(12)} ${chalk.white(current.padEnd(15))} ${cli.needsUpdate ? chalk.cyan(latest) : chalk.green('Up to date')}`);
      }

      // Show available but not installed
      const availableCLIs = this.cliManager.getAvailableCLIs();
      const notInstalled = availableCLIs.filter(cli => 
        !cliStatus.find(s => s.id === cli.id)
      );

      if (notInstalled.length > 0) {
        console.log(chalk.gray('\n  Not installed:'));
        notInstalled.forEach(cli => {
          console.log(chalk.gray(`    - ${cli.name}: npm install -g ${cli.npmPackage}`));
        });
      }
    } catch (error) {
      console.log(chalk.red(`  Error checking CLI tools: ${error.message}`));
    }

    console.log(chalk.gray('\n' + '─'.repeat(60)));
  }

  async updateAugment() {
    console.log('\n' + chalk.cyan.bold('🔌 Augment Extension Update'));
    console.log(chalk.gray('─'.repeat(60)));

    this.ideManager.detectAvailableIDEs();
    const ideStatus = await this.ideManager.scanForExtension(this.extensionId);

    if (ideStatus.length === 0) {
      console.log(chalk.yellow('No supported IDEs detected. Install Cursor or VS Code first.'));
      return;
    }

    const latestVersion = await this.getLatestMarketplaceVersion();

    // Show current status
    let anyNeedsUpdate = false;
    ideStatus.forEach(status => {
      const current = status.version || 'Not installed';
      const needsUpdate = !status.version || semver.gt(latestVersion, status.version);
      if (needsUpdate) anyNeedsUpdate = true;

      const statusColor = needsUpdate ? chalk.yellow : chalk.green;
      console.log(`${status.config.name}: ${statusColor(current)} ${needsUpdate ? '→ ' + latestVersion : '(up to date)'}`);
    });

    if (!anyNeedsUpdate) {
      console.log(chalk.green('\n✅ All IDEs are up to date!'));
      return;
    }

    // Prompt for update
    const targets = await this.promptIDESelection(ideStatus, latestVersion);
    if (targets.length === 0) {
      console.log(chalk.gray('No updates selected.'));
      return;
    }

    let vsixPath = null;
    try {
      vsixPath = await this.downloadVsix(latestVersion);

      for (const target of targets) {
        await this.ideManager.installExtension(target, vsixPath, this.isDryRun);
      }

      console.log(chalk.green('\n✅ Update complete! Reload your IDE(s) for changes to take effect.'));
    } finally {
      if (vsixPath) this.cleanupFile(vsixPath);
    }
  }

  async promptIDESelection(ideStatus, latestVersion) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n' + chalk.cyan('Select IDEs to update:'));
      console.log(`  ${chalk.bold('a')} - Update ALL`);
      ideStatus.forEach((status, i) => {
        console.log(`  ${chalk.bold(i + 1)} - ${status.config.name} only`);
      });
      console.log(`  ${chalk.bold('q')} - Cancel`);

      rl.question(chalk.bold('\nChoice: '), (answer) => {
        rl.close();
        const choice = answer.toLowerCase().trim();

        if (choice === 'q') return resolve([]);
        if (choice === 'a') return resolve(ideStatus);

        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < ideStatus.length) {
          return resolve([ideStatus[idx]]);
        }

          resolve([]);
      });
    });
  }

  async updateClaudeCode() {
    console.log('\n' + chalk.cyan.bold('🤖 Claude Code CLI Update'));
    console.log(chalk.gray('─'.repeat(60)));

    await this.cliManager.detectInstalledCLIs();
    const claudeCLI = this.cliManager.detectedCLIs.find(c => c.id === 'claude-code');

    if (!claudeCLI) {
      console.log(chalk.yellow('Claude Code CLI is not installed.'));
      console.log(chalk.gray(`Install with: npm install -g @anthropic-ai/claude-code`));

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        rl.question(chalk.bold('Install now? (y/n): '), async (answer) => {
          rl.close();
          if (answer.toLowerCase() === 'y') {
            await this.cliManager.installCLI('claude-code', this.isDryRun);
          }
          resolve();
        });
      });
    }

    const latestVersion = await this.cliManager.getLatestVersion(claudeCLI.config.npmPackage);
    const needsUpdate = semver.gt(latestVersion, claudeCLI.installedVersion);

    console.log(`Current: v${claudeCLI.installedVersion}`);
    console.log(`Latest:  v${latestVersion}`);

    if (!needsUpdate) {
      console.log(chalk.green('\n✅ Claude Code is up to date!'));
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.bold('\nUpdate now? (y/n): '), async (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y') {
          await this.cliManager.updateCLI(claudeCLI, this.isDryRun);
        }
        resolve();
      });
    });
  }

  async updateGeminiCLI() {
    console.log('\n' + chalk.cyan.bold('💎 Gemini CLI Update'));
    console.log(chalk.gray('─'.repeat(60)));

    await this.cliManager.detectInstalledCLIs();
    const geminiCLI = this.cliManager.detectedCLIs.find(c => c.id === 'gemini-cli');

    if (!geminiCLI) {
      console.log(chalk.yellow('Gemini CLI is not installed.'));
      console.log(chalk.gray(`Install with: npm install -g @google/gemini-cli`));

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        rl.question(chalk.bold('Install now? (y/n): '), async (answer) => {
          rl.close();
          if (answer.toLowerCase() === 'y') {
            await this.cliManager.installCLI('gemini-cli', this.isDryRun);
          }
          resolve();
        });
      });
    }

    const latestVersion = await this.cliManager.getLatestVersion(geminiCLI.config.npmPackage);
    const needsUpdate = semver.gt(latestVersion, geminiCLI.installedVersion);

    console.log(`Current: v${geminiCLI.installedVersion}`);
    console.log(`Latest:  v${latestVersion}`);

    if (!needsUpdate) {
      console.log(chalk.green('\n✅ Gemini CLI is up to date!'));
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.bold('\nUpdate now? (y/n): '), async (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y') {
          await this.cliManager.updateCLI(geminiCLI, this.isDryRun);
        }
        resolve();
      });
    });
  }

  async updateOpenAICodex() {
    console.log('\n' + chalk.cyan.bold('🧠 OpenAI Codex CLI Update'));
    console.log(chalk.gray('─'.repeat(60)));

    await this.cliManager.detectInstalledCLIs();
    const codexCLI = this.cliManager.detectedCLIs.find(c => c.id === 'openai-codex');

    if (!codexCLI) {
      console.log(chalk.yellow('OpenAI Codex CLI is not installed.'));
      console.log(chalk.gray(`Install with: npm install -g @openai/codex`));

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        rl.question(chalk.bold('Install now? (y/n): '), async (answer) => {
          rl.close();
          if (answer.toLowerCase() === 'y') {
            await this.cliManager.installCLI('openai-codex', this.isDryRun);
          }
          resolve();
        });
      });
    }

    const latestVersion = await this.cliManager.getLatestVersion(codexCLI.config.npmPackage);
    const needsUpdate = semver.gt(latestVersion, codexCLI.installedVersion);

    console.log(`Current: v${codexCLI.installedVersion}`);
    console.log(`Latest:  v${latestVersion}`);

    if (!needsUpdate) {
      console.log(chalk.green('\n✅ OpenAI Codex CLI is up to date!'));
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.bold('\nUpdate now? (y/n): '), async (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y') {
          await this.cliManager.updateCLI(codexCLI, this.isDryRun);
        }
        resolve();
      });
    });
  }

  async updateAll() {
    console.log('\n' + chalk.cyan.bold('🔄 Updating All AI Tools'));
    console.log(chalk.gray('─'.repeat(60)));

    await this.updateAugment();
    await this.updateClaudeCode();
    await this.updateGeminiCLI();
    await this.updateOpenAICodex();

    console.log(chalk.green('\n✅ All updates complete!'));
  }

  async run() {
    try {
      if (this.isDryRun) {
        console.log(chalk.yellow('🔸 DRY RUN MODE - No actual changes will be made\n'));
      }

      // If run without TTY (cron mode), just check and notify
      if (this.isCronMode) {
        await this.runCronMode();
        return;
      }

      // Interactive mode
      while (true) {
        const action = await this.showMainMenu();

        switch (action) {
          case 'augment':
            await this.updateAugment();
            break;
          case 'claude':
            await this.updateClaudeCode();
            break;
          case 'gemini':
            await this.updateGeminiCLI();
            break;
          case 'codex':
            await this.updateOpenAICodex();
            break;
          case 'all':
            await this.updateAll();
            break;
          case 'status':
            await this.showStatus();
            break;
          case 'quit':
            console.log(chalk.gray('\nGoodbye! 👋'));
            return;
          default:
            console.log(chalk.red('Invalid selection'));
        }

        // Pause before showing menu again
        await new Promise((resolve) => {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          rl.question(chalk.gray('\nPress ENTER to continue...'), () => {
            rl.close();
            resolve();
          });
        });
      }
    } catch (error) {
      this.logger.error(`Fatal error: ${error.message}`);
      process.exit(1);
    }
  }

  async runCronMode() {
    this.logger.info('Running in cron mode...');

    // Check Augment
    try {
      this.ideManager.detectAvailableIDEs();
      const ideStatus = await this.ideManager.scanForExtension(this.extensionId);
      const latestAugment = await this.getLatestMarketplaceVersion();

      const augmentNeedsUpdate = ideStatus.some(s => 
        !s.version || semver.gt(latestAugment, s.version)
      );

      if (augmentNeedsUpdate) {
        const result = await this.notifications.sendNative(
          'Augment Update Available',
          `New version: ${latestAugment}`,
          ['Later', 'Update Now']
        );

        if (result === 'Update Now') {
          const vsixPath = await this.downloadVsix(latestAugment);
          for (const target of ideStatus.filter(s => !s.version || semver.gt(latestAugment, s.version))) {
            await this.ideManager.installExtension(target, vsixPath, this.isDryRun);
          }
          this.cleanupFile(vsixPath);
          await this.notifications.showSimple('Update Complete', 'Augment has been updated');
        }
      }
      } catch (error) {
      this.logger.error(`Augment check failed: ${error.message}`);
    }

    // Check CLI tools
    try {
      await this.cliManager.detectInstalledCLIs();
      const cliStatus = await this.cliManager.checkAllForUpdates();

      for (const cli of cliStatus.filter(c => c.needsUpdate)) {
        const result = await this.notifications.sendNative(
          `${cli.config.name} Update Available`,
          `v${cli.installedVersion} → v${cli.latestVersion}`,
          ['Later', 'Update Now']
        );

        if (result === 'Update Now') {
          await this.cliManager.updateCLI(cli, this.isDryRun);
          await this.notifications.showSimple('Update Complete', `${cli.config.name} has been updated`);
        }
      }
    } catch (error) {
      this.logger.error(`CLI check failed: ${error.message}`);
    }
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
  process.exit(1);
});

// Run the updater
if (require.main === module) {
  console.error(chalk.yellow.bold('\n⚠ DEPRECATED: This project is no longer maintained.'));
  console.error(chalk.yellow(
    'Augment Code has sunset its VS Code/Cursor extension in favor of cloud/CLI tooling (e.g. @augmentcode/auggie).\n' +
    'This updater should not be used to install or update Augment. See README.md for uninstall steps.\n'
  ));
  const updater = new AICodeUpdater();
  updater.run();
}

module.exports = AICodeUpdater;
