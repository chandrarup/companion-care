#!/usr/bin/env bash
# Build locally and ship to the Vultr server:  scripts/deploy.sh [user@host]   (default from DEPLOY_HOST)
# The server runs the self-contained Nitro build in .output; secrets live in /etc/companion-care.env on the server.
set -euo pipefail
HOST="${1:-${DEPLOY_HOST:?set DEPLOY_HOST or pass user@host}}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/vultr_companion}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new"
REL="$(date +%Y%m%d%H%M%S)"

cd "$(dirname "$0")/.."
npm run build
$SSH "$HOST" "mkdir -p /opt/companion-care/releases/$REL"
rsync -az --delete -e "$SSH" .output "$HOST:/opt/companion-care/releases/$REL/"
$SSH "$HOST" "chown -R companion:companion /opt/companion-care/releases/$REL && ln -sfn /opt/companion-care/releases/$REL /opt/companion-care/current && systemctl restart companion-care && ls -1dt /opt/companion-care/releases/* | tail -n +4 | xargs -r rm -rf"
echo "deployed $REL to $HOST"
