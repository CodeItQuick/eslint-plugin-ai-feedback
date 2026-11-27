import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import aiFeedback from './index.js';

export default [
    { ignores: ['tests/fixtures/'] },
    sonarjs.configs.recommended,
    {
        ...unicorn.configs.recommended,
        // The numbered e2e files are unchanged copies of the validator's suite.
        ignores: ['tests/validator-e2e/[0-9]*.test.mjs'],
        rules: {
            ...unicorn.configs.recommended.rules,
            // The ESLint AST uses null.
            'unicorn/no-null': 'off',
            // The repository writes one-line /** */ comments.
            'unicorn/single-line-block-comment-style': 'off',
            'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
            // A rule file name is its rule ID, such as no-env-in-test.
            'unicorn/name-replacements': ['error', { checkFilenames: false }],
        },
    },
    aiFeedback.configs['writing-tests'],
];
