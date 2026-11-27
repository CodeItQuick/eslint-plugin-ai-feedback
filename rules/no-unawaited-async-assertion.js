import { chainAfter, enclosingTest, isExpectCall } from '../lib/tests.js';

/** Playwright matchers that retry until they pass. */
const WEB_FIRST = new Set(['toBeVisible', 'toBeHidden', 'toBeEnabled', 'toBeDisabled', 'toBeChecked', 'toBeEditable', 'toBeEmpty',
    'toBeFocused', 'toBeAttached', 'toBeInViewport', 'toHaveText', 'toContainText', 'toHaveURL', 'toHaveTitle', 'toHaveCount',
    'toHaveValue', 'toHaveValues', 'toHaveAttribute', 'toHaveClass', 'toHaveCSS', 'toHaveId', 'toHaveJSProperty', 'toHaveRole',
    'toHaveAccessibleName', 'toHaveAccessibleDescription', 'toHaveScreenshot', 'toPass', 'toBeOK']);

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Require an await on an async assertion' },
        messages: { unawaited: 'This async assertion has no await, so the test can end before the assertion runs. Add await before expect.' },
        schema: [],
    },
    create(context) {
        const playwright = context.sourceCode.ast.body.some(node => node.type === 'ImportDeclaration' && node.source.value === '@playwright/test');
        return {
            CallExpression(node) {
                if (!isExpectCall(node)) return;
                const { names, top } = chainAfter(node);
                const isPoll = node.callee.property?.name === 'poll';
                const async = isPoll || names.includes('resolves') || names.includes('rejects') || (playwright && WEB_FIRST.has(names.at(-1)));
                if (!async || !enclosingTest(context, node)) return;
                const { parent } = top;
                const isAwaited = parent.type === 'AwaitExpression' || parent.type === 'ReturnStatement'
                    || (parent.type === 'ArrowFunctionExpression' && parent.body === top);
                if (!isAwaited) context.report({ node: top, messageId: 'unawaited' });
            },
        };
    },
};
