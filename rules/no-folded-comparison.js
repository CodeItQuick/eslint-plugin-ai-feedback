import { booleanSubject, enclosingTest } from '../lib/tests.js';

const COMPARISONS = new Set(['==', '===', '!=', '!==', '<', '<=', '>', '>=']);

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow a comparison inside a boolean assertion' },
        messages: {
            folded: 'The comparison runs before the assertion, so a failure reports only false and hides both values. '
                + 'Compare the values with a matcher, for example expect(actual).toBe(expected).',
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const subject = booleanSubject(node);
                if (subject?.type === 'BinaryExpression' && COMPARISONS.has(subject.operator) && enclosingTest(context, node)) {
                    context.report({ node: subject, messageId: 'folded' });
                }
            },
        };
    },
};
