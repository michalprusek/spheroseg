module.exports = {
  'packages/frontend/src/**/*.{ts,tsx,js,jsx}': [
    'npx eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  'packages/frontend/scripts/**/*.{js,ts}': [
    'prettier --write',
  ],
  'packages/backend/**/*.{ts,js}': [
    'npx eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  'packages/shared/**/*.{ts,tsx}': [
    'npx eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  'packages/types/**/*.ts': [
    'npx eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  'packages/frontend/**/*.{css,scss}': [
    'prettier --write',
  ],
  '**/*.json': [
    'prettier --write',
  ],
  '**/*.md': [
    'prettier --write',
    'markdownlint --fix',
  ],
  '**/*.{yml,yaml}': [
    'prettier --write',
  ],
};