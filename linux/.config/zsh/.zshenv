# Zsh Environment

# Section: XDG Base Directories
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"

# Section: Directory Bootstrap
[[ -d "$XDG_CACHE_HOME/zsh" ]] || mkdir -p "$XDG_CACHE_HOME/zsh" "$XDG_STATE_HOME"/{zsh,fzf,less,bash}

# Section: Defaults
skip_global_compinit=1
export EDITOR="nano"
export VISUAL="$EDITOR"
export INPUTRC="$XDG_CONFIG_HOME/readline/inputrc"
export LESSHISTFILE="$XDG_STATE_HOME/less/history"
export RIPGREP_CONFIG_PATH="$XDG_CONFIG_HOME/ripgrep/ripgreprc"
export AGENT_BROWSER_EXECUTABLE_PATH="/usr/bin/helium"

# Section: PATH
typeset -U path
path=(
    $HOME/bin
    $HOME/.local/bin
    $HOME/.cargo/bin
    $HOME/.bun/bin
    $HOME/.local/share/pnpm
    $HOME/.opencode/bin
    $HOME/.kilo/bin
    $HOME/.codeaf/bin
    $path
)
export PATH

# Section: Tooling Environment
export PNPM_HOME="$XDG_DATA_HOME/pnpm"
if [[ -f "$HOME/.nvm/alias/default" ]]; then
    _nvm_ver=$(<"$HOME/.nvm/alias/default")
    _nvm_dir=$(ls -d "$HOME/.nvm/versions/node/v${_nvm_ver}"* 2>/dev/null | tail -1)
    [[ -d "$_nvm_dir/bin" ]] && path=("$_nvm_dir/bin" $path)
    unset _nvm_ver _nvm_dir
fi
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
