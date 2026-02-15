# Zsh environment

# XDG base directories
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"

# Create XDG directories
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_DATA_HOME" "$XDG_STATE_HOME"

# System defaults
export EDITOR="nano"
export VISUAL="nano"
export INPUTRC="$XDG_CONFIG_HOME/readline/inputrc"
export LESSHISTFILE="$XDG_STATE_HOME/less/history"

# PATH
typeset -U path
path=(
    $HOME/bin
    $HOME/.local/bin
    $HOME/.bun/bin
    $HOME/.nvm/versions/node/v24.13.1/bin
    $path
)
export PATH
