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

has() { command -v "$1" >/dev/null 2>&1; }

install_packages() {
    echo -e "${BLUE}Installing apt packages...${NC}"
    sudo apt update
    grep -vE '^\s*(#|$)' "$SCRIPT_DIR/packages.txt" | xargs sudo apt install -y

    echo -e "${BLUE}Installing pipx tools...${NC}"
    for tool in subliminal ffsubsync yt-dlp; do
        has "$tool" || pipx install "$tool"
    done

    if ! has bun && [ ! -x "$HOME/.bun/bin/bun" ]; then
        echo -e "${BLUE}Installing Bun...${NC}"
        curl -fsSL https://bun.sh/install | bash
    fi

    if ! has cargo && [ ! -x "$HOME/.cargo/bin/cargo" ]; then
        echo -e "${BLUE}Installing Rust...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
    fi
    [ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

    if ! has yazi; then
        echo -e "${BLUE}Installing Yazi...${NC}"
        cargo install --locked yazi-fm yazi-cli
    fi

    if ! has kitty && [ ! -x "$HOME/.local/kitty.app/bin/kitty" ]; then
        echo -e "${BLUE}Installing Kitty...${NC}"
        curl -L https://sw.kovidgoyal.net/kitty/installer.sh | sh /dev/stdin launch=n
    fi
    if [ -x "$HOME/.local/kitty.app/bin/kitty" ]; then
        mkdir -p "$HOME/.local/bin"
        ln -sf "$HOME/.local/kitty.app/bin/kitty" "$HOME/.local/kitty.app/bin/kitten" "$HOME/.local/bin/"
    fi

    if ! fc-list | grep -qi "JetBrainsMono Nerd Font"; then
        echo -e "${BLUE}Installing JetBrainsMono Nerd Font...${NC}"
        local font_dir="$HOME/.local/share/fonts/JetBrainsNerdFonts"
        local font_zip
        font_zip="$(mktemp --suffix=.zip)"
        mkdir -p "$font_dir"
        curl -fL -o "$font_zip" https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.zip
        unzip -oq "$font_zip" -d "$font_dir"
        rm -f "$font_zip"
        fc-cache -f "$font_dir"
    fi

    if has gnome-terminal && has dconf; then
        local profile
        profile="$(gsettings get org.gnome.Terminal.ProfilesList default 2>/dev/null | tr -d "'")"
        if [ -n "$profile" ]; then
            echo -e "${BLUE}Applying GNOME Terminal Gruvbox theme...${NC}"
            dconf load "/org/gnome/terminal/legacy/profiles:/:$profile/" < "$SCRIPT_DIR/.config/terminal/tcs-gruvbox.dconf"
        fi
    fi

    if [ "$(basename "$SHELL")" != "zsh" ]; then
        echo -e "${BLUE}Setting Zsh as the default shell...${NC}"
        chsh -s "$(command -v zsh)"
    fi
}

echo -e "${BLUE}Starting dotfiles installation...${NC}"

[ "$1" = "--packages" ] && install_packages

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
link_file "$SCRIPT_DIR/.config/readline" "$HOME/.config/readline"
link_file "$SCRIPT_DIR/.config/git" "$HOME/.config/git"
link_file "$SCRIPT_DIR/.config/ripgrep" "$HOME/.config/ripgrep"

# Package Tooling
if command -v ya >/dev/null 2>&1; then
    echo -e "${BLUE}Installing Yazi packages...${NC}"
    ya pkg install
fi

echo -e "${GREEN}Installation complete!${NC}"
echo -e "${BLUE}Backups stored in: $BACKUP_DIR${NC}"
