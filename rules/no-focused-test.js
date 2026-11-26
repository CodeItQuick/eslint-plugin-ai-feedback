const CONTAINERS = new Set(['it', 'test', 'describe']);

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow .only on a test or describe' },
        messages: { focused: '.only runs this block and skips every other test in the file. Remove .only.' },
        schema: [],
    },
    create(context) {
        return {
            'CallExpression > MemberExpression.callee[property.name="only"]'(node) {
                let object = node.object;
                if (object.type === 'MemberExpression' && object.property.name === 'describe') object = object.object;
                if (object.type === 'Identifier' && CONTAINERS.has(object.name)) context.report({ node, messageId: 'focused' });
            },
        };
    },
};
