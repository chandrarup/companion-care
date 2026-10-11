#!/usr/bin/env bash
# Run on the server:  nohup bash /root/enable-domain.sh companioncare.chandrarupdaka.work &
# Waits until the domain's A record points at this server, then adds it to Caddy (automatic HTTPS) and keeps the sslip.io name.
set -u
DOMAIN="${1:?usage: enable-domain.sh domain}"
IP="$(curl -s https://api.ipify.org || curl -s http://169.254.169.254/v1/interfaces/0/ipv4/address)"
for i in $(seq 1 2880); do   # about 24 hours
  if getent ahostsv4 "$DOMAIN" | awk '{print $1}' | grep -qx "$IP"; then
    cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN, $IP.sslip.io {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
    systemctl reload caddy && echo "$(date -Is) enabled $DOMAIN" >> /var/log/enable-domain.log
    exit 0
  fi
  sleep 30
done
echo "$(date -Is) gave up waiting for $DOMAIN -> $IP" >> /var/log/enable-domain.log
