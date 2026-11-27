import { oneTimeRead } from '../lib/reads.js';
import { enclosingTest, isExpectCall, isFunction, isPlaywright, leftmostName } from '../lib/tests.js';

/** The `expect(…)` call at the start of an awaited chain such as `await expect(x).toBeVisible()`, or null. */
function awaitedExpect(node) {
    let inner = node.argument;
    while (inner?.type === 'CallExpression' || inner?.type === 'MemberExpression') {
        if (isExpectCall(inner)) return inner;
        inner = inner.type === 'CallExpression' ? inner.callee : inner.object;
    }
    return null;
}

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report a one-time Playwright read held in a variable and then asserted' },
        messages: {
            held: '{{name}} holds a one-time {{method}}() read, and expect({{name}}) checks it once. Use expect.poll or a web-first matcher, which retries.',
        },
        schema: [],
    },
    create(context) {
        if (!isPlaywright(context)) return {};
        const held = [];
        const checks = [];
        const firstAwaitedExpect = new Map();
        return {
            AwaitExpression(node) {
                const test = awaitedExpect(node) && enclosingTest(context, node);
                if (test && !firstAwaitedExpect.has(test)) firstAwaitedExpect.set(test, node.range[0]);
            },
            VariableDeclarator(node) {
                const method = node.id.type === 'Identifier' && oneTimeRead(node.init);
                const test = method && enclosingTest(context, node);
                if (!test) return;
                // A read inside `expect(async () => …).toPass()` is retried.
                const retried = context.sourceCode.getAncestors(node).some(ancestor => isExpectCall(ancestor) && isFunction(ancestor.arguments[0]) && ancestor.arguments[0].async);
                // A read after an awaited expect runs on a page that the expect already waited for.
                const isWaited = firstAwaitedExpect.get(test) < node.range[0];
                if (!retried && !isWaited) held.push({ node, test, method, name: node.id.name });
            },
            CallExpression(node) {
                const subject = isExpectCall(node) && leftmostName(node.arguments[0]);
                if (subject) checks.push({ name: subject.name, at: node.range[0], test: enclosingTest(context, node) });
            },
            'Program:exit'() {
                for (const { node, test, method, name } of held) {
                    if (checks.some(check => check.test === test && check.name === name && check.at > node.range[0])) {
                        context.report({ node, messageId: 'held', data: { name, method } });
                    }
                }
            },
        };
    },
};
