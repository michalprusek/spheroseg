/**
 * Shared Vite Configuration for Chunk Optimization
 * 
 * This configuration ensures consistent chunking strategies across
 * development and production builds.
 */

import type { UserConfig } from 'vite';

/**
 * Vendor chunk configuration
 * Groups third-party dependencies into logical chunks
 */
export const vendorChunks = {
  // Core React ecosystem
  react: ['react', 'react-dom', 'react-router-dom'],
  
  // UI libraries
  ui: [
    '@radix-ui',
    '@headlessui',
    'framer-motion',
    '@emotion',
    'styled-components',
  ],
  
  // Data fetching and state management
  data: [
    '@tanstack/react-query',
    'axios',
    'socket.io-client',
    'zustand',
    'immer',
  ],
  
  // Utilities
  utils: [
    'lodash',
    'lodash-es',
    'date-fns',
    'uuid',
    'clsx',
    'class-variance-authority',
  ],
  
  // Visualization and charts
  viz: [
    'recharts',
    'd3',
    'd3-scale',
    'd3-shape',
    'konva',
    'react-konva',
  ],
  
  // Forms and validation
  forms: [
    'react-hook-form',
    '@hookform/resolvers',
    'yup',
    'zod',
  ],
  
  // Internationalization
  i18n: [
    'react-i18next',
    'i18next',
    'i18next-browser-languagedetector',
    'i18next-http-backend',
  ],
  
  // Large libraries that should be separate
  heavy: [
    'xlsx',
    'jspdf',
    'html2canvas',
    '@monaco-editor/react',
    'jimp',
  ],
};

/**
 * Manual chunks function for Rollup
 * Intelligently splits vendor libraries into separate chunks
 */
export function manualChunks(id: string): string | undefined {
  // Skip non-node_modules
  if (!id.includes('node_modules')) {
    return undefined;
  }
  
  // Extract package name
  const packageName = id.split('node_modules/')[1].split('/')[0];
  
  // Find which vendor group this package belongs to
  for (const [groupName, packages] of Object.entries(vendorChunks)) {
    if (packages.some(pkg => packageName.includes(pkg))) {
      return `vendor-${groupName}`;
    }
  }
  
  // Default vendor chunk for unmatched packages
  return 'vendor-misc';
}

/**
 * Shared build optimization configuration
 */
export const buildOptimization: UserConfig['build'] = {
  target: 'es2020',
  
  rollupOptions: {
    output: {
      manualChunks,
      
      // Ensure consistent chunk names
      chunkFileNames: (chunkInfo) => {
        const facadeModuleId = chunkInfo.facadeModuleId;
        if (facadeModuleId && facadeModuleId.includes('src/pages/')) {
          // Page chunks
          const name = facadeModuleId.split('/').pop()?.replace('.tsx', '');
          return `pages/[name]-[hash].js`;
        }
        if (chunkInfo.name.startsWith('vendor-')) {
          // Vendor chunks
          return `vendor/[name]-[hash].js`;
        }
        // Other chunks
        return `chunks/[name]-[hash].js`;
      },
      
      // Asset file names
      assetFileNames: (assetInfo) => {
        const extType = assetInfo.name?.split('.').pop() || '';
        if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
          return `images/[name]-[hash][extname]`;
        }
        if (/woff2?|ttf|eot/i.test(extType)) {
          return `fonts/[name]-[hash][extname]`;
        }
        return `assets/[name]-[hash][extname]`;
      },
    },
  },
  
  // Chunk size warnings
  chunkSizeWarningLimit: 500, // 500kb
  
  // CSS code splitting
  cssCodeSplit: true,
  
  // Source maps for production (hidden from users)
  sourcemap: 'hidden',
  
  // Minification options
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true,
      drop_debugger: true,
      pure_funcs: ['console.log', 'console.debug'],
    },
    format: {
      comments: false,
    },
  },
};

/**
 * Performance optimization plugins configuration
 */
export const performancePlugins = {
  // Bundle analyzer (only in analyze mode)
  analyze: process.env.ANALYZE === 'true',
  
  // Compression
  compress: {
    gzip: true,
    brotli: true,
    threshold: 10240, // 10kb
  },
  
  // Preload directives
  preload: {
    include: 'initial',
    fileWhitelist: [/\.woff2$/, /\.css$/],
  },
  
  // Prefetch directives
  prefetch: {
    include: 'asyncChunks',
    fileBlacklist: [/\.map$/, /hot-update\.js$/],
  },
};

/**
 * Get complete Vite config with optimizations
 */
export function getOptimizedViteConfig(baseConfig: UserConfig = {}): UserConfig {
  return {
    ...baseConfig,
    
    build: {
      ...baseConfig.build,
      ...buildOptimization,
      rollupOptions: {
        ...baseConfig.build?.rollupOptions,
        ...buildOptimization.rollupOptions,
        output: {
          ...baseConfig.build?.rollupOptions?.output,
          ...buildOptimization.rollupOptions?.output,
        },
      },
    },
    
    // Dependency optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
      ],
      exclude: [
        '@vite/client',
        '@vite/env',
      ],
    },
    
    // Performance hints
    server: {
      ...baseConfig.server,
      warmup: {
        clientFiles: [
          './src/App.tsx',
          './src/pages/Dashboard.tsx',
          './src/pages/ProjectDetail.tsx',
        ],
      },
    },
  };
}

// Export all configurations
export default {
  vendorChunks,
  manualChunks,
  buildOptimization,
  performancePlugins,
  getOptimizedViteConfig,
};