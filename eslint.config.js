import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/', 'storage/', 'coverage/', 'backups/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
    },
  },
  {
    // Fronteiras da arquitetura (docs/arquitetura.md, seção 6):
    // - um módulo só usa outro pela API pública dele (index.js);
    // - dentro de src/, nada de caminhos relativos que saiam da própria pasta: use #config,
    //   #compartilhado/* ou #modulos/*.
    files: ['src/**/*.js'],
    ignores: ['src/app.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Use os imports #config, #compartilhado/* ou #modulos/* em vez de caminhos relativos.',
            },
            {
              regex: '^#modulos/[^/]+/(?!index\\.js$)',
              message: 'Importe outro módulo só pelo index.js dele (API pública).',
            },
          ],
        },
      ],
    },
  },
  {
    // O app.js é o único lugar que registra as rotas de cada módulo.
    files: ['src/app.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^#modulos/[^/]+/(?!(index|rotas|auth)\\.js$)',
              message: 'O app.js só importa o index.js e as rotas dos módulos.',
            },
          ],
        },
      ],
    },
  },
  {
    // A camada compartilhada não conhece os módulos de negócio.
    files: ['src/compartilhado/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['#modulos/*'], message: 'compartilhado/ não depende de modulos/.' }] },
      ],
    },
  },
  prettier,
];
