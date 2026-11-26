import { enclosingTest } from '../lib/tests.js';

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Disallow console output inside a test body' },
        messages: { logged: 'Console output inside a test body checks nothing. Assert the value, or delete the line.' },
        schema: [],
    },
    create(context) {
        return {
            'CallExpression[callee.object.name="console"][callee.property.name=/^(?:log|debug|info)$/]'(node) {
                if (enclosingTest(context, node)) context.report({ node, messageId: 'logged' });
            },
        };
    },
};
