# Zsh environment

# XDG base directories
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"

# Defaults
export EDITOR="nano"
export VISUAL="$EDITOR"
export INPUTRC="$XDG_CONFIG_HOME/readline/inputrc"
export LESSHISTFILE="$XDG_STATE_HOME/less/history"

# zsh-ai
export ZSH_AI_PROVIDER="gemini"
[[ -f "$ZDOTDIR/.zsh_secrets" ]] && source "$ZDOTDIR/.zsh_secrets"

# PATH
typeset -U path
path=(
    $HOME/bin
    $HOME/.local/bin
    $HOME/.bun/bin
    $path
)
export PATH

# NVM default node
if [[ -f "$HOME/.nvm/alias/default" ]]; then
    _nvm_ver=$(<"$HOME/.nvm/alias/default")
    _nvm_dir=$(ls -d "$HOME/.nvm/versions/node/v${_nvm_ver}"* 2>/dev/null | tail -1)
    [[ -d "$_nvm_dir/bin" ]] && path=("$_nvm_dir/bin" $path)
    unset _nvm_ver _nvm_dir
fi
