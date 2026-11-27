import { codeText, hasFakeClock, placeOf } from '../lib/tests.js';

const WHERE = { test: 'inside a test body', helper: 'in a test-file helper or hook' };

/** One rule for each place, so that a test body can fail while a helper only warns, as the validator does. */
const sleepRule = place => ({
    meta: {
        type: place === 'test' ? 'problem' : 'suggestion',
        docs: { description: `Report a wait for a fixed time ${WHERE[place]}` },
        messages: {
            sleep: `{{what}} ${WHERE[place]} waits for a fixed time. A short wait is flaky and a long wait is slow. `
                + 'Wait for the condition, for example with a web-first assertion or expect.poll, or use fake timers.',
        },
        schema: [],
    },
    create(context) {
        const clock = hasFakeClock(codeText(context.sourceCode));
        const report = (node, what) => {
            if (placeOf(context, node) === place) context.report({ node, messageId: 'sleep', data: { what } });
        };
        return {
            'CallExpression[callee.property.name="waitForTimeout"]': node => report(node, 'waitForTimeout()'),
            'CallExpression[callee.name="setTimeout"]'(node) {
                if (!clock) report(node, 'setTimeout()');
            },
        };
    },
});

export default sleepRule('test');
export const inHelper = sleepRule('helper');
