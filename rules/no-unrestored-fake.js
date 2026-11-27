import { parseFile, resolveImport, walk } from '../lib/files.js';
import { AFTER_HOOKS, callbackOf, codeText, isFunction, isHookCall } from '../lib/tests.js';

const LEAKS = [
    { objects: ['vi', 'jest'], methods: ['useFakeTimers'], restore: /\b(?:vi|jest)\.useRealTimers\s*\(/, needs: 'useRealTimers()' },
    { objects: ['vi', 'jest'], methods: ['spyOn'], restore: /\b(?:vi|jest)\.restoreAllMocks\s*\(|\.mockRestore\s*\(/, needs: 'restoreAllMocks() or mockRestore()' },
    { objects: ['jest'], methods: ['replaceProperty'], restore: /\bjest\.restoreAllMocks\s*\(|\.restore\s*\(/, needs: 'restoreAllMocks() or restore()' },
    { objects: ['sinon'], methods: ['useFakeTimers'], restore: /\.restore\s*\(/, needs: 'clock.restore() or sinon.restore()' },
    { objects: ['sinon'], methods: ['stub', 'spy', 'replace'], restore: /\.restore\s*\(/, needs: 'restore() or sinon.restore()' },
    { objects: ['vi'], methods: ['stubGlobal'], restore: /\bvi\.unstubAllGlobals\s*\(/, needs: 'unstubAllGlobals()' },
    { objects: ['vi'], methods: ['stubEnv'], restore: /\bvi\.unstubAllEnvs\s*\(/, needs: 'unstubAllEnvs()' },
].map(leak => ({ ...leak, setup: new RegExp(`\\b(?:${leak.objects.join('|')})\\.(?:${leak.methods.join('|')})\\s*\\(`) }));
const MATH_RANDOM = { restore: /\bMath\.random\s*=(?!=)/, needs: 'Math.random = original', setup: /\bMath\.random\s*=(?!=)/ };

const callOf = name => new RegExp(`(?<![.\\w$])${name}\\s*\\(`);

/** Each exported function of a support module, by name: its text and the text of each after-hook inside it. */
function exportedHelpers({ text, ast }) {
    const helpers = new Map();
    const add = (name, node) => {
        const hooks = [];
        walk(node, inner => { if (isHookCall(inner, AFTER_HOOKS) && callbackOf(inner)) hooks.push(text.slice(...callbackOf(inner).range)); });
        helpers.set(name, { body: text.slice(...node.range), hooks });
    };
    for (const statement of ast.body) {
        const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : null;
        if (declaration?.type === 'FunctionDeclaration') add(declaration.id.name, declaration);
        for (const declarator of declaration?.type === 'VariableDeclaration' ? declaration.declarations : []) {
            if (declarator.id.type === 'Identifier' && isFunction(declarator.init)) add(declarator.id.name, declarator.init);
        }
    }
    return helpers;
}

export default {
    meta: {
        type: 'problem',
        docs: { description: 'Require each fake, spy or stub to be restored in an after-hook' },
        messages: {
            leak: '{{what}} has no {{needs}} in an afterEach or afterAll, so the fake stays in place for the next test. '
                + 'Restore it in an after-hook. A restore at the end of the test body does not run when an assertion fails.',
            helperLeak: '{{helper}}() from {{from}} sets {{what}}, and no afterEach or afterAll calls {{needs}}, so the fake stays in place for the next test. '
                + 'Restore it in an after-hook.',
        },
        schema: [],
    },
    create(context) {
        const code = codeText(context.sourceCode);
        const setups = [];
        const hooks = [];
        const hookArguments = [];
        const calls = [];
        /** Helpers imported by name from a relative path: `import { x } from './support/x'` or `const { x } = await import(…)`. */
        const imported = [];
        const importHelpers = (specifier, bindings) => {
            const path = resolveImport(context.filename, specifier);
            const module = path && parseFile(context, path);
            if (!module) return;
            const exported = exportedHelpers(module);
            for (const [name, local] of bindings) if (exported.has(name)) imported.push({ local, from: specifier, ...exported.get(name) });
        };

        return {
            ImportDeclaration(node) {
                importHelpers(node.source.value, node.specifiers
                    .filter(specifier => specifier.type === 'ImportSpecifier')
                    .map(specifier => [specifier.imported.name, specifier.local.name]));
            },
            'VariableDeclarator[id.type="ObjectPattern"][init.type="AwaitExpression"][init.argument.type="ImportExpression"]'(node) {
                const source = node.init.argument.source;
                if (source.type !== 'Literal') return;
                importHelpers(source.value, node.id.properties
                    .filter(property => property.type === 'Property' && property.key.type === 'Identifier' && property.value.type === 'Identifier')
                    .map(property => [property.key.name, property.value.name]));
            },
            CallExpression(node) {
                if (isHookCall(node, AFTER_HOOKS)) {
                    if (callbackOf(node)) hooks.push(code.slice(...callbackOf(node).range));
                    hookArguments.push(...node.arguments.filter(argument => argument.type === 'Identifier').map(argument => argument.name));
                }
                const { callee } = node;
                if (callee.type === 'Identifier') calls.push(node);
                if (callee.type !== 'MemberExpression' || callee.object.type !== 'Identifier') return;
                const leak = LEAKS.find(l => l.objects.includes(callee.object.name) && l.methods.includes(callee.property.name));
                if (leak) setups.push({ node, leak, what: `${callee.object.name}.${callee.property.name}()` });
            },
            'AssignmentExpression[left.object.name="Math"][left.property.name="random"]'(node) {
                setups.push({ node, leak: MATH_RANDOM, what: 'Math.random = …' });
            },
            'Program:exit'() {
                // A support helper restores when the spec calls it in an after-hook or passes it as one,
                // or when the helper registers its own after-hook and the spec calls it.
                const calledHelpers = imported.filter(helper => calls.some(call => call.callee.name === helper.local));
                const restorers = [
                    ...hooks,
                    ...imported.filter(helper => hookArguments.includes(helper.local) || hooks.some(hook => callOf(helper.local).test(hook))).map(helper => helper.body),
                    ...calledHelpers.flatMap(helper => helper.hooks),
                ];
                const restored = leak => restorers.some(text => leak.restore.test(text));

                for (const { node, leak, what } of setups) {
                    if (!restored(leak)) context.report({ node, messageId: 'leak', data: { what, needs: leak.needs } });
                }
                for (const leak of [...LEAKS, MATH_RANDOM]) {
                    if (restored(leak)) continue;
                    for (const helper of calledHelpers.filter(candidate => leak.setup.test(candidate.body))) {
                        const setup = helper.body.match(leak.setup)[0];
                        const what = setup.endsWith('(') ? `${setup.slice(0, -1).trimEnd()}()` : setup;
                        for (const call of calls.filter(candidate => candidate.callee.name === helper.local)) {
                            context.report({ node: call, messageId: 'helperLeak', data: { helper: helper.local, from: helper.from, what, needs: leak.needs } });
                        }
                    }
                }
            },
        };
    },
};
