# Terminal Icons Guide

## Overview

Terminal Icons enhances your PowerShell experience by adding file and folder icons to directory listings.

## Installation

```powershell
Install-Module -Name Terminal-Icons -Repository PSGallery
```

## Configuration

Add to your PowerShell profile (`$PROFILE`):

```powershell
Import-Module -Name Terminal-Icons
```

## Icons Reference

### Folder Icons

- 📁 Regular Folder
- 📂 Open Folder
- 🗂️ Project Folder
- 📦 Package Folder
- 🔧 Config Folder
- 📝 Docs Folder

### File Icons

- 📄 Regular File
- ⚙️ Config Files
- 📜 Script Files
- 🔒 Lock Files
- 📋 JSON Files
- 🎨 Style Files
- ⚛️ React Files
- 📦 Package Files

## Customization

To customize icons, create a custom theme:

```powershell
$ThemeSettings = @{
    Folder         = "📁"
    OpenFolder     = "📂"
    SymbolicFolder = "🔗"
}

Set-TerminalIconsTheme -IconTheme $ThemeSettings
```

## Troubleshooting

If icons aren't displaying correctly:

1. Verify JetBrains Mono Nerd Font is installed
2. Ensure your terminal supports Unicode characters
3. Check PowerShell profile loads Terminal-Icons module
