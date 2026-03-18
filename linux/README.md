# Linux Dotfiles

A high-performance Linux development environment built with Zsh, Bash, Kitty, and MPV. Focuses on speed, minimalism, and a unified aesthetic.

## File Structure

| File / Folder     | Purpose                                                  |
| :---------------- | :------------------------------------------------------- |
| `.bashrc`         | Interactive Bash configuration and shell environment.    |
| `.zshenv`         | Zsh environment bootstrap.                               |
| `.profile`        | Global login environment variables for all shells.       |
| `.config/zsh/`    | Modern Zsh setup with Zinit and Powerlevel10k.           |
| `.config/mpv/`    | **[MPV]** Highly optimized media player with scripts.    |
| `.config/kitty/`  | **[Kitty]** High-speed terminal emulator with ligatures. |
| `.config/yazi/`      | **[Yazi]** Blazing fast terminal file manager.           |
| `.config/aliasrc`    | Unified aliases shared between Bash and Zsh.             |
| `.config/fastfetch/` | **[Fastfetch]** System info with custom ASCII logo.      |
| `.config/tealdeer/`  | **[Tealdeer]** High-speed tldr implementation.           |
| `.config/bat/`       | Syntax highlighting profiles for bat.                   |
| `.config/dircolors`  | Terminal color definitions for ls/eza.                  |
| `.gitconfig`         | Global git identity and development aliases.             |

## Quick Setup

1.  **Install JetBrainsMono Nerd Font** (Required for icons and UI).
2.  **Clone this repo** into `~/Dev/dotfiles`.
3.  **Run the install script**:
    ```bash
    chmod +x linux/install.sh
    ./linux/install.sh
    ```

## Unified Aesthetic

All configuration files follow a strict minimalist styling:

- **Font**: JetBrainsMono Nerd Font.
- **Theme**: Gruvbox Dark.
- **Headers**: Consistent, clutter-free comment style.

---

## Core Toolset

| Tool              | Why?                                                           |
| :---------------- | :-------------------------------------------------------------- |
| **MPV**           | State-of-the-art media player with custom OSD Search & History. |
| **Kitty**         | GPU-accelerated terminal with superior latency and ligatures.   |
| **Yazi**          | Modern, blazing-fast terminal file manager written in Rust.     |
| **Zinit**         | Powerful, fast Zsh plugin manager for instant startup.          |
| **Powerlevel10k** | Highly configurable, instantaneous prompt theme.                |
| **fzf**           | Frictionless fuzzy finder for history, files, and commands.     |
| **bat**           | Modern alternative to `cat` with syntax highlighting.           |
| **zoxide**        | Smarter `cd` command that learns your habits.                   |
| **fastfetch**     | Blazing fast system information tool (successor to neofetch).   |
| **tealdeer**      | Fast Rust implementation of tldr for quick command cheatsheets. |
| **dust**          | Visual, Rust-powered disk usage analyzer.                       |
