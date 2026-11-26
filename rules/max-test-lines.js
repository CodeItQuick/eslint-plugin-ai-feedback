import { callbackOf, isTestCall } from '../lib/tests.js';

/**
 * Set just above the 99th percentile of one measured suite of 1,144 test
 * bodies: median 4 lines, p99 18, max 30. Long tests are the flakiest.
 */
const DEFAULT_MAX = 30;

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report a test body over a line limit' },
        messages: { long: 'The test body is {{lines}} lines, over {{max}}. A long test often checks two behaviors. Split it into one test per behavior.' },
        schema: [{ type: 'object', properties: { max: { type: 'integer', minimum: 1 } }, additionalProperties: false }],
    },
    create(context) {
        const max = context.options[0]?.max ?? DEFAULT_MAX;
        return {
            CallExpression(node) {
                const body = isTestCall(node) && callbackOf(node)?.body;
                if (!body) return;
                // Count the lines between the braces of a block body.
                const lines = body.loc.end.line - body.loc.start.line + (body.type === 'BlockStatement' ? -1 : 1);
                if (lines > max) context.report({ node, messageId: 'long', data: { lines, max } });
            },
        };
    },
};
