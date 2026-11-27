import { walk } from '../lib/files.js';
import { enclosingTest, expectedOf, nameRead } from '../lib/tests.js';

const ARITHMETIC = new Set(['+', '-', '*', '/', '%', '**']);
const isText = node => node.type === 'TemplateLiteral' || (node.type === 'Literal' && typeof node.value === 'string');

/** `amount * 1.08`, `first.remaining - 10`: arithmetic with a name on one side. Not `-1`, and not string concatenation. */
function hasArithmetic(expected) {
    let isFound = false;
    walk(expected, node => {
        if (node.type !== 'BinaryExpression' || !ARITHMETIC.has(node.operator) || isText(node.left) || isText(node.right)) return;
        walk(node, inner => { if (inner.type === 'Identifier') isFound = true; });
    });
    return isFound;
}

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report an expected value computed with arithmetic' },
        messages: {
            computed: 'The expected value is computed ({{expression}}). A copied formula passes when it and the code are wrong in the same way. '
                + 'Write the literal that it gives, unless it relates two values that the test read.',
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const expected = expectedOf(node);
                if (!expected || nameRead(expected) || !hasArithmetic(expected) || !enclosingTest(context, node)) return;
                const expression = context.sourceCode.getText(expected).replaceAll(/\s+/g, ' ');
                context.report({ node: expected, messageId: 'computed', data: { expression } });
            },
        };
    },
};
