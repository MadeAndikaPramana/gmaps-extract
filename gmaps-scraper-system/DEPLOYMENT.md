# Production Deployment Guide

This guide covers deploying the Google Maps Scraper System to production.

## Server Requirements

### Minimum Specifications
- **CPU**: 2 cores (4 recommended)
- **RAM**: 4GB (8GB recommended)
- **Storage**: 20GB+ (depends on data volume)
- **OS**: Ubuntu 20.04+ / Debian 11+ / macOS

### Software Requirements
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- PM2 (process manager)
- Nginx (optional, for reverse proxy)

## Installation Steps

### 1. Setup System User

\`\`\`bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash gmaps
sudo su - gmaps
\`\`\`

### 2. Clone and Setup Application

\`\`\`bash
cd /home/gmaps
# Copy your application files here
cd gmaps-scraper-system
npm install
\`\`\`

### 3. Configure Production Environment

Create `.env.production`:

\`\`\`env
DATABASE_URL="postgresql://gmaps_user:SECURE_PASSWORD@localhost:5432/gmaps_production"
REDIS_URL="redis://localhost:6379"
DISCORD_WEBHOOK_URL="your_webhook_url"
NODE_ENV="production"
\`\`\`

### 4. Setup PostgreSQL

\`\`\`bash
# Create production database
sudo -u postgres psql
CREATE DATABASE gmaps_production;
CREATE USER gmaps_user WITH ENCRYPTED PASSWORD 'SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE gmaps_production TO gmaps_user;
\q
\`\`\`

Run migrations:

\`\`\`bash
npx prisma migrate deploy
npx prisma generate
\`\`\`

### 5. Setup Redis

\`\`\`bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Enable persistence
sudo vim /etc/redis/redis.conf
# Set: appendonly yes

# Start Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server
\`\`\`

### 6. Build Application

\`\`\`bash
npm run build
\`\`\`

### 7. Install PM2

\`\`\`bash
npm install -g pm2
\`\`\`

### 8. Create PM2 Ecosystem File

Create `ecosystem.config.js`:

\`\`\`javascript
module.exports = {
  apps: [
    {
      name: 'gmaps-web',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'gmaps-worker',
      script: 'npm',
      args: 'run worker',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '2G',
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 10000,
    },
  ],
}
\`\`\`

### 9. Start Application with PM2

\`\`\`bash
# Create logs directory
mkdir -p logs

# Start applications
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions printed by the command
\`\`\`

### 10. Verify Deployment

\`\`\`bash
# Check application status
pm2 status

# View logs
pm2 logs gmaps-web
pm2 logs gmaps-worker

# Monitor resources
pm2 monit
\`\`\`

## Nginx Reverse Proxy (Optional)

If you want to expose the app on port 80/443:

### 1. Install Nginx

\`\`\`bash
sudo apt-get install nginx
\`\`\`

### 2. Create Nginx Configuration

Create `/etc/nginx/sites-available/gmaps-scraper`:

\`\`\`nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # For SSE (Server-Sent Events)
        proxy_buffering off;
        proxy_cache off;
    }

    client_max_body_size 10M;
}
\`\`\`

Enable the site:

\`\`\`bash
sudo ln -s /etc/nginx/sites-available/gmaps-scraper /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
\`\`\`

### 3. SSL with Let's Encrypt

\`\`\`bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
\`\`\`

## Security Best Practices

### 1. Firewall Configuration

\`\`\`bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
\`\`\`

### 2. PostgreSQL Security

\`\`\`bash
# Edit PostgreSQL config
sudo vim /etc/postgresql/13/main/pg_hba.conf

# Only allow local connections
# local   all             all                                     peer
# host    all             all             127.0.0.1/32            md5
\`\`\`

### 3. Redis Security

\`\`\`bash
# Edit Redis config
sudo vim /etc/redis/redis.conf

# Bind to localhost only
bind 127.0.0.1

# Set password
requirepass YOUR_REDIS_PASSWORD

# Update REDIS_URL in .env
REDIS_URL="redis://:YOUR_REDIS_PASSWORD@localhost:6379"
\`\`\`

### 4. File Permissions

\`\`\`bash
# Secure .env file
chmod 600 .env

# Secure application files
chown -R gmaps:gmaps /home/gmaps/gmaps-scraper-system
\`\`\`

## Monitoring and Maintenance

### PM2 Commands

\`\`\`bash
# View status
pm2 status

# View logs
pm2 logs
pm2 logs gmaps-web --lines 100
pm2 logs gmaps-worker --lines 100

# Restart applications
pm2 restart all
pm2 restart gmaps-web
pm2 restart gmaps-worker

# Stop applications
pm2 stop all

# Delete from PM2
pm2 delete all
\`\`\`

### Database Maintenance

\`\`\`bash
# Backup database
pg_dump -U gmaps_user gmaps_production > backup_$(date +%Y%m%d).sql

# Clean old jobs (older than 30 days)
# Create a cron job or manual cleanup script
\`\`\`

### Log Rotation

Create `/etc/logrotate.d/gmaps-scraper`:

\`\`\`
/home/gmaps/gmaps-scraper-system/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 gmaps gmaps
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
\`\`\`

## Backup Strategy

### 1. Database Backups

\`\`\`bash
# Create backup script
cat > /home/gmaps/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/gmaps/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U gmaps_user gmaps_production | gzip > $BACKUP_DIR/db_$DATE.sql.gz
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /home/gmaps/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /home/gmaps/backup.sh
\`\`\`

### 2. Application Files Backup

\`\`\`bash
# Backup exports directory
rsync -av /home/gmaps/gmaps-scraper-system/exports/ /backup/exports/
\`\`\`

## Scaling Considerations

### Vertical Scaling
- Increase RAM for larger jobs
- More CPU cores for faster processing
- SSD storage for better database performance

### Horizontal Scaling (Advanced)
- Multiple worker instances (requires coordination)
- Load balancer for web interface
- PostgreSQL replication
- Redis Cluster

## Troubleshooting Production Issues

### High Memory Usage
\`\`\`bash
# Check PM2 memory usage
pm2 monit

# Restart if needed
pm2 restart gmaps-worker
\`\`\`

### Database Connection Issues
\`\`\`bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
psql -U gmaps_user -d gmaps_production -c "SELECT * FROM pg_stat_activity;"
\`\`\`

### Worker Crashed
\`\`\`bash
# Check logs
pm2 logs gmaps-worker --err --lines 100

# PM2 will auto-restart, but you can manually restart
pm2 restart gmaps-worker
\`\`\`

## Health Checks

Create a health check endpoint and monitor with:
- Uptime Robot
- Pingdom
- Custom monitoring scripts

## Support

For production issues, check:
1. PM2 logs: `pm2 logs`
2. System logs: `journalctl -u nginx -f`
3. Database logs: `/var/log/postgresql/`
4. Redis logs: `/var/log/redis/`
