# Windows Dotfiles

PowerShell + Starship prompt setup with VS Code config.

## What's Here

| File                                        | What it does                                          |
| ------------------------------------------- | ----------------------------------------------------- |
| `terminal/microsoft.powershell_profile.ps1` | PowerShell profile (Starship, icons, fzf, PSReadLine) |
| `terminal/starship.toml`                    | Starship prompt theme                                 |
| `terminal/starship.md`                      | How to install Starship                               |
| `terminal/icons.md`                         | Terminal-Icons setup                                  |
| `vscode/settings.json`                      | VS Code settings (minimal UI, Vim Dark Soft theme)    |
| `vscode/extensions.md`                      | List of VS Code extensions                            |
| `nerd-font.md`                              | JetBrains Mono Nerd Font install                      |

## Setup

1. Install [JetBrains Mono Nerd Font](https://www.nerdfonts.com/font-downloads)
2. Install Starship: `winget install starship`
3. Copy `terminal/starship.toml` to `~/.config/starship/starship.toml`
4. Copy `terminal/microsoft.powershell_profile.ps1` to your `$PROFILE` path
5. Copy `vscode/settings.json` to your VS Code settings
6. Reload PowerShell: `. $PROFILE`
