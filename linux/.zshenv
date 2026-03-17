# Zsh Environment

# ZDOTDIR
export ZDOTDIR="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"

# Bootstrap
[[ -f "$ZDOTDIR/.zshenv" ]] && source "$ZDOTDIR/.zshenv"
