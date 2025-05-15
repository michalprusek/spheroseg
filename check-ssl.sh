#!/bin/bash

# This script checks the SSL certificate for spherosegapp.utia.cas.cz

DOMAIN="spherosegapp.utia.cas.cz"
echo "Checking SSL certificate for $DOMAIN..."

# Check if the domain resolves
echo -n "DNS resolution: "
if host $DOMAIN >/dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED - Domain does not resolve"
  exit 1
fi

# Check if the port is open
echo -n "Port 443 connectivity: "
if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$DOMAIN/443" 2>/dev/null; then
  echo "OK"
else
  echo "FAILED - Cannot connect to port 443"
  exit 1
fi

# Check certificate details using OpenSSL
echo "Certificate details:"
echo "===================="
openssl s_client -connect $DOMAIN:443 -servername $DOMAIN </dev/null 2>/dev/null | openssl x509 -noout -dates -issuer -subject

# Check certificate validity using curl
echo -n "Certificate validity: "
if curl -sS --head https://$DOMAIN 2>&1 | grep -q "200 OK"; then
  echo "OK - HTTPS is working properly"
else
  CURL_RESULT=$(curl -sS -I https://$DOMAIN 2>&1)
  if echo "$CURL_RESULT" | grep -q "200 OK"; then
    echo "OK - HTTPS is working properly"
  else
    echo "WARNING - HTTPS might have issues:"
    echo "$CURL_RESULT" | head -10
  fi
fi

# Check certificate expiration
echo -n "Certificate expiration: "
EXPIRY_DATE=$(openssl s_client -connect $DOMAIN:443 -servername $DOMAIN </dev/null 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

if [ $DAYS_LEFT -gt 30 ]; then
  echo "OK - Certificate expires in $DAYS_LEFT days"
elif [ $DAYS_LEFT -gt 0 ]; then
  echo "WARNING - Certificate expires in $DAYS_LEFT days"
else
  echo "CRITICAL - Certificate has expired!"
fi

echo "SSL check completed."