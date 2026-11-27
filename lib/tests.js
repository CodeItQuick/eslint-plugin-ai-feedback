// AST helpers for test files: which call is a test, a hook or an assertion.

/**
 * An ESTree node. The helpers read members that only some node types have, so the type is loose.
 * @typedef {{ type: string, [key: string]: any }} Node
 */
/** @typedef {import('eslint').Rule.RuleContext} Context */
/** @typedef {import('eslint').SourceCode} SourceCode */
/** @typedef {import('eslint').Scope.Scope} Scope */

const TESTS = new Set(['it', 'test']);
const MODIFIERS = new Set(['only', 'skip', 'fixme', 'concurrent', 'fails', 'todo']);
export const AFTER_HOOKS = new Set(['after', 'afterEach', 'afterAll']);

/** @param {Node | null | undefined} node */
export const isFunction = node =>
    node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';

/**
 * `it(`, `test.only(`, `it.each(table)(`. Not `test.describe(`, which is a container.
 * @param {Node | null | undefined} node
 */
export function isTestCall(node) {
    if (node?.type !== 'CallExpression') return false;
    let callee = node.callee;
    if (callee.type === 'CallExpression' && callee.callee.type === 'MemberExpression' && callee.callee.property.name === 'each') {
        callee = callee.callee.object;
    }
    if (callee.type === 'MemberExpression' && MODIFIERS.has(callee.property.name)) callee = callee.object;
    return callee.type === 'Identifier' && TESTS.has(callee.name);
}

/**
 * The test body. `test.skip(condition, 'reason')` has none, so it is not a test.
 * @param {Node} call
 */
export const callbackOf = call => call.arguments.find(isFunction);

/**
 * @param {Node} node
 * @param {Set<string>} names
 */
export const isHookCall = (node, names) =>
    node.type === 'CallExpression' && node.callee.type === 'Identifier' && names.has(node.callee.name);

/**
 * The innermost test call whose body holds `node`, or null.
 * @param {Context} context
 * @param {Node} node
 */
export function enclosingTest(context, node) {
    const ancestors = context.sourceCode.getAncestors(/** @type {import('estree').Node} */ (node));
    for (let i = ancestors.length - 1; i > 0; i--) {
        const call = ancestors[i - 1];
        if (isTestCall(call) && callbackOf(call) === ancestors[i]) return call;
    }
    return null;
}

