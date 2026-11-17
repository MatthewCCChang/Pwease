import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', '**/.expo/**', '**/.wrangler/**',
      '**/coverage/**', '.tools/**', '.cache/**',
      'apps/mobile/android/**', 'apps/mobile/ios/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}', 'packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'better-auth', message: 'Use better-auth/react or better-auth/client in mobile; the server belongs in apps/api.' }],
        patterns: [{
          group: ['@pwease/api', '@pwease/api/*', '**/apps/api/**', '**/api/src/**', 'drizzle-orm', 'drizzle-orm/*', '@neondatabase/serverless', 'better-auth/*', '!better-auth/react', '!better-auth/client'],
          message: 'Server integrations belong in apps/api, never the mobile bundle or shared package.',
        }],
      }],
    },
  },
);
