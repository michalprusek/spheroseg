/**
 * Lint-staged configuration for Spheroseg
 * Runs linting and formatting on staged files
 */

module.exports = {
  // Frontend files
  'packages/frontend/**/*.{ts,tsx,js,jsx}': [
    'npx eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  
  // Backend files  
  'packages/backend/**/*.{ts,js}': [
    'npx eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  
  // Shared package files
  'packages/shared/**/*.{ts,tsx}': [
    'npx eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  
  // Types package files
  'packages/types/**/*.ts': [
    'npx eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  
  // Python files (ML package) - disabled for now, requires setup
  // 'packages/ml/**/*.py': [
  //   'python -m black',
  //   'python -m isort',
  //   'python -m flake8',
  // ],
  
  // CSS/SCSS files
  'packages/frontend/**/*.{css,scss}': [
    'prettier --write',
  ],
  
  // JSON files
  '**/*.json': [
    'prettier --write',
  ],
  
  // Markdown files
  '**/*.md': [
    'prettier --write',
    // markdownlint disabled for now - install with: npm install --save-dev markdownlint-cli
    // 'markdownlint --fix',
  ],
  
  // YAML files
  '**/*.{yml,yaml}': [
    'prettier --write',
  ],
  
  // Package.json files - disabled npm audit for pre-commit (too slow)
  // '**/package.json': [
  //   'npm audit --audit-level=moderate',
  // ],
  
  // Docker files - disabled hadolint for now (requires installation)
  // '**/Dockerfile*': [
  //   'hadolint',
  // ],
};