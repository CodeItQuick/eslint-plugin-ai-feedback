// Reads other files of the project for the rules that compare across files.
// ESLint gives a rule one file, so these rules parse their neighbours themselves.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isFunction } from './tests.js';

const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
/** Folders that hold built or installed code. A folder whose name starts with `.` is skipped too. */
const SKIPPED = new Set(['node_modules', 'dist', 'build', 'coverage']);
/** A project lists its test roots here, as the writing-tests validator reads them. */
const CONFIG = join('.claude', 'writing-tests', 'config.json');
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.mts', '/index.ts', '/index.js'];

const parsed = new Map();

/** The text and AST of `path`, parsed with the parser of the file being linted. Cached until the file changes. */
export function parseFile(context, path) {
    const stat = statSync(path, { throwIfNoEntry: false });
    if (!stat?.isFile()) return null;
    const hit = parsed.get(path);
    if (hit?.mtimeMs === stat.mtimeMs) return hit.result;

    let result = null;
    try {
        const text = readFileSync(path, 'utf8');
        const { parser, parserOptions, sourceType } = context.languageOptions;
        const options = { ...parserOptions, ecmaVersion: 'latest', sourceType: sourceType ?? 'module', range: true, loc: true, tokens: true, comment: true, filePath: path };
        const ast = parser.parseForESLint ? parser.parseForESLint(text, options).ast : parser.parse(text, options);
        result = { text, ast };
    } catch {
        // A neighbour that does not parse is skipped. Its own lint run reports the syntax error.
    }
    parsed.set(path, { mtimeMs: stat.mtimeMs, result });
    return result;
}

/** The file that a relative import names, or null. */
export function resolveImport(fromFile, specifier) {
    if (!specifier.startsWith('.')) return null;
    const base = join(dirname(fromFile), specifier);
    return EXTENSIONS.map(extension => base + extension)
        .find(candidate => statSync(candidate, { throwIfNoEntry: false })?.isFile()) ?? null;
}

function testFilesUnder(path) {
    const stat = statSync(path, { throwIfNoEntry: false });
    if (!stat) return [];
    if (stat.isFile()) return TEST_FILE.test(path) ? [resolve(path)] : [];
    return readdirSync(path, { withFileTypes: true }).flatMap(entry =>
        SKIPPED.has(entry.name) || entry.name.startsWith('.') ? [] : testFilesUnder(join(path, entry.name)));
}

/** Every test file under the project's test roots, or under `cwd`. Walked on each call, so a new spec is seen at once. */
export function testFiles(cwd) {
    const config = join(cwd, CONFIG);
    const roots = statSync(config, { throwIfNoEntry: false }) ? JSON.parse(readFileSync(config, 'utf8')).roots : ['.'];
    return roots.flatMap(root => testFilesUnder(resolve(cwd, root)));
}

/** Calls `visit` on each node under `node`. */
export function walk(node, visit) {
    if (!node || typeof node.type !== 'string') return;
    visit(node);
    for (const [key, value] of Object.entries(node)) {
        if (key === 'parent' || key === 'tokens' || key === 'comments') continue;
        if (Array.isArray(value)) value.forEach(child => walk(child, visit));
        else if (value && typeof value === 'object') walk(value, visit);
    }
}

const isPlainString = node => (node.type === 'Literal' && typeof node.value === 'string')
    || (node.type === 'TemplateLiteral' && node.expressions.length === 0);

/** `'x'` and `"x"` are one string. ponytail: an escaped quote inside the string still differs, fine for comparing helpers. */
const sameQuotes = token => (token.type === 'String' ? `"${token.value.slice(1, -1)}"` : token.value);

/**
 * The helpers and string constants at the top level of a module. Each `key` is
 * its tokens with its own name replaced: two definitions with one key are the
 * same code under any name. Comments and spacing do not change the key.
 *
 * Only these two kinds are compared, because only they carry their meaning in
 * their own text. `const items = [...firstItems]` reads the same in six specs
 * and names six lists through the imports.
 */
export function definitionsOf(ast) {
    const found = [];
    const add = (name, kind, node, id) => {
        const key = ast.tokens
            .filter(token => token.range[0] >= node.range[0] && token.range[1] <= node.range[1])
            .map(token => (token.range[0] === id.range[0] ? '<name>' : sameQuotes(token)))
            .join(' ');
        found.push({ name, kind, key, id });
    };
    for (let statement of ast.body) {
        if (statement.type === 'ExportNamedDeclaration' && statement.declaration) statement = statement.declaration;
        if (statement.type === 'FunctionDeclaration' && statement.id) add(statement.id.name, 'function', statement, statement.id);
        if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') continue;
        for (const declarator of statement.declarations) {
            if (declarator.id.type !== 'Identifier' || !declarator.init) continue;
            const kind = isFunction(declarator.init) ? 'function' : isPlainString(declarator.init) ? 'string' : null;
            if (kind) add(declarator.id.name, kind, declarator, declarator.id);
        }
    }
    return found;
}

/** The definitions of every other test file in the project, each with its path. */
export function otherDefinitions(context) {
    const self = resolve(context.filename);
    return testFiles(context.cwd)
        .filter(path => path !== self)
        .flatMap(path => {
            const file = parseFile(context, path);
            return file ? definitionsOf(file.ast).map(definition => ({ ...definition, path })) : [];
        });
}
