import { controlFlowVisitor, enclosingTest } from '../lib/tests.js';

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow branches and loops inside a test body' },
        messages: {
            controlFlow: '{{kind}} inside a test body. The test asserts different things on different runs, and a failure does not say which case ran. '
                + 'Write one straight-line test per case. A case table in the describe body is fine.',
        },
        schema: [],
    },
    create(context) {
        return controlFlowVisitor((node, kind) => {
            if (enclosingTest(context, node)) context.report({ node, messageId: 'controlFlow', data: { kind } });
        });
    },
};
