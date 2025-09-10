#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

console.log(chalk.blue('🔍 Testing Cursor Profile Detection...\n'));

async function getCursorProfiles() {
  try {
    const cursorProfilesPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'profiles');
    
    console.log(`Looking for profiles in: ${cursorProfilesPath}`);
    
    if (!fs.existsSync(cursorProfilesPath)) {
      console.log(chalk.red('❌ Cursor profiles directory not found'));
      return [];
    }

    const profileDirs = fs.readdirSync(cursorProfilesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    console.log(`Found ${profileDirs.length} profile directories: ${profileDirs.join(', ')}\n`);

    const profiles = [];
    
    for (const profileDir of profileDirs) {
      const profilePath = path.join(cursorProfilesPath, profileDir);
      const extensionsJsonPath = path.join(profilePath, 'extensions.json');
      
      console.log(`Checking profile: ${chalk.yellow(profileDir)}`);
      console.log(`  Path: ${profilePath}`);
      console.log(`  Extensions file: ${extensionsJsonPath}`);
      
      // Check if this profile has extensions (indicating it's an active profile)
      if (fs.existsSync(extensionsJsonPath)) {
        const hasAugment = await profileHasAugment(extensionsJsonPath);
        const augmentVersion = hasAugment ? await getAugmentVersion(extensionsJsonPath) : null;
        
        profiles.push({
          name: profileDir,
          path: profilePath,
          hasAugment: hasAugment,
          augmentVersion: augmentVersion
        });
        
        console.log(`  ✓ Active profile`);
        console.log(`  Augment: ${hasAugment ? chalk.green(`Yes (${augmentVersion})`) : chalk.red('No')}`);
      } else {
        console.log(`  ✗ No extensions.json found (inactive profile)`);
      }
      console.log('');
    }

    return profiles;
  } catch (error) {
    console.log(chalk.red(`Error getting Cursor profiles: ${error.message}`));
    return [];
  }
}

async function profileHasAugment(extensionsJsonPath) {
  try {
    const extensionsData = fs.readFileSync(extensionsJsonPath, 'utf8');
    return extensionsData.includes('augment.vscode-augment');
  } catch (error) {
    return false;
  }
}

async function getAugmentVersion(extensionsJsonPath) {
  try {
    const extensionsData = fs.readFileSync(extensionsJsonPath, 'utf8');
    const match = extensionsData.match(/augment\.vscode-augment.*?"version":"([^"]+)"/);
    return match ? match[1] : 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

async function main() {
  const profiles = await getCursorProfiles();
  
  console.log(chalk.blue('📊 Summary:'));
  console.log(`Total profiles found: ${profiles.length}`);
  
  const profilesWithAugment = profiles.filter(p => p.hasAugment);
  console.log(`Profiles with Augment: ${profilesWithAugment.length}`);
  
  if (profilesWithAugment.length > 0) {
    console.log('\nAugment versions by profile:');
    profilesWithAugment.forEach(profile => {
      console.log(`  ${chalk.yellow(profile.name)}: ${chalk.green(profile.augmentVersion)}`);
    });
    
    // Check for version inconsistencies
    const versions = [...new Set(profilesWithAugment.map(p => p.augmentVersion))];
    if (versions.length > 1) {
      console.log(chalk.red('\n⚠️  Version inconsistency detected!'));
      console.log('Different profiles have different Augment versions.');
      console.log('The updater should install to all profiles to fix this.');
    } else {
      console.log(chalk.green('\n✅ All profiles have the same Augment version.'));
    }
  }
  
  console.log('\n' + chalk.blue('🔧 Test completed!'));
}

main().catch(console.error);
