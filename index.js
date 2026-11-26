import maxTestLines from './rules/max-test-lines.js';
import noAmbientInput, { inHelper as noAmbientInputInHelper } from './rules/no-ambient-input.js';
import noComputedExpectedValue from './rules/no-computed-expected-value.js';
import noConsoleInTest from './rules/no-console-in-test.js';
import noControlFlowInHelper from './rules/no-control-flow-in-helper.js';
import noControlFlowInTest from './rules/no-control-flow-in-test.js';
import noCopiedHelper from './rules/no-copied-helper.js';
import noDuplicateTestBody from './rules/no-duplicate-test-body.js';
import noEnvInTest from './rules/no-env-in-test.js';
import noFixedSleep, { inHelper as noFixedSleepInHelper } from './rules/no-fixed-sleep.js';
import noFocusedTest from './rules/no-focused-test.js';
import noFoldedComparison from './rules/no-folded-comparison.js';
import noHeldRead from './rules/no-held-read.js';
import noImportedExpectedValue from './rules/no-imported-expected-value.js';
import noNamedExpectedValue from './rules/no-named-expected-value.js';
import noNetworkInTest from './rules/no-network-in-test.js';
import noOneTimeReadAssertion from './rules/no-one-time-read-assertion.js';
import noOwnModuleMock from './rules/no-own-module-mock.js';
import noReassignedLetInTest from './rules/no-reassigned-let-in-test.js';
import noSameNameHelper from './rules/no-same-name-helper.js';
import noSharedState from './rules/no-shared-state.js';
import noUnawaitedAsyncAssertion from './rules/no-unawaited-async-assertion.js';
import noUnrestoredFake from './rules/no-unrestored-fake.js';
import noWeakAssertion from './rules/no-weak-assertion.js';
import requireAssertion from './rules/require-assertion.js';

const plugin = {
    meta: { name: 'eslint-plugin-ai-feedback', version: '0.1.0' },
    rules: {
        'max-test-lines': maxTestLines,
        'no-ambient-input': noAmbientInput,
        'no-ambient-input-in-helper': noAmbientInputInHelper,
        'no-computed-expected-value': noComputedExpectedValue,
        'no-console-in-test': noConsoleInTest,
        'no-control-flow-in-helper': noControlFlowInHelper,
        'no-control-flow-in-test': noControlFlowInTest,
        'no-copied-helper': noCopiedHelper,
        'no-duplicate-test-body': noDuplicateTestBody,
        'no-env-in-test': noEnvInTest,
        'no-fixed-sleep': noFixedSleep,
        'no-fixed-sleep-in-helper': noFixedSleepInHelper,
        'no-focused-test': noFocusedTest,
        'no-folded-comparison': noFoldedComparison,
        'no-held-read': noHeldRead,
        'no-imported-expected-value': noImportedExpectedValue,
        'no-named-expected-value': noNamedExpectedValue,
        'no-network-in-test': noNetworkInTest,
        'no-one-time-read-assertion': noOneTimeReadAssertion,
        'no-own-module-mock': noOwnModuleMock,
        'no-reassigned-let-in-test': noReassignedLetInTest,
        'no-same-name-helper': noSameNameHelper,
        'no-shared-state': noSharedState,
        'no-unawaited-async-assertion': noUnawaitedAsyncAssertion,
        'no-unrestored-fake': noUnrestoredFake,
        'no-weak-assertion': noWeakAssertion,
        'require-assertion': requireAssertion,
    },
};

/** Ported from the writing-tests skill's validate-tests.mjs: its failures are errors, its warnings are warnings. */
const writingTestsRules = {
    // Failures.
    'ai-feedback/no-ambient-input': 'error',
    'ai-feedback/no-control-flow-in-test': 'error',
    'ai-feedback/no-copied-helper': 'error',
    'ai-feedback/no-duplicate-test-body': 'error',
    'ai-feedback/no-fixed-sleep': 'error',
    'ai-feedback/no-focused-test': 'error',
    'ai-feedback/no-folded-comparison': 'error',
    'ai-feedback/no-imported-expected-value': 'error',
    'ai-feedback/no-one-time-read-assertion': 'error',
    'ai-feedback/no-unawaited-async-assertion': 'error',
    'ai-feedback/no-unrestored-fake': 'error',
    'ai-feedback/require-assertion': 'error',
    // Warnings.
    'ai-feedback/max-test-lines': 'warn',
    'ai-feedback/no-ambient-input-in-helper': 'warn',
    'ai-feedback/no-fixed-sleep-in-helper': 'warn',
    'ai-feedback/no-computed-expected-value': 'warn',
    'ai-feedback/no-console-in-test': 'warn',
    'ai-feedback/no-control-flow-in-helper': 'warn',
    'ai-feedback/no-env-in-test': 'warn',
    'ai-feedback/no-held-read': 'warn',
    'ai-feedback/no-named-expected-value': 'warn',
    'ai-feedback/no-network-in-test': 'warn',
    'ai-feedback/no-same-name-helper': 'warn',
    'ai-feedback/no-shared-state': 'warn',
    'ai-feedback/no-weak-assertion': 'warn',
};

const files = ['**/*.{test,spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}'];

plugin.configs = {
    'writing-tests': { name: 'ai-feedback/writing-tests', files, plugins: { 'ai-feedback': plugin }, rules: writingTestsRules },
    /** The validator's `--info` lines too: context for the file being edited. */
    'writing-tests-info': {
        name: 'ai-feedback/writing-tests-info',
        files,
        plugins: { 'ai-feedback': plugin },
        rules: { ...writingTestsRules, 'ai-feedback/no-own-module-mock': 'warn', 'ai-feedback/no-reassigned-let-in-test': 'warn' },
    },
};

export default plugin;
