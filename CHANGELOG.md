# Changelog

All notable changes to the Augment Extension Auto-Installer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Multi-Profile Support for Cursor IDE (opt-in)**: When run with `--install-all-profiles` or `--install-all`, the extension is installed to the default profile then registered in all Cursor profiles via each profile’s `extensions.json`. Default behavior remains single-profile.
- **Cross-platform profile paths**: Cursor profiles directory is resolved per platform (macOS: `~/Library/Application Support/Cursor/User/profiles/`, Linux: `~/.config/Cursor/User/profiles/`, Windows: `%APPDATA%/Cursor/User/profiles/`).
- **Profile logic in IDEManager**: All Cursor profile handling lives in `src/managers/ide-manager.js` (getCursorProfilesPath, getCursorProfiles, installExtensionInAllCursorProfiles, updateProfileExtensionsJson).

### Changed
- **Path resolution**: Extension location uses `os.homedir()` only; no path traversal from profile path. Location written to `extensions.json` is cross-platform (no hardcoded C: or `/c:/Users/...`).
- **Version in extensions.json**: Version is derived from the extension folder name via `extractVersionFromFolderName`; no hardcoded fallback version.
- **installInAllIDEs**: Left at default `false` in config; multi-profile remains opt-in via CLI flags only.

### Fixed
- **Cursor profile isolation**: With `--install-all-profiles`, all Cursor profiles are updated to use the same installed extension.
- **Windows-only paths**: Profile discovery works on macOS, Linux, and Windows.

### Technical Details
- `getCursorProfilesPath()` returns the Cursor User profiles directory for the current platform.
- `installExtensionInAllCursorProfiles()` installs once to default, then updates each profile’s `extensions.json` to point at the shared `os.homedir()/.cursor/extensions/` path.
- `.code-workspace` files are ignored via `.gitignore` and are not committed.

## [Previous Versions]
- Initial Windows Task Scheduler implementation
- Basic IDE detection and extension installation
- VS Code and Cursor support
- Automated update checking and installation
