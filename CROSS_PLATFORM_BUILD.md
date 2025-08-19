# Cross-Platform Build Support

This document describes the cross-platform build support that has been added to make the project compile on Linux, macOS, and Windows.

## Changes Made

### 1. Package.json Scripts

The following scripts in `package.json` have been updated to be cross-platform:

- **`reset:node_modules`**: Replaced Unix `rm` command with Node.js file system operations
- **`translations:update`**: Updated to use the new cross-platform `find_complete_translations.js` script

### 2. Shell Script Replacements

The following shell scripts have been replaced with cross-platform Node.js equivalents:

| Original Script | Cross-Platform Replacement | Purpose |
|----------------|---------------------------|---------|
| `bin/find_complete_translations.sh` | `bin/find_complete_translations.js` | Check translation completeness |
| `bin/update_background_thumbnails.sh` | `bin/update_background_thumbnails.js` | Generate background thumbnails |
| `bin/help/create-local-help.sh` | `bin/help/create-local-help.js` | Create local help documentation |
| `bin/link_core/link_catalog.sh` | `bin/link_core/link_catalog.js` | Link catalog dependencies |
| `bin/link_core/link_local.sh` | `bin/link_core/link_local.js` | Link local core dependencies |

### 3. Cross-Platform Utilities

A utility script `bin/cross-platform-utils.js` has been created to provide cross-platform alternatives to common Unix commands. All scripts use ES modules for compatibility with the project's module system:

```bash
# Remove files/directories
node bin/cross-platform-utils.js rm -rf node_modules

# Create directories
node bin/cross-platform-utils.js mkdir -p new/directory

# Copy files
node bin/cross-platform-utils.js cp -r src dest

# Move files
node bin/cross-platform-utils.js mv src dest

# Find files
node bin/cross-platform-utils.js find . "*.js"
```

## Usage

### Building on Windows

All build commands now work on Windows without requiring additional tools:

```bash
# Install dependencies
pnpm install

# Build for Electron
pnpm build:electron

# Build for Browser
pnpm build:browser

# Build for Tauri
pnpm dev:tauri

# Reset node_modules (cross-platform)
pnpm reset:node_modules
```

### Translation Management

```bash
# Update translations (cross-platform)
pnpm translations:update
```

### Core Linking

```bash
# Link catalog dependencies (cross-platform)
node bin/link_core/link_catalog.js

# Link local core dependencies (cross-platform)
node bin/link_core/link_local.js
```

## Requirements

- Node.js 20 or higher
- pnpm 9.6.0 or higher
- ImageMagick (for background thumbnail generation)

## Initial Setup

Before running any scripts, ensure all dependencies are installed:

```bash
pnpm install
```

This will install all required packages including `xml-js` which is needed for translation processing.

## Platform-Specific Notes

### Windows
- All scripts now use Node.js file system operations instead of Unix commands
- No need for Git Bash, WSL, or other Unix-like environments
- Works with standard Windows Command Prompt or PowerShell

### macOS
- All functionality preserved
- No changes to existing workflow

### Linux
- All functionality preserved
- No changes to existing workflow

## Troubleshooting

### Missing Dependencies
If you encounter `ERR_MODULE_NOT_FOUND` errors:
1. Run `pnpm install` to install all dependencies
2. Ensure you're using Node.js 20 or higher
3. Check that pnpm is version 9.6.0 or higher

### ImageMagick Issues
If you encounter issues with ImageMagick on Windows:
1. Install ImageMagick from https://imagemagick.org/
2. Ensure it's added to your system PATH
3. The `magick` command should be available in your terminal

### Permission Issues
If you encounter permission issues with the Node.js scripts:
```bash
# Make scripts executable (Unix-like systems)
chmod +x bin/*.js
chmod +x bin/*/*.js
```

### Core Repository Linking
When linking local core dependencies, ensure the core repository is in one of these locations:
- `../core`
- `../deltachat-core-rust`

Or set the `CORE_REPO_CHECKOUT` environment variable to the correct path.

## Testing Cross-Platform Compatibility

### Local Testing

Run the cross-platform compatibility test suite:

```bash
# Run all cross-platform tests
pnpm test:cross-platform

# Or run the test script directly
node bin/test-cross-platform.js
```

### GitHub Actions Testing

The project includes automated GitHub Actions workflows that test cross-platform compatibility:

1. **Cross-Platform Compatibility Test** (`.github/workflows/cross-platform-test.yml`)
   - Tests all cross-platform scripts on Windows, Linux, and macOS
   - Runs on every push and pull request
   - Verifies package.json scripts, translation processing, and utilities

2. **Cross-Platform Build Test** (`.github/workflows/cross-platform-build.yml`)
   - Tests actual build process on all platforms
   - Builds Electron and Browser targets
   - Uploads build artifacts for verification

### Manual Testing on Different Platforms

To manually test on different platforms:

#### Windows
```bash
# In Command Prompt or PowerShell
pnpm install
pnpm test:cross-platform
pnpm build:electron
```

#### Linux
```bash
# In any Linux distribution
pnpm install
pnpm test:cross-platform
pnpm build:electron
```

#### macOS
```bash
# In Terminal
pnpm install
pnpm test:cross-platform
pnpm build:electron
```

## Migration Guide

If you have existing scripts that reference the old shell scripts, update them to use the new Node.js versions:

```bash
# Old
./bin/find_complete_translations.sh

# New
node bin/find_complete_translations.js
```

The functionality remains the same, but now works across all platforms. 