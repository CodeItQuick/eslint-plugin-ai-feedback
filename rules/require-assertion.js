import { callbackOf, isTestCall } from '../lib/tests.js';

/** `expect`, `assert`, `nodeAssert`, or a helper named for one, such as `expectSaved`. */
const isAssertionName = (name = '') => /^(?:expect|assert)\w*$/.test(name) || /\wAssert$/.test(name);

/** Each name in a callee chain: `sinon.assert.calledWith` gives calledWith, assert and sinon. */
function calleeNames(callee) {
    const names = [];
    for (; callee.type === 'MemberExpression'; callee = callee.object) names.push(callee.property.name);
    if (callee.type === 'Identifier') names.push(callee.name);
    return names;
}

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Require at least one assertion in each test' },
        messages: {
            unasserted: 'This test has no assertion, so it passes when the code is wrong. Add an expect or assert call that checks the result.',
        },
        schema: [],
    },
    create(context) {
        const asserted = new Set();
        const markTests = node => {
            for (const ancestor of context.sourceCode.getAncestors(node)) if (isTestCall(ancestor)) asserted.add(ancestor);
        };
        return {
            CallExpression(node) {
                if (calleeNames(node.callee).some(name => isAssertionName(name))) markTests(node);
            },
            'MemberExpression[property.name="should"]': markTests,
            'CallExpression:exit'(node) {
                if (isTestCall(node) && callbackOf(node) && !asserted.has(node)) context.report({ node, messageId: 'unasserted' });
            },
        };
    },
};
