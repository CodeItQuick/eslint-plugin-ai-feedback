import maxTestLines from './rules/max-test-lines.js';
import noAmbientInput, { inHelper as noAmbientInputInHelper } from './rules/no-ambient-input.js';
import noComputedExpectedValue from './rules/no-computed-expected-value.js';
import noConsoleInTest from './rules/no-console-in-test.js';
import noControlFlowInHelper from './rules/no-control-flow-in-helper.js';
import noControlFlowInTest from './rules/no-control-flow-in-test.js';
import noCopiedHelper from './rules/no-copied-helper.js';
import noDuplicateTestBody from './rules/no-duplicate-test-body.js';
import noEnvironmentInTest from './rules/no-env-in-test.js';
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
        'writing-tests/max-test-lines': maxTestLines,
        'writing-tests/no-ambient-input': noAmbientInput,
        'writing-tests/no-ambient-input-in-helper': noAmbientInputInHelper,
        'writing-tests/no-computed-expected-value': noComputedExpectedValue,
        'writing-tests/no-console-in-test': noConsoleInTest,
        'writing-tests/no-control-flow-in-helper': noControlFlowInHelper,
        'writing-tests/no-control-flow-in-test': noControlFlowInTest,
        'writing-tests/no-copied-helper': noCopiedHelper,
        'writing-tests/no-duplicate-test-body': noDuplicateTestBody,
        'writing-tests/no-env-in-test': noEnvironmentInTest,
        'writing-tests/no-fixed-sleep': noFixedSleep,
        'writing-tests/no-fixed-sleep-in-helper': noFixedSleepInHelper,
        'writing-tests/no-focused-test': noFocusedTest,
        'writing-tests/no-folded-comparison': noFoldedComparison,
        'writing-tests/no-held-read': noHeldRead,
        'writing-tests/no-imported-expected-value': noImportedExpectedValue,
        'writing-tests/no-named-expected-value': noNamedExpectedValue,
        'writing-tests/no-network-in-test': noNetworkInTest,
        'writing-tests/no-one-time-read-assertion': noOneTimeReadAssertion,
        'writing-tests/no-own-module-mock': noOwnModuleMock,
        'writing-tests/no-reassigned-let-in-test': noReassignedLetInTest,
        'writing-tests/no-same-name-helper': noSameNameHelper,
        'writing-tests/no-shared-state': noSharedState,
        'writing-tests/no-unawaited-async-assertion': noUnawaitedAsyncAssertion,
        'writing-tests/no-unrestored-fake': noUnrestoredFake,
        'writing-tests/no-weak-assertion': noWeakAssertion,
        'writing-tests/require-assertion': requireAssertion,
    },
};

/** Ported from the writing-tests skill's validate-tests.mjs: its failures are errors, its warnings are warnings. */
const writingTestsRules = {
    // Failures.
    'ai-feedback/writing-tests/no-ambient-input': 'error',
    'ai-feedback/writing-tests/no-control-flow-in-test': 'error',
    'ai-feedback/writing-tests/no-copied-helper': 'error',
    'ai-feedback/writing-tests/no-duplicate-test-body': 'error',
    'ai-feedback/writing-tests/no-fixed-sleep': 'error',
    'ai-feedback/writing-tests/no-focused-test': 'error',
    'ai-feedback/writing-tests/no-folded-comparison': 'error',
    'ai-feedback/writing-tests/no-imported-expected-value': 'error',
    'ai-feedback/writing-tests/no-one-time-read-assertion': 'error',
    'ai-feedback/writing-tests/no-unawaited-async-assertion': 'error',
    'ai-feedback/writing-tests/no-unrestored-fake': 'error',
    'ai-feedback/writing-tests/require-assertion': 'error',
    // Warnings.
    'ai-feedback/writing-tests/max-test-lines': 'warn',
    'ai-feedback/writing-tests/no-ambient-input-in-helper': 'warn',
    'ai-feedback/writing-tests/no-fixed-sleep-in-helper': 'warn',
    'ai-feedback/writing-tests/no-computed-expected-value': 'warn',
    'ai-feedback/writing-tests/no-console-in-test': 'warn',
    'ai-feedback/writing-tests/no-control-flow-in-helper': 'warn',
    'ai-feedback/writing-tests/no-env-in-test': 'warn',
    'ai-feedback/writing-tests/no-held-read': 'warn',
    'ai-feedback/writing-tests/no-named-expected-value': 'warn',
    'ai-feedback/writing-tests/no-network-in-test': 'warn',
    'ai-feedback/writing-tests/no-same-name-helper': 'warn',
    'ai-feedback/writing-tests/no-shared-state': 'warn',
    'ai-feedback/writing-tests/no-weak-assertion': 'warn',
};

const files = ['**/*.{test,spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}'];

plugin.configs = {
    'writing-tests': { name: 'ai-feedback/writing-tests', files, plugins: { 'ai-feedback': plugin }, rules: writingTestsRules },
    /** The validator's `--info` lines too: context for the file being edited. */
    'writing-tests-info': {
        name: 'ai-feedback/writing-tests-info',
        files,
        plugins: { 'ai-feedback': plugin },
        rules: { ...writingTestsRules, 'ai-feedback/writing-tests/no-own-module-mock': 'warn', 'ai-feedback/writing-tests/no-reassigned-let-in-test': 'warn' },
    },
};

export default plugin;
