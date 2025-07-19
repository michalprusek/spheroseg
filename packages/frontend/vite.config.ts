import { defineConfig, loadEnv, type PluginOption, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { compression } from 'vite-plugin-compression2';
import staticAssetsPlugin from './vite-static-fix';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables based on mode
  const env = loadEnv(mode, process.cwd(), '');
  const isDevelopment = mode === 'development';
  const isProduction = mode === 'production';

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

  const plugins: PluginOption[] = [
    react(),
    staticAssetsPlugin(),
  ];

  // Add compression plugin for production
  if (isProduction) {
    plugins.push(
      compression({
        algorithm: 'gzip',
        exclude: [/\.(br)$/, /\.(gz)$/],
        threshold: 10240, // Only compress files larger than 10kb
      }) as unknown as Plugin,
      compression({
        algorithm: 'brotliCompress',
        exclude: [/\.(br)$/, /\.(gz)$/],
        threshold: 10240,
      }) as unknown as Plugin
    );
  }

  // Add bundle analyzer in production build with analyze flag
  if (process.env.ANALYZE) {
    plugins.push(
      visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }) as unknown as Plugin
    );
  }

  return {
    plugins,
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@radix-ui/react-dialog',
        '@radix-ui/react-alert-dialog',
        '@radix-ui/react-dropdown-menu',
        'lucide-react',
        'sonner',
        '@tanstack/react-query',
        'socket.io-client',
        'react-hook-form',
        'zod',
        '@hookform/resolvers',
        '@spheroseg/types',
        '@spheroseg/shared',
      ],
      exclude: [],
      esbuildOptions: {
        target: 'es2020',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@spheroseg/shared': path.resolve(__dirname, '../shared'),
        '@spheroseg/types': path.resolve(__dirname, '../types'),
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
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      },
      fs: {
        strict: false, // Allow serving files from outside of root
        allow: ['..'],
      },
      proxy: {
        // Socket.IO proxy - highest priority to avoid conflicts
        '/socket.io': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('Socket.IO proxy error', err);
            });
            proxy.on('proxyReq', (_proxyReq, req) => {
              console.log('Socket.IO Request:', req.method, req.url);
            });
          },
        },
        // Main API proxy
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('API proxy error', err);
            });
            proxy.on('proxyReq', (_proxyReq, req) => {
              console.log('API Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('API Response:', proxyRes.statusCode, req.url);
            });
          },
        },
        // File uploads
        '/uploads': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
      host: '0.0.0.0', // Allow access from any host
      port: 3000,
      strictPort: true, // Don't try other ports if 3000 is taken
      cors: {
        origin: true, // Allow all origins
        credentials: false,
      },
      origin: '*', // Allow all origins
      allowedHosts: ['localhost', 'spherosegapp.utia.cas.cz', 'frontend-dev', '0.0.0.0'], // Allow specific hosts
      hmr: isDevelopment ? {
        port: 3000,
        host: 'localhost',
        protocol: 'ws', // Use ws:// in development to avoid SSL issues
      } : {
        // Production HMR through HTTPS
        clientPort: 443,
        protocol: 'wss',
        host: 'spherosegapp.utia.cas.cz',
        path: '/@hmr',
        timeout: 180000,
        overlay: true,
      },
    },
    // Optimize build
    build: {
      target: 'es2020',
      minify: isProduction ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
        },
      },
      sourcemap: isDevelopment,
      rollupOptions: {
        output: {
          // Manual chunking for better caching
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor';
              }
              if (id.includes('@radix-ui') || id.includes('lucide-react')) {
                return 'ui-vendor';
              }
              if (id.includes('@tanstack') || id.includes('socket.io') || id.includes('zod')) {
                return 'utils-vendor';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'charts-vendor';
              }
              if (id.includes('i18n')) {
                return 'i18n-vendor';
              }
              return 'vendor'; // all other vendor deps
            }
            
            // Feature-based chunks for our code
            if (id.includes('/pages/SignIn') || id.includes('/pages/SignUp') || 
                id.includes('/pages/ForgotPassword') || id.includes('/services/authService')) {
              return 'auth';
            }
            if (id.includes('/pages/ProjectDetail') || id.includes('/services/projectService') ||
                id.includes('/components/project')) {
              return 'project';
            }
            if (id.includes('/segmentation/')) {
              return 'segmentation';
            }
            if (id.includes('/export/') || id.includes('exportFunctions')) {
              return 'export';
            }
            if (id.includes('/pages/Settings') || id.includes('/pages/Profile')) {
              return 'settings';
            }
            if (id.includes('/pages/Dashboard') || id.includes('/components/analytics')) {
              return 'dashboard';
            }
          },
          // Asset naming for better caching
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.');
            const extType = info?.[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType || '')) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/woff|woff2|eot|ttf|otf/i.test(extType || '')) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },
      chunkSizeWarningLimit: 1000,
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Inline assets smaller than 4kb
      assetsInlineLimit: 4096,
      // Report compressed size
      reportCompressedSize: false,
      // Enable build optimizations
      cssMinify: isProduction,
    },
    // Configure base path for production
    base: '/',
    // Improve error handling
    logLevel: 'info',
    // Enable JSON loading
    json: {
      namedExports: true,
      stringify: false,
    },
    // CSS configuration
    css: {
      modules: {
        localsConvention: 'camelCase',
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
        },
      },
    },
  };
});