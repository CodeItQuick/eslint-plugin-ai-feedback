import { oneTimeRead } from '../lib/reads.js';
import { enclosingTest, isExpectCall, isPlaywright } from '../lib/tests.js';

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow expect(await locator.read()) in a Playwright test' },
        messages: {
            unretried: 'expect(await …{{method}}()) reads the page once, and a slow page fails the test. '
                + 'Use a web-first matcher, which retries, for example await expect(locator).toBeVisible().',
        },
        schema: [],
    },
    create(context) {
        if (!isPlaywright(context)) return {};
        return {
            CallExpression(node) {
                const method = isExpectCall(node) && oneTimeRead(node.arguments[0]);
                if (method && enclosingTest(context, node)) context.report({ node, messageId: 'unretried', data: { method } });
            },
        };
    },
};
