# Zsh Config

# Instant Prompt (P10k)
[[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]] && \
    source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"

# Zinit
if [[ ! -f "$HOME/.zinit/bin/zinit.zsh" ]]; then
    command mkdir -p "$HOME/.zinit"
    command git clone https://github.com/zdharma-continuum/zinit.git "$HOME/.zinit/bin"
fi
source "$HOME/.zinit/bin/zinit.zsh"

# Core Plugins
zinit ice depth=1; zinit light romkatv/powerlevel10k
zinit light zsh-users/zsh-completions

# Completion System
autoload -Uz compinit
_comp_path="${XDG_CACHE_HOME:-$HOME/.cache}/zsh/zcompdump-${(%):-%n}"
if [[ -n "$_comp_path"(#qN.mh+24) ]]; then
    compinit -d "$_comp_path"
else
    compinit -C -d "$_comp_path"
fi
zinit cdreplay -q
unset _comp_path

# Lazy Plugins
zinit ice wait"0a" lucid; zinit light Aloxaf/fzf-tab
zinit ice wait"0b" lucid; zinit light zsh-users/zsh-autosuggestions

# History
HISTFILE="${XDG_STATE_HOME:-$HOME/.local/state}/zsh/history"
HISTSIZE=10000
SAVEHIST=10000

# Shell Options
setopt share_history
setopt extended_history
setopt hist_ignore_all_dups
setopt hist_expire_dups_first
setopt hist_ignore_space
setopt hist_save_no_dups
setopt hist_reduce_blanks
setopt autocd correct no_beep
CORRECT_IGNORE='.*'

# Completion Style
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=8'

# FZF Integration
zinit ice as"program" pick"bin/fzf" multisrc"shell/completion.zsh shell/key-bindings.zsh" \
    atclone"./install --bin" atpull"%atclone" \
    atinit"export PATH=\$PWD/bin:\$PATH"
zinit light junegunn/fzf

# Keybindings
bindkey '^R' fzf-history-widget
if command -v rg &> /dev/null; then
    export FZF_DEFAULT_COMMAND='rg --files --hidden --glob "!.git/*"'
    export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
fi

# FZF Theme (Gruvbox)
export FZF_DEFAULT_OPTS="${FZF_DEFAULT_OPTS} \
  --history=${XDG_STATE_HOME:-$HOME/.local/state}/fzf/history \
  --color=bg+:#3c3836,bg:#282828,spinner:#fb4934,hl:#928374 \
  --color=fg:#ebdbb2,header:#928374,info:#8ec07c,pointer:#fb4934 \
  --color=marker:#fb4934,fg+:#ebdbb2,prompt:#fb4934,hl+:#fb4934"

# Preview Tools
if command -v batcat &> /dev/null; then
    _fzf_preview_cmd="batcat -n --color=always"
else
    _fzf_preview_cmd="bat -n --color=always"
fi
export FZF_CTRL_T_OPTS="--preview '$_fzf_preview_cmd {}' --bind 'ctrl-/:change-preview-window(down|hidden|)'"

# Zoxide Integration
if command -v zoxide &> /dev/null; then
    eval "$(zoxide init zsh)"
fi

# Extra Files
[[ -f "$HOME/.config/aliasrc" ]] && source "$HOME/.config/aliasrc"
[[ -f "$ZDOTDIR/.p10k.zsh" ]] && source "$ZDOTDIR/.p10k.zsh"
test -r ~/.config/dircolors && eval "$(dircolors -b ~/.config/dircolors)" || eval "$(dircolors -b)"

# Shortcuts
alias zshrc='${EDITOR:-nano} $ZDOTDIR/.zshrc'
alias reloadzsh='source $ZDOTDIR/.zshrc'

# Highlighting
zinit ice wait"0c" lucid atinit"zpcompinit; zpcdreplay"
zinit light zsh-users/zsh-syntax-highlighting
