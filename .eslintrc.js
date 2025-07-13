module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  env: {
    browser: true,
    node: true,
    es6: true,
    jest: true
  },
  rules: {
    // Zde můžete přidat nebo přepsat pravidla podle potřeby
    'react/react-in-jsx-scope': 'off', // Není potřeba pro React 17+
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Může být užitečné pro postupné typování
    '@typescript-eslint/no-explicit-any': 'warn', // Varovat před explicitním any
    'no-console': 'warn', // Varovat před použitím console.log
    // Allow unused variables that start with underscore
    '@typescript-eslint/no-unused-vars': ['error', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_',
      'ignoreRestSiblings': true 
    }],
  },
  overrides: [
    {
      files: ['*.js', '*.jsx'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off' // Povolit require v JS souborech (např. konfiguračních)
      }
    }
  ]
};
