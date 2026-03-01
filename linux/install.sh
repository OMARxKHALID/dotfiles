#!/usr/bin/env bash

# Dotfiles Installation Script (Linux)
# This script creates symlinks from the repository to your home directory.

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Setup backup directory with timestamp
BACKUP_DIR="$HOME/.dotfiles_backups/$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}Starting dotfiles installation...${NC}"

# Function to create a symlink with backup
link_file() {
    local src="$1"
    local dest="$2"

    # Create destination directory if it doesn't exist
    mkdir -p "$(dirname "$dest")"

    if [ -L "$dest" ]; then
        echo -e "${YELLOW}Symlink already exists for $(basename "$dest"). Redoing...${NC}"
        rm "$dest"
    elif [ -e "$dest" ]; then
        # Create backup directory only when needed
        mkdir -p "$BACKUP_DIR"
        echo -e "${YELLOW}Backing up existing file: $dest -> $BACKUP_DIR/$(basename "$dest")${NC}"
        mv "$dest" "$BACKUP_DIR/"
    fi

    echo -e "Linking ${src} -> ${dest}"
    ln -s "$src" "$dest"
}

# --- Core Shell Config ---
link_file "$SCRIPT_DIR/.zshenv" "$HOME/.zshenv"
link_file "$SCRIPT_DIR/.profile" "$HOME/.profile"
link_file "$SCRIPT_DIR/.bashrc" "$HOME/.bashrc"

# --- Scripts & Binaries ---
link_file "$SCRIPT_DIR/.local/bin/switch-wallpaper" "$HOME/.local/bin/switch-wallpaper"
link_file "$SCRIPT_DIR/.local/bin/wallpaper-picker" "$HOME/.local/bin/wallpaper-picker"
chmod +x "$SCRIPT_DIR/.local/bin/switch-wallpaper"
chmod +x "$SCRIPT_DIR/.local/bin/wallpaper-picker"

# --- GNOME Extensions ---
link_file "$SCRIPT_DIR/.local/share/gnome-shell/extensions/wallpaper-picker@omar" "$HOME/.local/share/gnome-shell/extensions/wallpaper-picker@omar"

# --- Config Directories ---
link_file "$SCRIPT_DIR/.config/zsh" "$HOME/.config/zsh"
link_file "$SCRIPT_DIR/.config/aliasrc" "$HOME/.config/aliasrc"
link_file "$SCRIPT_DIR/.config/bat" "$HOME/.config/bat"
link_file "$SCRIPT_DIR/.config/kitty" "$HOME/.config/kitty"
link_file "$SCRIPT_DIR/.config/terminal" "$HOME/.config/terminal"
link_file "$SCRIPT_DIR/.config/dircolors" "$HOME/.config/dircolors"
link_file "$SCRIPT_DIR/.config/yazi" "$HOME/.config/yazi"

echo -e "${GREEN}Installation complete!${NC}"
echo -e "${BLUE}Note: You may need to reload your shell to see all changes.${NC}"
