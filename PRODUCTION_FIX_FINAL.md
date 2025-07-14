# Final Production Fix for spherosegapp.utia.cas.cz

## Issue
The production server shows error: `Failed to resolve module specifier "react"`

## Solution
Using Import Maps to resolve bare module specifiers in the browser.

## Implementation

### 1. Created Import Map Plugin (`vite-plugin-import-map.ts`)
```typescript
export function importMapPlugin(): Plugin {
  return {
    name: 'vite-plugin-import-map',
    transformIndexHtml(html) {
      const importMap = `
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.2.0",
        "react-dom": "https://esm.sh/react-dom@18.2.0",
        "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
        "react/jsx-runtime": "https://esm.sh/react@18.2.0/jsx-runtime"
      }
    }
    </script>`;
      return html.replace('<head>', '<head>\n' + importMap);
    },
  };
}
```

### 2. Updated `vite.config.ts`
- Added import map plugin for production
- Externalized React modules to use import maps
- Used automatic JSX runtime

### 3. Updated `Dockerfile.prod`
- Added `COPY packages/frontend/vite-plugin-import-map.ts ./`

## Deployment Instructions

### 1. Update Production Server
```bash
# SSH to production
ssh user@spherosegapp.utia.cas.cz

# Navigate to project
cd /path/to/spheroseg

# Pull latest changes
git pull origin main
```

### 2. Rebuild and Deploy
```bash
# Rebuild frontend
docker-compose build frontend-prod

# Recreate container
docker-compose stop frontend-prod
docker-compose rm -f frontend-prod
docker-compose up -d frontend-prod
```

### 3. Verify
1. Open https://spherosegapp.utia.cas.cz/
2. Check browser console - no module resolution errors
3. View page source - verify import map is present
4. Test application functionality

## Browser Compatibility
Import maps are supported in:
- Chrome/Edge 89+
- Firefox 108+
- Safari 16.4+

For older browsers, consider using es-module-shims polyfill.

## Alternative if Import Maps Don't Work
If the production server has issues with import maps, use the bundled approach:
1. Remove `importMapPlugin` from vite.config.ts
2. Remove `external: ['react', 'react-dom']` from rollupOptions
3. Let Vite bundle React into the application

## Testing
The solution is working locally:
- Import map is correctly injected into HTML
- React modules are loaded from esm.sh CDN
- No module resolution errors
- Application functions normally