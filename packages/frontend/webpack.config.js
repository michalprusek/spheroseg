const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].chunk.js',
    clean: true,
  },
  
  optimization: {
    moduleIds: 'deterministic',
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      cacheGroups: {
        // Vendor splitting
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true,
        },
        
        // React ecosystem
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'react-vendor',
          priority: 20,
        },
        
        // UI libraries
        ui: {
          test: /[\\/]node_modules[\\/](@radix-ui|@headlessui|framer-motion|sonner)[\\/]/,
          name: 'ui-vendor',
          priority: 15,
        },
        
        // Data and state management
        data: {
          test: /[\\/]node_modules[\\/](@tanstack\/react-query|axios|socket\.io)[\\/]/,
          name: 'data-vendor',
          priority: 15,
        },
        
        // Utilities
        utils: {
          test: /[\\/]node_modules[\\/](lodash|date-fns|uuid)[\\/]/,
          name: 'utils-vendor',
          priority: 10,
        },
        
        // Heavy visualization libraries
        visualization: {
          test: /[\\/]node_modules[\\/](konva|recharts|d3)[\\/]/,
          name: 'viz-vendor',
          priority: 10,
          chunks: 'async',
        },
        
        // Common shared code
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
        
        // Async common chunks
        asyncCommon: {
          minChunks: 2,
          chunks: 'async',
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8,
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
            drop_console: process.env.NODE_ENV === 'production',
          },
          mangle: {
            safari10: true,
          },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true,
          },
        },
        parallel: true,
      }),
    ],
  },
  
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              '@babel/preset-typescript',
            ],
            plugins: [
              '@babel/plugin-syntax-dynamic-import',
              '@babel/plugin-proposal-class-properties',
            ],
          },
        },
      },
    ],
  },
  
  plugins: [
    // Bundle analyzer (disabled by default)
    process.env.ANALYZE && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
      generateStatsFile: true,
      statsFilename: 'bundle-stats.json',
    }),
    
    // Compression
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
    }),
    
    // Brotli compression
    new CompressionPlugin({
      filename: '[path][base].br',
      algorithm: 'brotliCompress',
      test: /\.(js|css|html|svg)$/,
      compressionOptions: {
        level: 11,
      },
      threshold: 10240,
      minRatio: 0.8,
    }),
  ].filter(Boolean),
  
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
    assetFilter: function (assetFilename) {
      return assetFilename.endsWith('.js');
    },
  },
};