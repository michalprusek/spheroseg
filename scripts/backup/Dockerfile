FROM alpine:3.18

# Install required packages
RUN apk add --no-cache \
    postgresql16-client \
    aws-cli \
    bash \
    gzip \
    coreutils \
    curl

# Create backup user
RUN addgroup -g 1001 -S backup && \
    adduser -S backup -u 1001 -G backup

# Create backup directory
RUN mkdir -p /backup && \
    chown -R backup:backup /backup

# Copy backup script
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Install supercronic for cron jobs
RUN curl -fsSLO "https://github.com/aptible/supercronic/releases/download/v0.2.1/supercronic-linux-amd64" && \
    chmod +x supercronic-linux-amd64 && \
    mv supercronic-linux-amd64 /usr/local/bin/supercronic

# Create crontab file
RUN echo "0 2 * * * /usr/local/bin/backup.sh" > /etc/crontab

# Switch to backup user
USER backup

# Set working directory
WORKDIR /backup

# Health check
HEALTHCHECK --interval=30m --timeout=10s --start-period=1m --retries=3 \
  CMD test -f /backup/last_backup_timestamp || exit 1

# Run supercronic
CMD ["/usr/local/bin/supercronic", "/etc/crontab"]