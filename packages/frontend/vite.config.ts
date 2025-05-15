import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import staticAssetsPlugin from './vite-static-fix';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables based on mode
  const env = loadEnv(mode, process.cwd(), '');

  // Determine API URL from environment or fallback to default
  const apiUrl = env.VITE_API_URL || 'http://localhost:5001';
  const apiBaseUrl = env.VITE_API_BASE_URL || '/api';
  // Adjust prefixes based on environment variables
  const apiAuthPrefix = env.VITE_API_AUTH_PREFIX ? `/api${env.VITE_API_AUTH_PREFIX}` : '/api/auth';
  const apiUsersPrefix = env.VITE_API_USERS_PREFIX ? `/api${env.VITE_API_USERS_PREFIX}` : '/api/users';

  console.log(`Using API URL: ${apiUrl} for proxy configuration`);
  console.log(`API Base URL: ${apiBaseUrl}`);
  console.log(`Auth Prefix: ${apiAuthPrefix}`);
  console.log(`Users Prefix: ${apiUsersPrefix}`);

  return {
    plugins: [react(), staticAssetsPlugin()] as PluginOption[],
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/icons-material',
        '@mui/material',
        '@radix-ui/react-dialog',
        '@radix-ui/react-alert-dialog',
        '@radix-ui/react-dropdown-menu',
        'lucide-react',
        'sonner'
      ],
      esbuildOptions: {
        target: 'es2020',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@spheroseg/shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    server: {
      watch: {
        ignored: [
          '**/assets/illustrations/**',
          '**/uploads/**',
          '**/node_modules/**',
        ],
        usePolling: true, // Use polling for Docker volumes
      },
      // Allow external access from any host
      allowedHosts: ['localhost', 'spherosegapp.utia.cas.cz', '.utia.cas.cz'],
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      proxy: {
        // Main API proxy with enhanced logging
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          // Keep /api prefix since backend expects it
          rewrite: (path) => path,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (_proxyReq, req) => {
              console.log('Sending Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('Received Response:', proxyRes.statusCode, req.url);
            });
          },
        },
        // Handle auth endpoints with high priority
        [apiAuthPrefix]: {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          // Keep /api prefix since backend expects it
          rewrite: (path) => path,
          // Higher priority for auth endpoints
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('Auth proxy error', err);
            });
            proxy.on('proxyReq', (_proxyReq, req) => {
              console.log('Auth Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('Auth Response:', proxyRes.statusCode, req.url);
            });
          },
        },
        // Handle users endpoints with high priority
        [apiUsersPrefix]: {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          // Keep /api prefix since backend expects it
          rewrite: (path) => path,
        },
        // Handle specific auth endpoints with highest priority
        '/api/auth/login': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          // Keep /api prefix since backend expects it
          rewrite: (path) => path,
        },
        '/api/auth/register': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          // Keep /api prefix since backend expects it
          rewrite: (path) => path,
        },
        '/uploads': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
        '/assets/illustrations': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path, // Don't rewrite socket.io paths
        },
      },
      host: '0.0.0.0',
      port: 3000,
      strictPort: true, // Don't try other ports if 3000 is taken
      cors: true, // Enable CORS for all requests
      hmr: {
        // Use HTTPS port for WebSocket when site is served over HTTPS
        clientPort: 443, // Connect to the public-facing HTTPS port
        protocol: 'wss', // Explicitly use wss for secure websockets
        path: '/@hmr',
        // Make sure HMR is more resilient
        timeout: 180000,
        overlay: true,
      },
      // Allow all hosts
      origin: '*',
    },
    // Optimize build
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 1000,
    },
    // Configure base path for production
    base: '/',
    // Improve error handling
    logLevel: 'info',
  };
});
