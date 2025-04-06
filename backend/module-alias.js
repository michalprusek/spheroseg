require('module-alias/register');
const path = require('path');

// Use src directory for development and dist for production
const isProduction = process.env.NODE_ENV === 'production';
const baseDir = isProduction ? 'dist' : 'src';

module.exports = require('module-alias').addAliases({
  '@config': path.join(__dirname, `${baseDir}/config`),
  '@db': path.join(__dirname, `${baseDir}/db`),
  '@auth': path.join(__dirname, `${baseDir}/auth`),
  '@storage': path.join(__dirname, `${baseDir}/storage`),
  '@middlewares': path.join(__dirname, `${baseDir}/middlewares`)
});