# WebSocket Configuration Fixes

## Issues Fixed

### 1. WebSocket Connection to Production URL
**Problem**: SegmentationProgress component was attempting to connect to production URL (spherosegapp.utia.cas.cz) instead of using relative path for local development.

**Solution**: 
- Fixed `SegmentationProgress.tsx` to use relative path (`''`) instead of `origin`
- Updated `socketClient.ts` to always use relative path for Socket.IO connections
- Added proper Socket.IO proxy configuration to nginx.conf

### 2. Missing Socket.IO Proxy in NGINX
**Problem**: NGINX configuration was missing Socket.IO WebSocket proxy, causing connection failures.

**Solution**: Added Socket.IO location block to nginx.conf:
```nginx
location /socket.io/ {
    proxy_pass http://spheroseg-backend:5001/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # ... additional headers ...
}
```

### 3. Server Name Order in NGINX
**Problem**: Server name order prioritized production domain over localhost.

**Solution**: Reordered server_name to prioritize localhost for development:
```nginx
server_name localhost spherosegapp.utia.cas.cz;
```

## Configuration Details

### Frontend Socket Client (`socketClient.ts`)
- Always uses relative path (`''`) for connection
- Works in both development (with proxy) and production environments
- Configuration:
  ```typescript
  const socketUrl = ''; // Empty string means relative to current origin
  ```

### Backend Socket.IO (`socket.ts`)
- CORS configuration uses `ALLOWED_ORIGINS` environment variable
- Supports multiple origins separated by commas
- Falls back to `*` if not configured

### NGINX Proxy
- Proxies `/socket.io/` requests to backend port 5001
- Handles WebSocket upgrade headers
- Long timeout settings for persistent connections (3600s read timeout)
- Buffering disabled for real-time communication

## Testing

To verify WebSocket connection:
1. Open browser developer tools
2. Go to Network tab and filter by WS (WebSocket)
3. You should see successful connection to `/socket.io/`
4. Check Console for "WebSocket connected" messages

## Deployment Notes

For production deployment:
- Ensure `ALLOWED_ORIGINS` includes production domain
- SSL certificates must be valid for WebSocket connections
- NGINX must have proper WebSocket proxy configuration