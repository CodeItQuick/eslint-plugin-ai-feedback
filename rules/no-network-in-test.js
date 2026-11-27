import { codeText, enclosingTest, isPlaywright } from '../lib/tests.js';

/** A stubbed `fetch`, a module mock, msw or nock. */
const NETWORK_CONTROLS = [
    /stubGlobal\s*\(\s*['"]fetch/,
    /\b(?:sinon\.stub|jest\.spyOn)\s*\(\s*global(?:This)?\s*,\s*['"]fetch/,
    /\b(?:vi|jest)\.mock\s*\(/,
    /\bmsw\b|\bnock\b/,
];
const controlsNetwork = text => NETWORK_CONTROLS.some(control => control.test(text));

/** `fetch(`, `axios(`, `axios.get(`, `http.get(`, `https.request(`. */
function isNetworkCallee(callee) {
    if (callee.type === 'Identifier') return ['fetch', 'axios'].includes(callee.name);
    if (callee.type !== 'MemberExpression') return false;
    const object = callee.object.name;
    return object === 'axios' || (['http', 'https'].includes(object) && ['get', 'request'].includes(callee.property.name));
}

function urlText(node) {
    if (node?.type === 'Literal') return String(node.value);
    if (node?.type === 'TemplateLiteral') return node.quasis[0].value.cooked;
    return '';
}

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report a real network call inside a test' },
        messages: {
            network: 'A real network call inside a test body is an input that the test does not control. Stub fetch, or use a mock server such as msw.',
        },
        schema: [],
    },
    create(context) {
        if (isPlaywright(context) || controlsNetwork(codeText(context.sourceCode))) return {};
        return {
            CallExpression(node) {
                if (isNetworkCallee(node.callee) && /^https?:\/\//.test(urlText(node.arguments[0])) && enclosingTest(context, node)) {
                    context.report({ node, messageId: 'network' });
                }
            },
        };
    },
};
