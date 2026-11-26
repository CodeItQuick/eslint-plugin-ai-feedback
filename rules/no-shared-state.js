import { enclosingTest, isFunction } from '../lib/tests.js';

const inBeforeEach = (context, node) => context.sourceCode.getAncestors(node).some(ancestor =>
    isFunction(ancestor) && ancestor.parent.type === 'CallExpression' && ancestor.parent.callee.name === 'beforeEach');

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report a let that a test assigns and no beforeEach resets' },
        messages: {
            shared: '{{name}} is shared between tests. A test assigns it and no beforeEach resets it, so the result depends on test order. '
                + 'Reset it in a beforeEach, or declare it inside the test.',
        },
        schema: [],
    },
    create(context) {
        return {
            'Program:exit'() {
                for (const scope of context.sourceCode.scopeManager.scopes) {
                    for (const variable of scope.variables) {
                        const definition = variable.defs[0];
                        if (definition?.type !== 'Variable' || definition.parent.kind !== 'let' || enclosingTest(context, definition.name)) continue;
                        const writes = variable.references.filter(reference => reference.isWrite() && !reference.init);
                        const assignedInTest = writes.some(reference => enclosingTest(context, reference.identifier));
                        const reset = writes.some(reference => inBeforeEach(context, reference.identifier));
                        if (assignedInTest && !reset) context.report({ node: definition.name, messageId: 'shared', data: { name: variable.name } });
                    }
                }
            },
        };
    },
};
