module.exports = {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
  jsxSingleQuote: false, // Prefer double quotes for JSX attributes
  arrowParens: 'always', // Always include parens around arrow function parameters
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      options: {
        parser: 'typescript',
      },
    },
  ],
};
