import eslint from '@eslint/js'
import * as eslintPluginImportX from 'eslint-plugin-import-x'
import eslintPluginN from 'eslint-plugin-n'
import eslintPluginPromise from 'eslint-plugin-promise'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'

export default typescriptEslint.config(
  {
    ignores: [
      '**/*.d.ts',
      'node_modules',
    ]
  },
  {
    extends: [
      eslint.configs.recommended,
      ...typescriptEslint.configs.recommended,
    ],
    plugins: {
      'import-x': eslintPluginImportX,
      n: eslintPluginN,
      promise: eslintPluginPromise
    },
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        parser: typescriptEslint.parser
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none' }
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-useless-constructor': 'error',
      'no-console': ['error', { allow: ['info', 'warn', 'error', 'table'] }],
      'no-debugger': 'error',
      'no-void': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error',
      'no-lone-blocks': 'error',
      'no-return-assign': ['error', 'except-parens'],
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-useless-call': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-constructor': 'off',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-var': 'error',
      'no-caller': 'error',
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-implied-eval': 'error',
      'no-iterator': 'error',
      'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
      'no-multi-str': 'error',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-octal-escape': 'error',
      'no-proto': 'error',
      'no-undef-init': 'error',
      'accessor-pairs': ['error', { setWithoutGet: true, enforceForClassMembers: true }],
      'array-callback-return': ['error', { allowImplicit: false, checkForEach: false }],
      'default-case-last': 'error',
      'new-cap': ['error', { newIsCap: true, capIsNew: false, properties: true }],
      'no-unneeded-ternary': ['error', { defaultAssignment: false }],
      'object-shorthand': ['warn', 'properties'],
      'one-var': ['error', { initialized: 'never' }],
      'prefer-const': ['error', { destructuring: 'all' }],
      'prefer-promise-reject-errors': 'error',
      'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],
      'symbol-description': 'error',
      'unicode-bom': ['error', 'never'],
      yoda: ['error', 'never'],
      'import-x/export': 'error',
      'import-x/first': 'error',
      'import-x/no-absolute-path': ['error', { esmodule: true, commonjs: true, amd: false }],
      'import-x/no-duplicates': 'error',
      'import-x/no-named-default': 'error',
      'import-x/no-webpack-loader-syntax': 'error',
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'object',
            'type'
          ],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true }
        }
      ],
      'n/handle-callback-err': ['error', '^(err|error)$'],
      'n/no-callback-literal': 'error',
      'n/no-deprecated-api': 'error',
      'n/no-exports-assign': 'error',
      'n/no-new-require': 'error',
      'n/no-path-concat': 'error',
      'n/process-exit-as-throw': 'error',
      'promise/param-names': 'error'
    }
  },
)
