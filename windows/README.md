# Windows Dotfiles

A high-performance Windows development environment featuring PowerShell, Starship prompt, and a minimalist VS Code configuration.

## File Structure

| File / Folder | Purpose |
| :--- | :--- |
| `microsoft.powershell_profile.ps1` | PowerShell profile with Starship, icons, fzf, and PSReadLine. |
| `starship.toml` | **[Starship]** Modern, ultra-fast shell prompt theme. |
| `settings.json` | **[VS Code]** Minimalist UI with Vim Dark Soft theme and premium typography. |
| `extensions.md` | Essential list of curated VS Code extensions. |

## Quick Setup

1.  **Install JetBrainsMono Nerd Font** (Required for icons and UI).
2.  **Install Starship**: 
    ```powershell
    winget install starship
    ```
3.  **Copy configurations**:
    *   `starship.toml` -> `~/.config/starship/starship.toml`
    *   `microsoft.powershell_profile.ps1` -> `$PROFILE`
    *   `settings.json` -> VS Code Settings path.

## Unified Aesthetic

All Windows configurations follow the same minimalist styling:
- **Font**: JetBrainsMono Nerd Font.
- **Theme**: Gruvbox / Vim Dark Soft for a cohesive, professional look.
- **Headers**: Clean, clutter-free section markers.

---

## Core Toolset

| Tool | Why? |
| :--- | :--- |
| **PowerShell** | Advanced 7.x+ build for a modern, cross-platform CLI experience. |
| **Starship** | The most customizable, cross-shell prompt in existence. |
| **fzf** | Seamless fuzzy finding for history and file navigation. |
| **VS Code** | Ultra-clean, distraction-free IDE optimized for rapid development. |
