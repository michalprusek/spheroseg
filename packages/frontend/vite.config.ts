import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { compression } from 'vite-plugin-compression2';
import staticAssetsPlugin from './vite-static-fix';
import { getOptimizedViteConfig } from './vite.config.shared';
import { importMapPlugin } from './vite-plugin-import-map';

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


  // Plugin to ensure no bare module imports in production
  const fixBareImports = (): PluginOption => ({
    name: 'fix-bare-imports',
    apply: 'build',
    renderChunk(code, chunk) {
      if (isProduction) {
        // Replace any remaining bare module imports
        let fixedCode = code;
        
        // Fix import statements (both static and dynamic)
        fixedCode = fixedCode.replace(/from\s*["']react["']/g, 'from "https://esm.sh/react@18"');
        fixedCode = fixedCode.replace(/from\s*["']react-dom["']/g, 'from "https://esm.sh/react-dom@18"');
        fixedCode = fixedCode.replace(/import\(["']react["']\)/g, 'import("https://esm.sh/react@18")');
        fixedCode = fixedCode.replace(/import\(["']react-dom["']\)/g, 'import("https://esm.sh/react-dom@18")');
        
        return fixedCode;
      }
      return code;
    },
  });

  const plugins: PluginOption[] = [
    react({
      // Use automatic runtime which doesn't require React imports
      jsxRuntime: 'automatic',
    }),
    isProduction && importMapPlugin(),
    staticAssetsPlugin(),
  ].filter(Boolean) as PluginOption[];

  // Add compression plugin for production
  if (isProduction) {
    plugins.push(
      compression({
        algorithm: 'gzip',
        exclude: [/\.(br)$/, /\.(gz)$/],
        threshold: 10240, // Only compress files larger than 10kb
      }) as any,
      compression({
        algorithm: 'brotliCompress',
        exclude: [/\.(br)$/, /\.(gz)$/],
        threshold: 10240,
      }) as any
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
      }) as any
    );
  }

  // Get optimized configuration
  const baseConfig = {
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
      // Force optimization of React in development too
      force: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@spheroseg/shared': path.resolve(__dirname, '../shared/src'),
        '@spheroseg/types': path.resolve(__dirname, '../types/src'),
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
        // Static assets
        '/assets/illustrations': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
      host: true, // This allows access from any host
      port: 3000,
      strictPort: true, // Don't try other ports if 3000 is taken
      cors: true, // Enable CORS for all requests
      hmr: {
        // Always use secure WebSocket when served over HTTPS
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
      target: 'es2015', // Better browser compatibility
      modulePreload: {
        polyfill: true, // Ensure module preloading works
      },
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
        // Externalize React in production to use import maps
        external: isProduction ? ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'] : [],
        output: {
          // In production, disable manual chunks to bundle everything
          manualChunks: isProduction ? undefined : (id) => {
            // Only use manual chunks in development
            if (id.includes('node_modules/')) {
              // UI libraries
              if (id.includes('@radix-ui') || id.includes('@headlessui')) {
                return 'ui-vendor';
              }
              // Data and utilities
              if (id.includes('@tanstack/react-query') ||
                  id.includes('socket.io-client') ||
                  id.includes('react-hook-form') ||
                  id.includes('zod') ||
                  id.includes('@hookform/resolvers') ||
                  id.includes('lucide-react') ||
                  id.includes('sonner')) {
                return 'utils-vendor';
              }
              // i18n libraries
              if (id.includes('i18next') || id.includes('react-i18next')) {
                return 'i18n-vendor';
              }
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
  
  // Return the configuration without shared optimization to ensure our React handling works
  return baseConfig;
});