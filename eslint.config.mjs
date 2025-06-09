import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config([
  js.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,

  // Prettier
  {
    files: ["**/*.{js,ts,tsx}"],

    rules: {
      "prettier/prettier": ["error", { singleQuote: true }],
    },
  },

  // Import
  {
    files: ["**/*.{js,ts,tsx}"],
    extends: [
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    settings: {
      "import/extensions": [".js", ".ts", ".tsx"],
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
        node: {
          extensions: [".js", ".jsx"],
        },
      },
    },
  },

  // Ignores
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/jest.config.cjs"],
  },
]);

// [
//   // Apply to all files
//   js.configs.recommended,

//   // TypeScript files
//   {
//     files: ['**/*.ts', '**/*.tsx'],
//     languageOptions: {
//       parser: tsParser,
//       parserOptions: {
//         ecmaVersion: 'latest',
//         sourceType: 'module',
//       },
//     },
//     plugins: {
//       '@typescript-eslint': tsPlugin,
//     },
//     rules: {
//       // ESLint rules
//       'no-console': 'error',
//       'no-restricted-syntax': 'off',

//       // Disable base rules that are covered by TypeScript
//       'no-unused-vars': 'off',
//       'no-shadow': 'off',

//       // TypeScript rules
//       '@typescript-eslint/no-unused-vars': 'error',
//       '@typescript-eslint/no-explicit-any': 'error',
//       '@typescript-eslint/no-shadow': 'error',
//     },
//   },

//   // JavaScript files
//   {
//     files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
//     rules: {
//       'no-console': 'error',
//       'no-restricted-syntax': 'off',
//     },
//   },

//   // Ignores
//   {
//     ignores: [
//       'node_modules/**',
//       'dist/**',
//       'build/**',
//       'coverage/**',
//       '**/*.d.ts',
//     ],
//   },
// ];
