# Changelog

All notable changes to the Augment Extension Auto-Installer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Multi-Profile Support for Cursor IDE**: Automatic detection and installation of extensions to all Cursor profiles
- **Profile Detection System**: Comprehensive scanning of Cursor profile directories
- **Direct Extension Copying**: Robust method to copy extensions directly to profile directories when CLI methods fail
- **Profile Extensions.json Management**: Automatic updating of profile extension registries
- **Enhanced Logging**: Detailed logging for profile operations and installation status
- **Profile Installation Testing Tools**: Development utilities for testing profile detection and installation
- **Configuration Option**: `installInAllProfiles` setting to control multi-profile behavior

### Changed
- **Windows Task Scheduler**: Updated to use `--install-all --install-all-profiles` flags for comprehensive installation
- **IDE Manager**: Enhanced `installExtensionInAllIDEs()` method to handle Cursor profiles specifically
- **Installation Logic**: Improved fallback mechanisms for profile installation failures
- **Configuration**: Added `installInAllProfiles: true` to default configuration

### Fixed
- **Cursor Profile Isolation Issue**: Extensions now install to all Cursor profiles, not just the active one
- **Version Inconsistency**: All profiles now receive the same extension version during updates
- **Profile Detection**: Robust detection of active vs inactive profiles based on extensions.json presence

### Technical Details
- Added `getCursorProfiles()` method for profile discovery
- Added `copyExtensionToAllProfiles()` method for direct extension copying
- Added `updateProfileExtensionsJson()` method for profile registry management
- Added `copyDirectory()` utility for recursive directory copying
- Enhanced error handling and logging throughout profile operations

## [Previous Versions]
- Initial Windows Task Scheduler implementation
- Basic IDE detection and extension installation
- VS Code and Cursor support
- Automated update checking and installation
