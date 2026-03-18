#!/usr/bin/env bash

# Dotfiles Installation Script (Linux)
# Creates symlinks from the repository to your home directory with automatic backups.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Backup Directory
BACKUP_DIR="$HOME/.dotfiles_backups/$(date +%Y%m%d_%H%M%S)"

link_file() {
    local src="$1"
    local dest="$2"

    mkdir -p "$(dirname "$dest")"

    if [ -L "$dest" ]; then
        rm "$dest"
    elif [ -e "$dest" ]; then
        mkdir -p "$BACKUP_DIR"
        mv "$dest" "$BACKUP_DIR/"
    fi

    echo -e "Linking ${src} -> ${dest}"
    ln -s "$src" "$dest"
}

echo -e "${BLUE}Starting dotfiles installation...${NC}"

# Core Files
link_file "$SCRIPT_DIR/.zshenv" "$HOME/.zshenv"
link_file "$SCRIPT_DIR/.profile" "$HOME/.profile"
link_file "$SCRIPT_DIR/.bashrc" "$HOME/.bashrc"
link_file "$SCRIPT_DIR/.gitconfig" "$HOME/.gitconfig"

# Config Directories
link_file "$SCRIPT_DIR/.config/zsh" "$HOME/.config/zsh"
link_file "$SCRIPT_DIR/.config/aliasrc" "$HOME/.config/aliasrc"
link_file "$SCRIPT_DIR/.config/bat" "$HOME/.config/bat"
link_file "$SCRIPT_DIR/.config/kitty" "$HOME/.config/kitty"
link_file "$SCRIPT_DIR/.config/terminal" "$HOME/.config/terminal"
link_file "$SCRIPT_DIR/.config/dircolors" "$HOME/.config/dircolors"
link_file "$SCRIPT_DIR/.config/yazi" "$HOME/.config/yazi"
link_file "$SCRIPT_DIR/.config/mpv" "$HOME/.config/mpv"
link_file "$SCRIPT_DIR/.config/fastfetch" "$HOME/.config/fastfetch"
link_file "$SCRIPT_DIR/.config/tealdeer" "$HOME/.config/tealdeer"

echo -e "${GREEN}Installation complete!${NC}"
echo -e "${BLUE}Backups stored in: $BACKUP_DIR${NC}"
