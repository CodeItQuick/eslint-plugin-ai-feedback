import { callbackOf, isTestCall } from '../lib/tests.js';

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow two tests with the same body in one file' },
        messages: { duplicate: 'This test body is a copy of the test on line {{line}}. The copy adds no check. Delete it, or change it to check a different case.' },
        schema: [],
    },
    create(context) {
        const seen = new Map();
        return {
            CallExpression(node) {
                const body = isTestCall(node) && callbackOf(node)?.body;
                if (!body) return;
                // Tokens drop comments and whitespace, and keep literals.
                const key = context.sourceCode.getTokens(body).map(token => token.value).join(' ');
                const first = seen.get(key);
                if (first) context.report({ node, messageId: 'duplicate', data: { line: first.loc.start.line } });
                else seen.set(key, node);
            },
        };
    },
};
