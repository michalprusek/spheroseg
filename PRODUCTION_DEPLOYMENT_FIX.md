# Production Deployment Fix for spherosegapp.utia.cas.cz

## Issue
The production server at https://spherosegapp.utia.cas.cz/ shows a blank page with the error:
```
Uncaught ReferenceError: React is not defined at index-DrQJyU_b.js:87:214350
```

## Root Cause
The production build was generating ES modules with bare specifiers (e.g., `from "react"`), which browsers cannot resolve. The bundler was not properly including React in the main bundle.

## Solution Implemented

### 1. Load React from CDN
Modified `vite.config.ts` to:
- Use classic JSX runtime to ensure React imports
- Load React and ReactDOM from CDN in production
- Externalize React modules to use global variables

### 2. Key Configuration Changes

#### vite.config.ts
```typescript
// Plugin to inject React CDN in production
const injectReactCDN = (): PluginOption => ({
  name: 'inject-react-cdn',
  transformIndexHtml(html) {
    if (isProduction) {
      const reactCDN = `
    <!-- React from CDN for production -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script>
      window.React = window.React || React;
      window.ReactDOM = window.ReactDOM || ReactDOM;
    </script>
`;
      return html.replace('</head>', `${reactCDN}\n  </head>`);
    }
    return html;
  },
});

// React plugin configuration
react({
  jsxRuntime: 'classic',  // Force classic runtime
  jsxImportSource: undefined,
}),

// Build configuration
rollupOptions: {
  external: isProduction ? ['react', 'react-dom'] : [],
  output: {
    globals: isProduction ? {
      react: 'React',
      'react-dom': 'ReactDOM',
    } : undefined,
  }
}
```

## Deployment Steps

### 1. Update Code on Production Server
```bash
# SSH to production server
ssh user@spherosegapp.utia.cas.cz

# Navigate to project directory
cd /path/to/spheroseg

# Pull latest changes
git pull origin main
```

### 2. Rebuild Frontend
```bash
# Using Docker Compose
docker-compose build frontend-prod

# Or using npm directly
cd packages/frontend
npm install
npm run build
```

### 3. Deploy New Build
```bash
# Restart frontend container
docker-compose stop frontend-prod
docker-compose rm -f frontend-prod
docker-compose up -d frontend-prod

# Or copy built files to web server
cp -r packages/frontend/dist/* /var/www/html/
```

### 4. Clear Cache
```bash
# Clear nginx cache if applicable
nginx -s reload

# Clear CDN cache if using one
# (commands depend on CDN provider)
```

### 5. Verify Deployment
1. Open https://spherosegapp.utia.cas.cz/ in incognito/private browser window
2. Check browser console - should have no React errors
3. Verify React is loaded from CDN in Network tab
4. Test application functionality

## Alternative Solutions (if CDN is not preferred)

### Option 1: Bundle React Inline
Remove the CDN approach and ensure React is bundled:
```typescript
// Remove external configuration
rollupOptions: {
  external: [],  // Don't externalize anything
  output: {
    manualChunks: undefined,  // Let Vite handle chunking
  }
}
```

### Option 2: Use Import Maps (Modern Browsers Only)
Add import map to HTML:
```html
<script type="importmap">
{
  "imports": {
    "react": "/assets/react.production.min.js",
    "react-dom": "/assets/react-dom.production.min.js"
  }
}
</script>
```

## Testing
The fix has been tested locally and works correctly:
- No "React is not defined" errors
- React loads from CDN before application code
- All functionality works as expected

## Monitoring
After deployment, monitor:
- Browser console for errors
- Network tab for failed resource loads
- Application functionality
- Performance metrics (CDN vs bundled)