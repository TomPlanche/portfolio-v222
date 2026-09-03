import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  // `includeIgnoreFile` only reads the root `.gitignore`; it can't nest into
  // `md-to-blog-post/.gitignore`, whose own `/target` is relative to that
  // directory and would resolve wrong (as a root-level `target/`) if read the
  // same way. Rust's build output, not JS, so it has nothing for ESLint to lint.
  { ignores: ['md-to-blog-post/target/**'] },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off',
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      curly: ['error', 'all'],
      // All links in this project are external URLs; base-path resolution is not needed.
      'svelte/no-navigation-without-resolve': 'off',
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
      // No `function` declarations — always `const foo = (...) => {}`.
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],

      // No `function` expressions either, except where an arrow can't stand in
      // (class methods/constructors, object getters/setters, generators).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'FunctionExpression[generator=false]:not(MethodDefinition > FunctionExpression):not(Property[method=true] > FunctionExpression):not(Property[kind=/^(get|set)$/] > FunctionExpression)',
          message: 'Use an arrow function instead of a function expression.'
        }
      ]
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig
      }
    }
  }
);
