# My Development Environment Setup

A carefully curated collection of development environment configurations, focusing on modern web development with React, TypeScript, and Node.js. This repository serves as both a backup of my personal settings and a reference for other developers.

## 🚀 Features

- **Terminal Enhancement**: Custom Starship prompt configuration for PowerShell
- **VS Code Optimization**: Curated extensions and settings for web development
- **Modern Font Setup**: JetBrains Mono Nerd Font configuration for clear code readability
- **Development Tools**: Configurations for ESLint, Prettier, and other essential tools

## 🗂️ Repository Structure

```
.
├── terminal/
│   ├── starship.toml    # Custom terminal prompt configuration
│   ├── starship.md      # Terminal setup instructions
│   └── icons.md         # Terminal icons guide and configuration
├── vscode/
│   ├── settings.json    # VS Code preferences and settings
│   └── extensions.md    # Curated list of VS Code extensions
└── nerd-font.md         # Font installation guide
```

## 💻 Tech Stack

- **Primary Languages**: TypeScript, JavaScript
- **Frameworks**: React, Next.js
- **Package Managers**: npm, bun
- **Editor**: VS Code with 40+ productivity extensions
- **Terminal**: PowerShell with Starship prompt

## 🛠️ Quick Setup

1. **Clone this repository**

   ```bash
   git clone https://github.com/yourusername/my-dev-setup.git
   ```

2. **Install Prerequisites**

   - Install JetBrains Mono Nerd Font (see nerd-font.md)
   - Install Starship prompt (see terminal/starship.md)
   - Install VS Code extensions (see vscode/extensions.md)

3. **Apply Configurations**
   - Copy starship.toml to ~/.config/starship/
   - Copy VS Code settings to your settings.json

## 🔄 Keeping Updated

To update VS Code extensions list:

```powershell
code --list-extensions | ForEach-Object { "- **[$_](https://marketplace.visualstudio.com/items?itemName=$_)**" } | Set-Content vscode/extensions.md
```

## 📞 Contact

- Email: mirxaumar1212@gmail.com
- Instagram: [@omarxoxo.\_](https://www.instagram.com/omarxoxo._)

## 📄 License

This repository is released under the MIT License. Feel free to use, modify, and share.
