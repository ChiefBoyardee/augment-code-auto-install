#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

// Import the IDEManager class from index.js
const IDEManager = require('./index.js').IDEManager || class IDEManager {
  constructor() {
    this.detectedIDEs = [];
    this.currentIDE = null;
  }
  
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow
    };
    const color = colors[type] || chalk.white;
    console.log(`[${timestamp}] ${color(message)}`);
  }

  async getCursorProfiles() {
    try {
      const cursorProfilesPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'profiles');
      
      if (!fs.existsSync(cursorProfilesPath)) {
        this.log('Cursor profiles directory not found', 'warning');
        return [];
      }

      const profileDirs = fs.readdirSync(cursorProfilesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      const profiles = [];
      
      for (const profileDir of profileDirs) {
        const profilePath = path.join(cursorProfilesPath, profileDir);
        const extensionsJsonPath = path.join(profilePath, 'extensions.json');
        
        // Check if this profile has extensions (indicating it's an active profile)
        if (fs.existsSync(extensionsJsonPath)) {
          profiles.push({
            name: profileDir,
            path: profilePath,
            hasAugment: await this.profileHasAugment(extensionsJsonPath)
          });
        }
      }

      return profiles;
    } catch (error) {
      this.log(`Error getting Cursor profiles: ${error.message}`, 'error');
      return [];
    }
  }

  async profileHasAugment(extensionsJsonPath) {
    try {
      const extensionsData = fs.readFileSync(extensionsJsonPath, 'utf8');
      return extensionsData.includes('augment.vscode-augment');
    } catch (error) {
      return false;
    }
  }

  async copyDirectory(source, target) {
    if (!fs.existsSync(source)) {
      throw new Error(`Source directory does not exist: ${source}`);
    }
    
    // Create target directory
    fs.mkdirSync(target, { recursive: true });
    
    // Copy all files and subdirectories
    const items = fs.readdirSync(source, { withFileTypes: true });
    
    for (const item of items) {
      const sourcePath = path.join(source, item.name);
      const targetPath = path.join(target, item.name);
      
      if (item.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  async updateProfileExtensionsJson(profile, extensionDirName) {
    try {
      const extensionsJsonPath = path.join(profile.path, 'extensions.json');
      
      if (!fs.existsSync(extensionsJsonPath)) {
        // Create a new extensions.json if it doesn't exist
        const newExtensionsData = [];
        fs.writeFileSync(extensionsJsonPath, JSON.stringify(newExtensionsData, null, 2));
        return;
      }
      
      // Read existing extensions.json
      const extensionsData = JSON.parse(fs.readFileSync(extensionsJsonPath, 'utf8'));
      
      // Remove any existing Augment extension entries
      const filteredExtensions = extensionsData.filter(ext => 
        !ext.identifier || !ext.identifier.id || !ext.identifier.id.includes('augment.vscode-augment')
      );
      
      // Add the new Augment extension entry
      const versionMatch = extensionDirName.match(/augment\.vscode-augment-(.+)$/);
      const version = versionMatch ? versionMatch[1] : '0.551.0';
      
      const newExtensionEntry = {
        identifier: {
          id: "augment.vscode-augment",
          uuid: "fc0e137d-e132-47ed-9455-c4636fa5b897"
        },
        version: version,
        location: {
          $mid: 1,
          path: `/c:/Users/${os.userInfo().username}/.cursor/extensions/${extensionDirName}`,
          scheme: "file"
        },
        relativeLocation: extensionDirName,
        metadata: {
          isApplicationScoped: false,
          isMachineScoped: false,
          isBuiltin: false,
          installedTimestamp: Date.now(),
          pinned: false,
          source: "gallery",
          id: "fc0e137d-e132-47ed-9455-c4636fa5b897",
          publisherId: "7814b14b-491a-4e83-83ac-9222fa835050",
          publisherDisplayName: "augment",
          targetPlatform: "undefined",
          updated: true,
          private: false,
          isPreReleaseVersion: true,
          hasPreReleaseVersion: true,
          preRelease: true
        }
      };
      
      filteredExtensions.push(newExtensionEntry);
      
      // Write back to extensions.json
      fs.writeFileSync(extensionsJsonPath, JSON.stringify(filteredExtensions, null, 2));
      
    } catch (error) {
      this.log(`Error updating extensions.json for profile ${profile.name}: ${error.message}`, 'error');
    }
  }

  async copyExtensionToAllProfiles(profiles) {
    try {
      // Find the Augment extension in the default extensions directory
      const defaultExtensionsPath = path.join(os.homedir(), '.cursor', 'extensions');
      
      if (!fs.existsSync(defaultExtensionsPath)) {
        this.log('Default extensions directory not found', 'error');
        return;
      }

      // Find the Augment extension directory
      const extensionDirs = fs.readdirSync(defaultExtensionsPath)
        .filter(dir => dir.startsWith('augment.vscode-augment-'));
      
      if (extensionDirs.length === 0) {
        this.log('Augment extension not found in default extensions directory', 'error');
        return;
      }

      // Use the latest version (should be the one we just installed)
      const latestExtensionDir = extensionDirs.sort().pop();
      const sourceExtensionPath = path.join(defaultExtensionsPath, latestExtensionDir);
      
      this.log(`Found Augment extension: ${latestExtensionDir}`);
      
      // Copy to each profile
      for (const profile of profiles) {
        try {
          const profileExtensionsPath = path.join(profile.path, '..', '..', '..', '.cursor', 'extensions');
          
          // Create extensions directory if it doesn't exist
          if (!fs.existsSync(profileExtensionsPath)) {
            fs.mkdirSync(profileExtensionsPath, { recursive: true });
          }
          
          const targetExtensionPath = path.join(profileExtensionsPath, latestExtensionDir);
          
          // Remove old version if it exists
          if (fs.existsSync(targetExtensionPath)) {
            fs.rmSync(targetExtensionPath, { recursive: true, force: true });
          }
          
          // Copy the extension
          await this.copyDirectory(sourceExtensionPath, targetExtensionPath);
          
          // Update the profile's extensions.json
          await this.updateProfileExtensionsJson(profile, latestExtensionDir);
          
          this.log(`✓ Copied Augment extension to profile: ${profile.name}`, 'success');
          
        } catch (error) {
          this.log(`✗ Failed to copy extension to profile ${profile.name}: ${error.message}`, 'error');
        }
      }
      
    } catch (error) {
      this.log(`Error copying extension to profiles: ${error.message}`, 'error');
    }
  }
};

async function main() {
  console.log(chalk.blue('🧪 Testing Cursor Profile Extension Installation...\n'));
  
  const ideManager = new IDEManager();
  
  // Get all profiles
  const profiles = await ideManager.getCursorProfiles();
  
  console.log(`Found ${profiles.length} profiles:`);
  profiles.forEach(profile => {
    console.log(`  ${chalk.yellow(profile.name)}: ${profile.hasAugment ? chalk.green('Has Augment') : chalk.red('No Augment')}`);
  });
  
  if (profiles.length === 0) {
    console.log(chalk.red('No profiles found. Exiting.'));
    return;
  }
  
  console.log('\n' + chalk.blue('🔄 Attempting to copy Augment extension to all profiles...'));
  
  await ideManager.copyExtensionToAllProfiles(profiles);
  
  console.log('\n' + chalk.blue('✅ Test completed!'));
  console.log('Run the profile detection test again to verify the installation.');
}

main().catch(console.error);
