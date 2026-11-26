export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report a mock of a module of the project' },
        messages: {
            mocked: 'This mocks your own module {{path}}. A mock of domain code couples the test to it. '
                + 'Use the real module, and fake only the edges, such as the network, the clock and the file system.',
        },
        schema: [],
    },
    create(context) {
        return {
            'CallExpression[callee.object.name=/^(?:vi|jest)$/][callee.property.name="mock"]'(node) {
                const path = node.arguments[0]?.value;
                if (typeof path === 'string' && /^(?:\.{1,2}\/|\/|@\/)/.test(path)) context.report({ node, messageId: 'mocked', data: { path } });
            },
        };
    },
};
