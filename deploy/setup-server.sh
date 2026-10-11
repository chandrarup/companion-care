#!/usr/bin/env bash
# One-time server setup (Ubuntu 24.04). Run as root:  bash setup-server.sh "site1.example.com site2.example.com"
# Installs Node 22 and Caddy (automatic HTTPS), a locked-down firewall, and the systemd service.
set -euo pipefail
SITES="${1:?usage: setup-server.sh \"host1 host2\"}"
export DEBIAN_FRONTEND=noninteractive

rm -f /etc/apt/sources.list.d/caddy-stable.list /usr/share/keyrings/caddy-stable-archive-keyring.gpg
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw rsync debian-keyring debian-archive-keyring apt-transport-https

# Node 22
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != "22" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Caddy (Ubuntu's own package; the third-party Caddy apt repo has rate limits that can fail with 402)
rm -f /etc/apt/sources.list.d/caddy-stable.list
if ! command -v caddy >/dev/null; then
  apt-get update -y && apt-get install -y caddy
fi
mkdir -p /etc/caddy

id companion >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin companion
mkdir -p /opt/companion-care/releases
chown -R companion:companion /opt/companion-care

# 1 GB boxes need swap for Node
if ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

cat > /etc/caddy/Caddyfile <<CADDY
${SITES// /, } {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Hourly-ish cleanup of cloned demo voices (biometric data) after 3 hours
mkdir -p /opt/companion-care/tools
(cd /opt/companion-care/tools && [ -d node_modules/pg ] || (npm init -y >/dev/null && npm install --silent pg))
cat > /etc/cron.d/companion-demo-voices <<'CRON'
*/15 * * * * root cd /opt/companion-care/tools && /usr/bin/node --env-file=/etc/companion-care.env cleanup-demo-voices.mjs >> /var/log/demo-voice-cleanup.log 2>&1
CRON
chmod 644 /etc/cron.d/companion-demo-voices

cp /root/companion-care.service /etc/systemd/system/companion-care.service
systemctl daemon-reload
systemctl enable companion-care
echo "setup done"
