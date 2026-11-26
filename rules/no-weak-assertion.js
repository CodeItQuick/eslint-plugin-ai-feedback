import { booleanSubject, chainAfter, enclosingTest, isAssertName, isExpectCall } from '../lib/tests.js';

const ALWAYS_WEAK = new Set(['toBeDefined', 'toBeTruthy', 'toBeFalsy', 'ok', 'exist']);
const SIGN_ONLY = new Set(['toBeGreaterThan', 'toBeGreaterThanOrEqual', 'toBeLessThan', 'toBeLessThanOrEqual']);
const WEAK_ASSERTS = new Set(['isOk', 'exists', 'isDefined', 'isNotNull', 'isNotUndefined', 'ok',
    'isArray', 'isObject', 'isString', 'isNumber', 'isBoolean', 'isFunction', 'typeOf']);
const COLLAPSING = new Set(['every', 'some', 'has', 'includes', 'startsWith', 'endsWith']);

/** `items.every(…)`, `!list.includes(x)` or `Array.isArray(x)`: a call that reduces a value to a boolean. */
function collapsingCall(node) {
    if (node?.type === 'UnaryExpression' && node.operator === '!') node = node.argument;
    if (node?.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return null;
    const { object, property } = node.callee;
    if (object.name === 'Array' && property.name === 'isArray') return 'Array.isArray(…)';
    return COLLAPSING.has(property.name) ? `x.${property.name}(…)` : null;
}

/** The name of the weak check in an expect chain, or null. */
function weakExpect(node) {
    const { names, args } = chainAfter(node);
    const last = names.at(-1);
    if (node.arguments[0]?.type === 'UnaryExpression' && node.arguments[0].operator === 'typeof') return 'expect(typeof …)';
    if (names.includes('not') && ['toBeNull', 'toBeUndefined'].includes(last)) return `not.${last}()`;
    if (SIGN_ONLY.has(last) && args[0]?.type === 'Literal' && args[0].value === 0) return `${last}(0)`;
    return ALWAYS_WEAK.has(last) ? last : null;
}

function weakAssert(node) {
    const { callee } = node;
    const weak = callee.type === 'MemberExpression' && isAssertName(callee.object.name) && WEAK_ASSERTS.has(callee.property.name)
        // `assert.ok(a === b)` is a folded comparison, which no-folded-comparison reports.
        && node.arguments[0]?.type !== 'BinaryExpression';
    return weak ? `assert.${callee.property.name}()` : null;
}

export default {
    meta: {
        type: 'suggestion',
        docs: { description: 'Report an assertion that passes for almost any value' },
        messages: {
            weak: '{{what}} passes for almost any value. If the test knows the exact value, assert that value. If "it exists" is the whole contract, keep it.',
            collapsed: '{{what}} reduces the value to a boolean, so a failure hides the element that broke it. Compare the value with a matcher.',
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                if (!enclosingTest(context, node)) return;
                const collapsed = collapsingCall(booleanSubject(node));
                if (collapsed) return context.report({ node, messageId: 'collapsed', data: { what: collapsed } });
                const what = isExpectCall(node) ? weakExpect(node) : weakAssert(node);
                if (what) context.report({ node, messageId: 'weak', data: { what } });
            },
        };
    },
};
