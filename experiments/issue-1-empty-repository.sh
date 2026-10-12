#!/usr/bin/env bash
# Reproduces issue #1: pushing code of an empty source repository
# (deep-foundation/chatgpt-discord-bot has size 0 and no branches on GitHub).
# GitHub URLs are redirected to local bare repositories via url.insteadOf.
# Usage: experiments/issue-1-empty-repository.sh [script.js]
set -u
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="${1:-$REPO_DIR/push-code-commits.js}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export GIT_CONFIG_GLOBAL="$WORK/gitconfig" GIT_CONFIG_NOSYSTEM=1
git config --global init.defaultBranch main
git config --global user.name test && git config --global user.email test@example.com
git config --global url."file://$WORK/github/".insteadOf https://github.com/
git init -q --bare "$WORK/github/deep-foundation/chatgpt-discord-bot.git"
git init -q --bare "$WORK/github/link-foundation/chatgpt-discord-bot.git"
mkdir -p "$WORK/data/deep-foundation"
echo '[{"name":"chatgpt-discord-bot"}]' > "$WORK/data/deep-foundation/org.repos.json"
# Same clone that pull.js performs; for an empty repository HEAD is an unborn "main".
git clone -q https://github.com/deep-foundation/chatgpt-discord-bot.git "$WORK/data/deep-foundation/chatgpt-discord-bot" 2>&1
ln -s "$REPO_DIR/node_modules" "$WORK/node_modules"
cp "$SCRIPT" "$WORK/script.mjs"; cp "$REPO_DIR/lib.js" "$WORK/lib.js"
cd "$WORK"
GITHUB_ACCESS_TOKEN=x SOURCE_ORGANIZATION=deep-foundation TARGET_ORGANIZATION=link-foundation \
  timeout 60 node script.mjs < /dev/null
echo "exit status: $?"
