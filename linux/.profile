# Login environment

# PATH
[ -d "$HOME/bin" ] && PATH="$HOME/bin:$PATH"
[ -d "$HOME/.local/bin" ] && PATH="$HOME/.local/bin:$PATH"
[ -d "$HOME/.bun/bin" ] && PATH="$HOME/.bun/bin:$PATH"

# NVM
export NVM_DIR="$HOME/.nvm"
if [ -f "$NVM_DIR/alias/default" ]; then
    _nvm_ver=$(cat "$NVM_DIR/alias/default")
    for _nvm_dir in "$NVM_DIR"/versions/node/v"$_nvm_ver"*; do :; done
    [ -d "$_nvm_dir/bin" ] && PATH="$_nvm_dir/bin:$PATH"
    unset _nvm_ver _nvm_dir
fi
export PATH

# Bootstrap Bash
[ -n "$BASH_VERSION" ] && [ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"
