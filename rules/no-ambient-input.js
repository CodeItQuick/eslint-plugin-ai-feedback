import { codeText, controlsClock, controlsRandom, placeOf } from '../lib/tests.js';

const WHERE = { test: 'inside a test body', helper: 'in a test-file helper or hook' };

/** One rule for each place, so that a test body can fail while a helper only warns, as the validator does. */
const ambientRule = place => ({
    meta: {
        type: place === 'test' ? 'problem' : 'suggestion',
        docs: { description: `Report a real clock or random draw ${WHERE[place]}, in a file that does not control it` },
        messages: {
            clock: `{{what}} ${WHERE[place]} reads the real clock, an input that the test does not control. `
                + 'Use fake timers and set the system time, then restore real timers in an after-hook.',
            random: `Math.random() ${WHERE[place]} is an input that the test does not control. `
                + 'Spy on Math.random to return a fixed value, and restore the spy in an after-hook.',
        },
        schema: [],
    },
    create(context) {
        const code = codeText(context.sourceCode);
        const clock = controlsClock(code);
        const random = controlsRandom(code);
        const report = (node, messageId, what) => {
            if (placeOf(context, node) === place) context.report({ node, messageId, data: { what } });
        };
        return {
            'CallExpression[callee.object.name="Date"][callee.property.name="now"]'(node) {
                if (!clock) report(node, 'clock', 'Date.now()');
            },
            'NewExpression[callee.name="Date"][arguments.length=0]'(node) {
                if (!clock) report(node, 'clock', 'new Date()');
            },
            'CallExpression[callee.object.name="Math"][callee.property.name="random"]'(node) {
                if (!random) report(node, 'random');
            },
        };
    },
});

export default ambientRule('test');
export const inHelper = ambientRule('helper');
