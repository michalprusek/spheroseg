import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

// Custom chunk splitting strategy
function customChunkSplitPlugin() {
  return {
    name: 'custom-chunk-split',
    config() {
      return {
        build: {
          rollupOptions: {
            output: {
              manualChunks: (id: string) => {
                // React ecosystem
                if (id.includes('node_modules/react/') || 
                    id.includes('node_modules/react-dom/') ||
                    id.includes('node_modules/react-router')) {
                  return 'react-vendor';
                }
                
                // UI libraries
                if (id.includes('@radix-ui') || 
                    id.includes('@headlessui') ||
                    id.includes('framer-motion') ||
                    id.includes('sonner')) {
                  return 'ui-vendor';
                }
                
                // Data fetching and state
                if (id.includes('@tanstack/react-query') ||
                    id.includes('axios') ||
                    id.includes('socket.io')) {
                  return 'data-vendor';
                }
                
                // Heavy visualization libraries (async)
                if (id.includes('konva') ||
                    id.includes('recharts') ||
                    id.includes('d3')) {
                  return 'viz-vendor';
                }
                
                // Utilities
                if (id.includes('lodash') ||
                    id.includes('date-fns') ||
                    id.includes('uuid')) {
                  return 'utils-vendor';
                }
                
                // i18n
                if (id.includes('i18next') ||
                    id.includes('react-i18next')) {
                  return 'i18n-vendor';
                }
                
                // Remaining node_modules
                if (id.includes('node_modules/')) {
                  return 'vendor';
                }
              },
            },
          },
        },
      };
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-syntax-dynamic-import'],
        ],
      },
    }),
    
    // Split vendor chunks
    splitVendorChunkPlugin(),
    
    // Custom chunk splitting
    customChunkSplitPlugin(),
    
    // Compression plugins
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240,
    }),
    
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    }),
    
    // Bundle visualization (only in analyze mode)
    process.env.ANALYZE && visualizer({
      template: 'treemap',
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: './dist/analyze.html',
    }),
  ].filter(Boolean),
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@spheroseg/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  
  build: {
    target: 'es2018',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV !== 'production',
    
    // Rollup options
    rollupOptions: {
      output: {
        // File naming
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: 'assets/[name]-[hash].[ext]',
        
        // Advanced chunking
        manualChunks: undefined, // Handled by plugin
      },
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
        ecma: 2018,
      },
    },
    
    // Asset inlining threshold
    assetsInlineLimit: 4096,
    
    // Report compressed size
    reportCompressedSize: true,
  },
  
  // Optimization flags
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'axios',
    ],
    exclude: [
      '@spheroseg/shared',
    ],
    esbuildOptions: {
      target: 'es2018',
    },
  },
  
  // Preview server
  preview: {
    port: 4173,
    strictPort: false,
    compress: true,
  },
  
  // Development server
  server: {
    port: 3000,
    strictPort: false,
    hmr: {
      overlay: true,
    },
  },
  
  // Worker configuration
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/worker-[name]-[hash].js',
      },
    },
  },
});

// Add build performance tracking
if (process.env.NODE_ENV === 'production') {
  console.time('Build Time');
  process.on('exit', () => {
    console.timeEnd('Build Time');
  });
}