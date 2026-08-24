#!/usr/bin/env bash
# One-shot provision/redeploy script for a small (1GB RAM) Ubuntu droplet.
# Safe to re-run: skips steps that are already done and reuses existing config.
#
#   curl -fsSL https://raw.githubusercontent.com/bcglassman/test/claude/website-cms-integration-v84v1e/scripts/deploy-droplet.sh -o /tmp/deploy.sh
#   nohup bash /tmp/deploy.sh > /tmp/deploy.log 2>&1 &
#   disown
#   tail -f /tmp/deploy.log
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

APP_DIR=/opt/cookie-training
REPO_URL=https://github.com/bcglassman/test.git
BRANCH=claude/website-cms-integration-v84v1e
DROPLET_IP=$(curl -s -4 https://ifconfig.me || hostname -I | awk '{print $1}')

echo "==> Disk/memory before we start"
df -h /
free -h

# Clean up a leftover extra swapfile from an earlier attempt at this, if present.
if [ -f /swapfile2 ]; then
  echo "==> Removing unneeded extra swapfile"
  swapoff /swapfile2 || true
  rm -f /swapfile2
  sed -i '\#/swapfile2#d' /etc/fstab
fi

echo "==> Ensuring 2GB swap exists"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "   swapfile already exists, skipping"
  swapon --show=NAME | grep -q /swapfile || swapon /swapfile
fi

echo "==> Installing base packages (git, nginx, build tools)"
apt-get update -y
apt-get install -y ca-certificates curl git nginx build-essential

echo "==> Installing Node.js 22.x"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Cloning/updating the app"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> Writing .env.local"
if [ ! -f "$APP_DIR/.env.local" ]; then
  PAYLOAD_SECRET=$(openssl rand -hex 32)
  cat > "$APP_DIR/.env.local" <<EOF
PAYLOAD_SECRET=$PAYLOAD_SECRET
DATABASE_URI=file:./cookie-training.db
PAYLOAD_PUBLIC_SERVER_URL=http://$DROPLET_IP
EOF
else
  echo "   .env.local already exists, leaving it alone"
fi

echo "==> Installing dependencies"
cd "$APP_DIR"
npm install

echo "==> Seeding the database (no-op if already seeded)"
SEED_ADMIN_EMAIL="admin@cookietraining.app"
SEED_ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)
SEED_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" npm run seed || true

echo "==> Building for production"
npm run build

echo "==> Installing systemd service"
cat > /etc/systemd/system/cookie-training.service <<EOF
[Unit]
Description=Cookie Training (Next.js + Payload CMS)
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env.local
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOME=/root
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cookie-training
systemctl restart cookie-training

echo "==> Configuring nginx"
cat > /etc/nginx/sites-available/cookie-training <<'EOF'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/cookie-training /etc/nginx/sites-enabled/cookie-training
nginx -t
systemctl restart nginx
systemctl enable nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  echo "==> ufw is active, allowing HTTP/HTTPS"
  ufw allow 'Nginx Full' || true
fi

echo ""
echo "================================================================"
echo " DEPLOY_FINISHED"
sleep 5
systemctl --no-pager status cookie-training | head -6
echo ""
df -h /
echo ""
echo " Site:        http://$DROPLET_IP"
echo " Sessions:    http://$DROPLET_IP/sessions"
echo " Admin panel: http://$DROPLET_IP/admin"
echo ""
echo " (Admin login was printed the first time this ran, in this same log"
echo " if that step actually created a user — otherwise your existing"
echo " admin login from before still applies.)"
echo "================================================================"
