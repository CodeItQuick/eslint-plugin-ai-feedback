import { enclosingTest, expectedOf, findVariable, nameRead } from '../lib/tests.js';

const isLiteral = node => (node?.type === 'Literal' && !node.regex)
    || (node?.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal');

/** A `const` at the top of the module whose value is a number, string, boolean or null literal. */
function isModuleLiteral(variable) {
    const definition = variable?.defs[0];
    if (definition?.type !== 'Variable' || definition.parent.kind !== 'const' || !isLiteral(definition.node.init)) return false;
    const statement = definition.parent.parent.type === 'ExportNamedDeclaration' ? definition.parent.parent : definition.parent;
    return statement.parent.type === 'Program';
}

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report an expected value that is a local name for a literal' },
        messages: { named: '{{name}} names a literal. Write the literal as the expected value, so that the reader sees the value in the test.' },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const root = nameRead(expectedOf(node));
                if (!root || !enclosingTest(context, node)) return;
                if (isModuleLiteral(findVariable(context.sourceCode.getScope(node), root.name))) {
                    context.report({ node: root, messageId: 'named', data: { name: root.name } });
                }
            },
        };
    },
};
