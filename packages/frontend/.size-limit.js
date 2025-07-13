module.exports = [
  {
    name: 'Main Bundle',
    path: 'dist/assets/index-*.js',
    limit: '150 KB',
  },
  {
    name: 'React Vendor',
    path: 'dist/assets/react-vendor-*.js',
    limit: '150 KB',
  },
  {
    name: 'UI Components',
    path: 'dist/assets/ui-vendor-*.js',
    limit: '100 KB',
  },
  {
    name: 'Data Layer',
    path: 'dist/assets/data-vendor-*.js',
    limit: '75 KB',
  },
  {
    name: 'Segmentation Module',
    path: 'dist/assets/segmentation-*.js',
    limit: '200 KB',
  },
  {
    name: 'Total JS',
    path: 'dist/assets/*.js',
    limit: '1 MB',
  },
  {
    name: 'Total CSS',
    path: 'dist/assets/*.css',
    limit: '150 KB',
  },
];