module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'airbnb-base',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  rules: {
    'no-console': 'error',
    'no-shadow': 'off',
    'no-restricted-syntax': 'off',
    'import/prefer-default-export': 'off',
    'import/eslint-disable-next-line': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-shadow': ['error'],
    '@typescript-eslint/no-unused-vars': ['error'],

    // Allow .js extensions in imports for TypeScript files
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'always',
        ts: 'never',
      },
    ],
  },
};
