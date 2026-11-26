import { codeText, enclosingTest } from '../lib/tests.js';

/** `vi.stubEnv`, Jest's `replaceProperty(process, …)`, or a sinon stub of `env`. */
const CONTROLS_ENV = /\bstubEnv\b|\bjest\.replaceProperty\s*\(\s*process\b|\bsinon\.(?:stub|replace)\s*\(\s*process\s*,\s*['"]env['"]/;

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report process.env inside a test in a file that does not control it' },
        messages: {
            environment: 'process.env inside a test body is an input that the test does not control. Stub it with your runner\'s env stub, and restore it in an after-hook.',
        },
        schema: [],
    },
    create(context) {
        if (CONTROLS_ENV.test(codeText(context.sourceCode))) return {};
        return {
            'MemberExpression[object.name="process"][property.name="env"]'(node) {
                if (enclosingTest(context, node)) context.report({ node, messageId: 'environment' });
            },
        };
    },
};
