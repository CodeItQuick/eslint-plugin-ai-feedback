import { enclosingTest, expectedOf, findVariable, nameRead } from '../lib/tests.js';

const SCREAMING = /^[A-Z][A-Z0-9_]+$/;

/**
 * The module that a binding comes from: `import { X } from '…'`,
 * `const { X } = require('…')` or `const { X } = await import('…')`. Otherwise null.
 */
function importedFrom(definition) {
    if (definition?.type === 'ImportBinding') return definition.parent.source.value;
    if (definition?.type !== 'Variable' || definition.node.id.type !== 'ObjectPattern') return null;
    let init = definition.node.init;
    if (init?.type === 'AwaitExpression' && init.argument.type === 'ImportExpression') init = init.argument.source;
    else if (init?.type === 'CallExpression' && init.callee.name === 'require') init = init.arguments[0];
    else return null;
    return init?.type === 'Literal' && typeof init.value === 'string' ? init.value : null;
}

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow an expected value imported from the code under test' },
        messages: {
            imported: '{{name}} comes from {{from}}, the code under test. The code and the test read the same value, so the test passes when that value is wrong. '
                + 'Write the expected value as a literal.',
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const root = nameRead(expectedOf(node));
                if (!root || !SCREAMING.test(root.name) || !enclosingTest(context, node)) return;

                const from = importedFrom(findVariable(context.sourceCode.getScope(node), root.name)?.defs[0]);
                if (from?.startsWith('.') && !/(?:^|\/)support(?:\/|$)/.test(from)) {
                    context.report({ node: root, messageId: 'imported', data: { name: root.name, from } });
                }
            },
        };
    },
};