const HOOKS = new Set(['before', 'after', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll']);

/**
 * `function f() {}`, or a function assigned to a `const` or `let`. A callback passed to `describe` is not one.
 * @param {Node} node
 */
export const isHelper = node => node.type === 'FunctionDeclaration'
    || (isFunction(node) && node.parent.type === 'VariableDeclarator' && node.parent.init === node);

/** @param {Node} node */
export const isHookCallback = node => isFunction(node) && node.parent.type === 'CallExpression'
    && node.parent.callee.type === 'Identifier' && HOOKS.has(node.parent.callee.name);

/**
 * 'test' inside a test body, 'helper' inside a test-file helper or hook, otherwise null.
 * @param {Context} context
 * @param {Node} node
 */
export function placeOf(context, node) {
    if (enclosingTest(context, node)) return 'test';
    return context.sourceCode.getAncestors(/** @type {import('estree').Node} */ (node)).some(ancestor => isHelper(ancestor) || isHookCallback(ancestor)) ? 'helper' : null;
}

/**
 * `expect(x)`, `expect.soft(x)` or `expect.poll(fn)`.
 * @param {Node} node
 */
export function isExpectCall(node) {
    if (node.type !== 'CallExpression') return false;
    const { callee } = node;
    if (callee.type === 'Identifier') return callee.name === 'expect';
    return callee.type === 'MemberExpression' && callee.object.name === 'expect'
        && ['soft', 'poll'].includes(callee.property.name);
}

/**
 * The member names after `expect(x)` and the call that ends them:
 * `expect(x).not.toBe(1)` gives names `['not', 'toBe']`, args `[1]`, and the outer call as `top`.
 * A chai chain with no call, `expect(x).to.be.ok`, gives no args and the last member as `top`.
 * @param {Node} expectCall
 */
export function chainAfter(expectCall) {
    const names = [];
    let node = expectCall;
    while (node.parent.type === 'MemberExpression' && node.parent.object === node) {
        names.push(node.parent.property.name);
        node = node.parent;
    }
    const call = node.parent.type === 'CallExpression' && node.parent.callee === node ? node.parent : null;
    return { names, args: call?.arguments ?? [], top: call ?? node };
}

/**
 * `assert`, `nodeAssert`, `chaiAssert`: any name that ends in `assert` or `Assert`.
 * @param {string | null | undefined} name
 */
export const isAssertName = name => /(?:^a|A)ssert$/.test(name ?? '');

const EQUALITY = new Set(['toBe', 'toEqual', 'toStrictEqual', 'eq', 'equal', 'equals', 'eql', 'strictEqual', 'deepEqual', 'deepStrictEqual']);
/** @param {Node | null | undefined} node */
const isBooleanLiteral = node => node?.type === 'Literal' && typeof node.value === 'boolean';

/**
 * The value that an assertion reduces to a boolean, or null:
 * `expect(v).toBe(true)`, `expect(v).toBeTruthy()`, `expect(v).to.be.true`,
 * `assert(v)`, `assert.ok(v)`, `assert.isTrue(v)`, `assert.equal(v, false)`.
 * @param {Node} node
 */
export function booleanSubject(node) {
    if (isExpectCall(node)) {
        const { names, args } = chainAfter(node);
        const last = names.at(-1);
        const boolean = ['toBeTruthy', 'toBeFalsy', 'true', 'false', 'ok'].includes(last)
            || (EQUALITY.has(last) && isBooleanLiteral(args[0]));
        return boolean ? node.arguments[0] : null;
    }
    const { callee } = node;
    if (callee.type === 'Identifier' && isAssertName(callee.name)) return node.arguments[0];
    if (callee.type !== 'MemberExpression' || !isAssertName(callee.object.name)) return null;
    const method = callee.property.name;
    if (['ok', 'isOk', 'isNotOk', 'isTrue', 'isFalse'].includes(method)) return node.arguments[0];
    if (EQUALITY.has(method) && isBooleanLiteral(node.arguments[1])) return node.arguments[0];
    return null;
}

/** Statement and expression types that branch or loop, by the name a message gives them. */
export const CONTROL_FLOW = {
    IfStatement: 'if',
    SwitchStatement: 'switch',
    TryStatement: 'try/catch',
    ConditionalExpression: 'ternary',
    ForStatement: 'for',
    ForInStatement: 'for...in',
    ForOfStatement: 'for...of',
    WhileStatement: 'while',
    DoWhileStatement: 'do...while',
};

/**
 * A visitor that calls `report(node, kind)` for each branch or loop. An `else` is a branch of its own.
 * @param {(node: Node, kind: string) => void} report
 * @returns {import('eslint').Rule.RuleListener}
 */
export const controlFlowVisitor = report => ({
    ...Object.fromEntries(Object.entries(CONTROL_FLOW).map(([type, kind]) => [type, (/** @type {Node} */ node) => report(node, kind)])),
    'IfStatement[alternate]': (/** @type {Node} */ node) => report(node.alternate, 'else'),
    LogicalExpression: node => report(node, `${node.operator} fallback`),
    'CallExpression[callee.property.name="forEach"]': (/** @type {Node} */ node) => report(node, 'forEach'),
});

const EXPECTED_MATCHERS = new Set(['toBe', 'toEqual', 'toStrictEqual', 'toMatchObject', 'toHaveLength', 'toContain', 'toContainEqual', 'eq', 'equal', 'equals', 'eql']);
const EXPECTED_ASSERTS = new Set(['equal', 'strictEqual', 'deepEqual', 'deepStrictEqual', 'lengthOf']);

/**
 * The expected value of an assertion: the matcher argument, or the second argument of `assert.equal(`.
 * @param {Node} node
 */
export function expectedOf(node) {
    if (isExpectCall(node)) {
        const { names, args } = chainAfter(node);
        return EXPECTED_MATCHERS.has(names.at(-1)) ? args[0] : null;
    }
    const { callee } = node;
    return callee.type === 'MemberExpression' && isAssertName(callee.object.name) && EXPECTED_ASSERTS.has(callee.property.name)
        ? node.arguments[1] : null;
}

/**
 * `LIMIT`, `LABELS.patience`, `LABELS['x']`: the identifier that a name read starts from, or null.
 * @param {Node | null | undefined} node
 */
export function nameRead(node) {
    while (node?.type === 'MemberExpression') node = node.object;
    return node?.type === 'Identifier' ? node : null;
}

/**
 * @param {Scope | null} scope
 * @param {string} name
 */
export function findVariable(scope, name) {
    for (; scope; scope = scope.upper) {
        const variable = scope.set.get(name);
        if (variable) return variable;
    }
    return null;
}

/** @param {Context} context */
export const isPlaywright = context => context.sourceCode.ast.body
    .some(node => node.type === 'ImportDeclaration' && node.source.value === '@playwright/test');

/**
 * The file text with each comment blanked, so that a call named in a comment does not count. Offsets stay the same.
 * @param {SourceCode} sourceCode
 */
export function codeText(sourceCode) {
    let text = sourceCode.text;
    for (const comment of sourceCode.getAllComments()) {
        const [start, end] = /** @type {[number, number]} */ (comment.range);
        text = text.slice(0, start) + ' '.repeat(end - start) + text.slice(end);
    }
    return text;
}

/**
 * The name that an expression starts from: `heading` in `heading.trim().length`.
 * @param {Node | null | undefined} node
 */
export function leftmostName(node) {
    while (node?.type === 'MemberExpression' || node?.type === 'CallExpression') node = node.type === 'CallExpression' ? node.callee : node.object;
    return node?.type === 'Identifier' ? node : null;
}

/**
 * Whether the file controls the clock or `Math.random`. Pass `codeText(sourceCode)`.
 * @param {string} text
 */
export const controlsClock = text =>
    /\b(?:useFakeTimers|setSystemTime)\b|\bclock\s*\.\s*(?:install|setFixedTime|setSystemTime)\b/.test(text);
/** @param {string} text */
export const controlsRandom = text => /\bspyOn\s*\(\s*Math\s*,|\bMath\.random\s*=[^=]/.test(text);
