#!/usr/bin/env bash
# Setup Mac: skills de video para Claude Code. Uso: bash setup.sh
set -e

# 1. Dependencias
command -v brew >/dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install ffmpeg node python@3.12
npm install -g @anthropic-ai/claude-code

# 2. Carpetas
mkdir -p ~/BriteVideo/{input,output,assets/{logos,music,sfx,broll},work}

# 3. Skills (revisa cada repo antes de instalar)
claude plugin marketplace add https://github.com/itpartypattaya/reels-montage.git
claude plugin install it-reelsmaker@itparty
npx skills add heygen-com/hyperframes --skill embedded-captions -g -a claude-code
npx skills add heygen-com/hyperframes --skill hyperframes -g -a claude-code
npx skills add heygen-com/hyperframes --skill media-use -g -a claude-code
npx remotion skills add

# 4. Prompt maestro
cp "$(dirname "$0")/PROMPT.md" ~/BriteVideo/PROMPT.md
echo "Listo. Pon videos en ~/BriteVideo/input, luego: cd ~/BriteVideo && claude"
