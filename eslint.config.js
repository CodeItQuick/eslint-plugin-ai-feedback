import sonarjs from 'eslint-plugin-sonarjs';
import aiFeedback from './index.js';

export default [
    { ignores: ['tests/fixtures/'] },
    sonarjs.configs.recommended,
    aiFeedback.configs['writing-tests'],
];
