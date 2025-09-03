module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: true, // Add browser environment
  },
  extends: ['eslint:recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      plugins: ['@typescript-eslint'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'no-unused-vars': 'off', // Use TypeScript rule instead
      },
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/test.ts'],
      env: {
        jest: true,
        mocha: true,
        jasmine: true, // Add Jasmine environment for Angular tests
        browser: true, // Browser environment for tests
      },
      globals: {
        jasmine: 'readonly',
        spyOn: 'readonly',
        fail: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off', // Allow unused vars in tests
        'no-console': 'off',
      },
    },
    {
      // Angular/Frontend specific files
      files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
      env: {
        browser: true,
        es2022: true,
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        ErrorEvent: 'readonly',
      },
      rules: {
        'no-console': ['warn', { allow: ['warn', 'error'] }], // Allow console in Angular apps with warning
      },
    },
    {
      files: ['.eslintrc.js'],
      env: {
        node: true,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'script',
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/', '.angular/', 'cdk.out/'],
};
