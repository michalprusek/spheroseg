# SSL Configuration for Spheroseg Application

This document explains the SSL setup for the Spheroseg application at https://spherosegapp.utia.cas.cz.

## SSL Implementation Overview

The application uses Let's Encrypt for free, automated SSL certificates with the following configuration:

- **Nginx**: Acts as a reverse proxy and handles SSL termination
- **Certbot**: Manages certificate issuance and renewal
- **Let's Encrypt**: Certificate Authority providing the SSL certificates

## Initial Setup

The setup uses the following components:

1. **Docker services**:
   - `nginx`: Serves the application with SSL
   - `certbot`: Manages SSL certificates

2. **Directory structure**:
   ```
   letsencrypt/
   ├── etc/letsencrypt/      # Certificate storage
   ├── var/lib/letsencrypt/  # Certbot data
   └── webroot/              # Used for HTTP challenge verification
   ```

3. **Fallback certificates**:
   - Self-signed certificates in `ssl/` directory used as fallback

## Certificate Management

### Initial Certificate Issuance

To obtain the first Let's Encrypt certificate:

1. Run the initialization script:
   ```bash
   ./init-letsencrypt.sh
   ```

   This script:
   - Creates necessary directories
   - Starts Nginx with a temporary self-signed certificate
   - Requests proper Let's Encrypt certificates using HTTP challenge
   - Reloads Nginx to use the new certificates

### Automatic Certificate Renewal

Certificates are automatically renewed by the Certbot container, which:
- Runs in the background
- Checks certificate expiration every 12 hours
- Renews certificates when they're within 30 days of expiration
- Restarts Nginx to load new certificates

### Manual Certificate Renewal

To manually renew certificates:

```bash
docker-compose run --rm certbot renew
docker-compose exec nginx nginx -s reload
```

## Verification

To verify the SSL setup is working:

1. Run the check script:
   ```bash
   ./check-ssl.sh
   ```

2. Check your SSL configuration online:
   - Use [SSL Labs](https://www.ssllabs.com/ssltest/) 
   - Enter domain: spherosegapp.utia.cas.cz

## Troubleshooting

### Common Issues

1. **Certificate not found**:
   - Check that the paths in `nginx.conf` match the actual certificate paths
   - Verify that the domain name is correct in all configurations

2. **Renewal failures**:
   - Ensure port 80 is accessible for HTTP challenge
   - Check Certbot logs: `docker-compose logs certbot`

3. **Browser security warnings**:
   - Clear browser cache
   - Verify certificate validity with `check-ssl.sh`

### Log Locations

- **Nginx logs**: 
  ```bash
  docker-compose logs nginx
  ```

- **Certbot logs**:
  ```bash
  docker-compose logs certbot
  ```

## Maintenance

For long-term maintenance:

1. **Monitor certificates**:
   - Run `./check-ssl.sh` periodically
   - Set up monitoring for certificate expiration

2. **Certificate backups**:
   - Backup the `letsencrypt/` directory 
   - Store backups securely off-site

3. **Updates**:
   - Keep Docker images updated
   - Review Let's Encrypt's policy changes

## Advanced Configuration

The current SSL configuration uses modern security settings:

- TLS 1.2 and 1.3 protocols only
- Secure cipher suites
- HTTP Strict Transport Security (HSTS)
- Security headers

To modify SSL parameters, edit the SSL section in `nginx.conf`.