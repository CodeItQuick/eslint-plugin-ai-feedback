import { enclosingTest } from '../lib/tests.js';

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report a let that a test declares and then reassigns' },
        messages: { reassigned: '{{name}} is reassigned inside the test, so the reader has to track its value line by line. Use a new const for each value.' },
        schema: [],
    },
    create(context) {
        return {
            'Program:exit'() {
                for (const scope of context.sourceCode.scopeManager.scopes) {
                    for (const variable of scope.variables) {
                        const definition = variable.defs[0];
                        // A `for (let i = 0; …; i++)` counter is loop state, which no-control-flow-in-test reports.
                        if (definition?.type !== 'Variable' || definition.parent.kind !== 'let' || definition.parent.parent.type === 'ForStatement') continue;
                        if (!enclosingTest(context, definition.name)) continue;
                        if (variable.references.some(reference => reference.isWrite() && !reference.init)) {
                            context.report({ node: definition.name, messageId: 'reassigned', data: { name: variable.name } });
                        }
                    }
                }
            },
        };
    },
};
