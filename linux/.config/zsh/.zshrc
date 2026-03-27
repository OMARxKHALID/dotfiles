# Zsh Config

# Section: Instant Prompt (P10k)
typeset -g POWERLEVEL9K_INSTANT_PROMPT=quiet
[[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]] && \
    source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"

# Section: Environment
export ZDOTDIR="$HOME/.config/zsh"
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"
export EDITOR="nano"
export VISUAL="nano"

# Section: Zinit
if [[ ! -f "$HOME/.zinit/bin/zinit.zsh" ]]; then
    command mkdir -p "$HOME/.zinit"
    command git clone https://github.com/zdharma-continuum/zinit.git "$HOME/.zinit/bin"
fi
source "$HOME/.zinit/bin/zinit.zsh"

# Section: Theme
zinit ice depth=1; zinit light romkatv/powerlevel10k
zinit light zsh-users/zsh-completions

# Section: Completion System
autoload -Uz compinit
_comp_path="${XDG_CACHE_HOME:-$HOME/.cache}/zsh/zcompdump-${(%):-%n}"
if [[ -n "$_comp_path"(#qN.mh+24) ]]; then
    compinit -d "$_comp_path"
else
    compinit -C -d "$_comp_path"
fi
zinit cdreplay -q
unset _comp_path

# Section: Binaries (GitHub)
zinit ice as"program" from"gh-r" bpick"*linux-amd64.tar.gz" mv"fastfetch-linux-amd64/usr/bin/fastfetch -> fastfetch" pick"fastfetch"
zinit light fastfetch-cli/fastfetch

zinit ice as"program" from"gh-r" bpick"*linux-x86_64-musl" mv"tealdeer* -> tldr" pick"tldr"
zinit light tealdeer-rs/tealdeer

zinit ice as"program" from"gh-r" bpick"*x86_64-unknown-linux-gnu*" mv"dust*/dust -> dust" pick"dust"
zinit light bootandy/dust

zinit ice as"program" pick"bin/fzf" multisrc"shell/completion.zsh shell/key-bindings.zsh" \
    atclone"./install --bin" atpull"%atclone" \
    atinit"export PATH=\$PWD/bin:\$PATH"
zinit light junegunn/fzf

# Section: Plugins (Lazy)
zinit ice wait"0a" lucid; zinit light Aloxaf/fzf-tab
zinit ice wait"0b" lucid; zinit light zsh-users/zsh-autosuggestions
zinit ice wait"0c" lucid atinit"zpcompinit; zpcdreplay"; zinit light zsh-users/zsh-syntax-highlighting

# Section: History
HISTFILE="${XDG_STATE_HOME:-$HOME/.local/state}/zsh/history"
HISTSIZE=50000
SAVEHIST=50000
setopt share_history
setopt extended_history
setopt hist_ignore_all_dups
setopt hist_expire_dups_first
setopt hist_ignore_space
setopt hist_save_no_dups
setopt hist_reduce_blanks

# Section: Options
setopt autocd
setopt correct
setopt no_beep
setopt interactive_comments
CORRECT_IGNORE='.*'

# Section: Completion Style
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=8'

# Section: FZF Theme (Gruvbox)
export FZF_DEFAULT_OPTS="${FZF_DEFAULT_OPTS} \
  --history=${XDG_STATE_HOME:-$HOME/.local/state}/fzf/history \
  --color=bg+:#3c3836,bg:#282828,spinner:#fb4934,hl:#928374 \
  --color=fg:#ebdbb2,header:#928374,info:#8ec07c,pointer:#fb4934 \
  --color=marker:#fb4934,fg+:#ebdbb2,prompt:#fb4934,hl+:#fb4934"

# Section: Preview Tools
if command -v batcat &> /dev/null; then
    _fzf_preview_cmd="batcat -n --color=always"
elif command -v bat &> /dev/null; then
    _fzf_preview_cmd="bat -n --color=always"
else
    _fzf_preview_cmd="cat"
fi
export FZF_CTRL_T_OPTS="--preview '$_fzf_preview_cmd {}' --bind 'ctrl-/:change-preview-window(down|hidden|)'"

# Section: Integrations
[[ -x "$(command -v zoxide)" ]] && eval "$(zoxide init zsh)"
[[ -f "$HOME/.config/aliasrc" ]] && source "$HOME/.config/aliasrc"
[[ -f "$ZDOTDIR/.p10k.zsh" ]] && source "$ZDOTDIR/.p10k.zsh"
test -r ~/.config/dircolors && eval "$(dircolors -b ~/.config/dircolors)" || eval "$(dircolors -b)"

# Section: Keybindings
bindkey '^R' fzf-history-widget
if command -v rg &> /dev/null; then
    export FZF_DEFAULT_COMMAND='rg --files --hidden --glob "!.git/*"'
    export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
fi

# Section: Utils
alias zshrc='${EDITOR:-nano} $ZDOTDIR/.zshrc'
alias reloadzsh='source $ZDOTDIR/.zshrc'

# opencode
export PATH=/home/omar/.opencode/bin:$PATH
