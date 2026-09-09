# AI Code Tools Updater

> [!CAUTION]
> **This project is deprecated and no longer maintained.**
>
> [Augment Code](https://www.augmentcode.com/) has sunset its Visual Studio Code / Cursor IDE extension in favor of its cloud platform (including the [Auggie CLI](https://www.npmjs.com/package/@augmentcode/auggie) and related cloud tooling). This repository existed primarily to auto-install and update that extension, so it is no longer useful for that purpose.
>
> **Do not install** the Windows scheduled task, cron job, or global `acu` / `ai-code-updater` package. If you already installed them, uninstall as described in [Uninstall](#uninstall-deprecated-install) below.
>
> For Augment going forward, use their current cloud / CLI offerings (for example `npm install -g @augmentcode/auggie`), not this updater.

A unified updater for AI coding tools - manage updates for **Augment**, **Claude Code**, **Gemini CLI**, and **OpenAI Codex** from one place.

**Status:** Deprecated (see notice above).

## Supported Tools

| Tool | Type | Package/Extension |
|------|------|-------------------|
| **Augment** | VS Code Extension | `augment.vscode-augment` |
| **Claude Code** | npm CLI | `@anthropic-ai/claude-code` |
| **Gemini CLI** | npm CLI | `@google/gemini-cli` |
| **OpenAI Codex** | npm CLI | `@openai/codex` |

## Quick Start

```bash
# Install dependencies
npm install

# Run the updater
npm start

# Or dry-run (no changes made)
npm test
```

## Global Installation (Run `acu` from Anywhere)

Install globally to run the updater from any directory:

```bash
# Option 1: Install from the project directory
cd /path/to/ai-code-auto-updater
npm install -g .

# Option 2: Using npm link (creates a symlink)
cd /path/to/ai-code-auto-updater
npm link

# Now run from anywhere:
acu                    # Short form
ai-code-updater        # Long form
```

### Verify Installation

```bash
# Check if installed
which acu

# View help
acu --help

# Check version
acu --version
```

### Uninstall Global Package

```bash
npm uninstall -g ai-code-updater
# or if you used npm link:
npm unlink ai-code-updater
```

## Uninstall (deprecated install)

If you previously installed this project’s automation:

### Windows scheduled task

```powershell
# From the project directory (may require Administrator)
npm run uninstall-task
# or:
powershell -ExecutionPolicy Bypass -File .\Uninstall-WindowsTask.ps1 -Force
```

Or remove the task manually:

```powershell
Unregister-ScheduledTask -TaskName "AugmentMonitor" -Confirm:$false
```

### macOS / Linux cron

Remove any crontab entries that run `index.js`, `acu`, or `ai-code-updater` from this project.

### Global npm package

```bash
npm uninstall -g ai-code-updater
# or if you used npm link:
npm unlink -g ai-code-updater
```

### Augment IDE extension (optional)

If the extension is still installed in Cursor/VS Code and you no longer need it:

```bash
cursor --uninstall-extension augment.vscode-augment
# or
code --uninstall-extension augment.vscode-augment
```

For Augment itself, use their current cloud/CLI path (e.g. `@augmentcode/auggie`), not this repository.

## Command Line Options

```
Usage: acu [options]

Options:
  -a, --auto      Auto-pilot mode: update all tools without prompts
  -s, --silent    Silent mode: minimal output (use with --auto)
  --dry-run       Show what would be updated without making changes
  -h, --help      Show help message
  -v, --version   Show version number

Examples:
  acu                     # Interactive mode (default)
  acu --auto              # Auto-update all tools
  acu --auto --dry-run    # Dry run to see what would be updated
  acu --auto --silent     # Silent auto-update (for scripts/cron)
```

## Interactive Menu

```
🚀 AI Code Tools Updater
════════════════════════════════════════════════════════════
Manage updates for your AI coding tools

  1)  Check & Update Augment Extension (VS Code/Cursor)
  2)  Check & Update Claude Code CLI
  3)  Check & Update Gemini CLI
  4)  Check & Update OpenAI Codex CLI
  5)  Check & Update ALL tools
  6)  🤖 Auto-pilot: Update ALL (no prompts)
  7)  Show status of all tools
  q)  Quit
```

## Auto-Pilot Mode

Auto-pilot mode automatically updates all tools without requiring user confirmation, then displays a comprehensive summary:

```bash
# From CLI
acu --auto

# Or select option 6 from the interactive menu
```

### Example Summary Output

```
📋 UPDATE SUMMARY
════════════════════════════════════════════════════════════
Completed in 45 seconds

🔌 Augment Extension:
   ✓ Cursor: 0.520.0 → 0.521.0
   ✓ VS Code: 0.520.0 → 0.521.0

🖥️  CLI Tools:
   ✓ 🤖 Claude Code: v1.0.5 → v1.0.6
   - 💎 Gemini CLI: Up to date (v0.1.22)
   - 🧠 OpenAI Codex: Not installed

────────────────────────────────────────────────────────────
Totals:
  Updated: 3
  Up to date/Skipped: 1

💡 Tip: Restart your IDE(s) to apply extension updates
════════════════════════════════════════════════════════════
```

## macOS App

Double-click the app to launch the updater:

```bash
# Create/recreate the app
npm run create-app

# The app is at: ./AI Code Updater.app
```

## Automated Updates

### macOS/Linux (Cron)

```bash
npm run install-cron
```

This will set up a daily check for updates. When updates are available, you'll receive a macOS notification with options to update or dismiss.

### Windows (Scheduled Task)

```bash
npm run install-task
```

## Error Handling

The updater includes robust error handling for common issues:

- **iCloud Sync Issues**: Automatically detects and waits for iCloud files to sync
- **Network Errors**: Automatic retries with exponential backoff
- **Permission Errors**: Clear suggestions for resolving permission issues
- **Timeout Handling**: Configurable timeouts with automatic retries

### Troubleshooting

**iCloud Issues:**
If running from iCloud Drive, you may experience sync delays. Consider:
- Moving the project to a local directory
- Waiting for iCloud sync to complete before running

**Permission Errors:**
```bash
# Fix npm global permissions (preferred)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Or use sudo (not recommended)
sudo npm install -g ai-code-updater
```

**IDE Not Detected:**
Set the path explicitly via environment variable:
```bash
export CURSOR_PATH="/path/to/cursor"
export VSCODE_PATH="/path/to/code"
```

## Project Structure

```
ai-code-updater/
├── index.js                    # Main entry point
├── src/
│   ├── managers/
│   │   ├── ide-manager.js      # VS Code/Cursor extension management
│   │   └── cli-manager.js      # npm CLI tool management
│   └── utils/
│       ├── logger.js           # Logging utilities
│       ├── notifications.js    # macOS notification support
│       └── error-handler.js    # Error handling with retries
├── AI Code Updater.app/        # macOS app bundle
├── create-app.sh               # Script to create macOS app
├── install-cron.sh             # Cron setup for macOS/Linux
├── config.json                 # Configuration
└── package.json
```

## Requirements

- **Node.js** 14+
- **npm** for CLI tools
- **Cursor** or **VS Code** for Augment extension

## License

MIT
