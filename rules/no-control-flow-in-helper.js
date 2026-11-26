import { controlFlowVisitor, enclosingTest, isHelper, isHookCallback } from '../lib/tests.js';

const isDelete = node => node?.type === 'ExpressionStatement' && node.expression.type === 'UnaryExpression' && node.expression.operator === 'delete';

/** `if (ORIGINAL === undefined) delete process.env.X` puts back an unset value. It decides nothing. */
const isRestoringDelete = node => node.type === 'IfStatement' && !node.alternate
    && (isDelete(node.consequent) || (node.consequent.type === 'BlockStatement' && node.consequent.body.length === 1 && isDelete(node.consequent.body[0])));

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report branches and loops in a test-file helper or hook' },
        messages: {
            helper: '{{kind}} in a test-file helper. A helper that decides what a test asserts lets the test pass with no check. '
                + 'If the helper only drives the app, keep it. If it decides an assertion, move each case into its own test.',
            hook: '{{kind}} in a test hook. A setup that branches decides what every test in the block runs against. Give each setup its own describe block.',
        },
        schema: [],
    },
    create(context) {
        return controlFlowVisitor((node, kind) => {
            if (enclosingTest(context, node)) return;
            const ancestors = context.sourceCode.getAncestors(node);
            if (ancestors.some(isHelper)) return context.report({ node, messageId: 'helper', data: { kind } });
            if (ancestors.some(isHookCallback) && !isRestoringDelete(node)) context.report({ node, messageId: 'hook', data: { kind } });
        });
    },
};
