# Zsh config

# P10k prompt
[[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]] && \
    source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"

# Zinit bootstrap
if [[ ! -f "$HOME/.zinit/bin/zinit.zsh" ]]; then
    command mkdir -p "$HOME/.zinit"
    command git clone https://github.com/zdharma-continuum/zinit.git "$HOME/.zinit/bin"
fi
source "$HOME/.zinit/bin/zinit.zsh"

# Core plugins
zinit light zsh-users/zsh-completions
zinit ice depth=1; zinit light romkatv/powerlevel10k

# Completion init
autoload -Uz compinit
_comp_path="${XDG_CACHE_HOME:-$HOME/.cache}/zsh/zcompdump-${(%):-%n}"
compinit -i -d "$_comp_path"
zinit cdreplay -q
unset _comp_path

# Lazy plugins
zinit ice wait"0a" lucid; zinit light Aloxaf/fzf-tab
zinit ice wait"0b" lucid; zinit light zsh-users/zsh-autosuggestions

# History settings
HISTFILE="${XDG_STATE_HOME:-$HOME/.local/state}/zsh/history"
HISTSIZE=10000
SAVEHIST=10000

# History options
setopt share_history          # Share history between all sessions
setopt extended_history       # Record timestamp in history
setopt hist_ignore_all_dups   # Delete old duplicate when new one is added
setopt hist_expire_dups_first # Expire duplicates first when trimming history
setopt hist_ignore_space      # Don't record lines starting with a space
setopt hist_save_no_dups      # Don't save duplicates to file
setopt hist_reduce_blanks     # Remove superfluous blanks

# Shell options
CORRECT_IGNORE='.*'
setopt autocd correct no_beep

# Styling
(( $+commands[dircolors] )) && eval "$(dircolors -b)"
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=8'

# FZF integration
zinit ice as"program" pick"bin/fzf" multisrc"shell/completion.zsh shell/key-bindings.zsh" \
    atclone"./install --bin" atpull"%atclone" \
    atinit"export PATH=\$PWD/bin:\$PATH"
zinit light junegunn/fzf
bindkey '^R' fzf-history-widget

if command -v rg &> /dev/null; then
    export FZF_DEFAULT_COMMAND='rg --files --hidden --glob "!.git/*"'
    export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
fi

# Persistent FZF search history
export FZF_DEFAULT_OPTS="${FZF_DEFAULT_OPTS} --history=${XDG_STATE_HOME:-$HOME/.local/state}/fzf/history"

# Zoxide integration
if command -v zoxide &> /dev/null; then
    eval "$(zoxide init zsh)"
fi

# External aliases
[[ -f "$HOME/.config/aliasrc" ]] && source "$HOME/.config/aliasrc"

# Config shortcuts
alias zshrc='${EDITOR:-nano} $ZDOTDIR/.zshrc'
alias reloadzsh='source $ZDOTDIR/.zshrc'

# Syntax highlighting
zinit ice wait"0c" lucid
zinit light zsh-users/zsh-syntax-highlighting

# P10k theme
[[ ! -f "$ZDOTDIR/.p10k.zsh" ]] || source "$ZDOTDIR/.p10k.zsh"
