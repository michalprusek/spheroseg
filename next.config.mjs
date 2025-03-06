/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'localhost', 
      '127.0.0.1',
      'minio',
      'minio.spheroseg-network', 
      'spheroseg-minio', 
      'postgres',
      'browser-tools',
      'chrome',
      'api',
      'next',
    ],
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'minio',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'spheroseg-minio',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'minio.spheroseg-network',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3001',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
    formats: ['image/webp'],
    minimumCacheTTL: 60,
  },
  webpack: (config, { isServer, dev }) => {
    // Exclude test directories from the build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/.git/**', 
        '**/node_modules/**', 
        '**/MCP/**', 
        '**/.next/**', 
        '**/.vscode/**', 
        '**/public/**',
        '**/.DS_Store',
        '**/tmp/**',
        '**/dist/**'
      ],
      poll: false,
      aggregateTimeout: 500, // Increased to 500ms
      followSymlinks: false,
    };

    // Development mode optimizations
    if (dev) {
      // Limit change detection to 1 second
      config.watchOptions.aggregateTimeout = 1000;
      
      // Disable minification in dev for faster compilation
      config.optimization.minimize = false;
    }

    // Fix for server-side rendering
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }

    return config;
  },
  // Disable React strict mode to help with hydration issues
  reactStrictMode: false,
  
  // Skip type checking in production build to speed it up
  typescript: {
    // Don't run type checking during build, since we've already done it locally
    ignoreBuildErrors: true,
  },
  
  // Configure ESLint to be less strict for now
  eslint: {
    // Only warn on ESLint errors, don't fail the build
    ignoreDuringBuilds: true,
  },
  
  // Disable static page generation in production
  output: 'standalone',
  
  // Set all pages to be generated only on client (SPA)
  // (only if explicitly set for production)
  ...(process.env.NODE_ENV === 'production' && process.env.NEXT_EXPORT ? { output: 'export' } : {}),
  
  // Configure page extensions to include both tsx and jsx
  pageExtensions: ['tsx', 'jsx', 'js', 'ts'],
  
  // Development optimizations
  swcMinify: true,
  poweredByHeader: false,
  compress: true,
  
  // Limit number of recompilations
  devIndicators: {
    buildActivityPosition: 'bottom-right',
  },
  
  // Dev server configuration
  onDemandEntries: {
    // Time in ms to keep pages in memory
    maxInactiveAge: 300 * 1000, // 5 minutes
    // Max number of pages to keep in cache
    pagesBufferLength: 2,
  },
  
  // Disable telemetry
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },

  // CORS settings for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
      {
        source: '/api/proxy/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=300' },
        ],
      },
    ];
  },
};

export default nextConfig;