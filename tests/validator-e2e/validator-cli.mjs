// Runs the validator's e2e cases against this plugin.
//
// The *.test.mjs files in this folder are copies of
// ~/.claude/skills/writing-tests/scripts/e2e/*.test.mjs, unchanged. They import
// `check`, `fails`, `passes`, `code` and `spec` from './validator-cli.mjs'. This
// file gives them the same API, but lints each case with ESLint and the
// `writing-tests` config instead of running validate-tests.mjs.
//
// The validator and ESLint word their messages differently, so a case compares
// the exit status and each finding's kind, file and line, not the text.
// Recopy the case files when the validator's suite changes.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';
import { ESLint } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import plugin from '../../index.js';

/** A code block written indented in a case file, with the common indent removed. */
export function code([text]) {
    const lines = text.replace(/^\n/, '').trimEnd().split('\n');
    const indent = Math.min(...lines.filter(line => line.trim()).map(line => line.match(/^ */)[0].length));
    return `${lines.map(line => line.slice(indent)).join('\n')}\n`;
}

/** One spec file, `spec.test.ts`, holding the code block. */
export const spec = strings => ({ 'spec.test.ts': code(strings) });

/** The run fails: exit 1, and the report lists `findings` by kind. The file count is not compared. */
export const fails = (files, findings) => ({ status: 1, findings: expectedFindings(findings) });

/** The run passes: exit 0, with any info and warnings in `findings`. */
export const passes = (files, findings = {}) => ({ status: 0, findings: expectedFindings(findings) });

/** Each rule, or rule and message, by the validator's kind of finding. */
const KINDS = {
    'no-own-module-mock': 'mockedOwn',
    'no-reassigned-let-in-test': 'reassigned',
    'no-control-flow-in-helper/helper': 'helper',
    'no-control-flow-in-helper/hook': 'hookFlow',
    'no-ambient-input-in-helper': 'helperAmbient',
    'no-fixed-sleep-in-helper': 'helperSleep',
    'no-same-name-helper': 'sameName',
    'no-weak-assertion': 'weak',
    'no-named-expected-value': 'namedLiteral',
    'no-computed-expected-value': 'computed',
    'no-env-in-test': 'environment',
    'no-network-in-test': 'network',
    'no-held-read': 'held',
    'no-console-in-test': 'logged',
    'no-shared-state': 'shared',
    'max-test-lines': 'longTest',
    'no-copied-helper': 'copied',
    'no-control-flow-in-test': 'controlFlow',
    'no-ambient-input': 'ambient',
    'no-fixed-sleep': 'sleep',
    'require-assertion': 'unasserted',
    'no-folded-comparison': 'folded',
    'no-imported-expected-value': 'importedExpected',
    'no-duplicate-test-body': 'twice',
    'no-unrestored-fake': 'leak',
    'no-focused-test': 'focused',
    'no-unawaited-async-assertion': 'unawaited',
    'no-one-time-read-assertion': 'unretried',
};

/** The validator reports these by file, with no line. */
const BY_FILE = new Set(['copied', 'sameName']);

/**
 * Each expected finding as `kind file:line`, or `kind file` for a finding by file.
 * A copy of a test body is expected at each place after the first, where ESLint reports it.
 */
function expectedFindings(findings) {
    return Object.entries(findings).flatMap(([kind, entries]) => entries.flatMap(entry => {
        if (kind === 'twice') return entry.replace(/^same test body at /, '').split(', ').slice(1).map(place => `${kind} ${place}`);
        if (BY_FILE.has(kind)) return entry.split(' — ', 2)[1].split(', ').map(file => `${kind} ${file}`);
        const [, file, line] = entry.match(/^(\S+?):(\d+): /);
        return `${kind} ${file}:${line}`;
    })).toSorted((a, b) => a.localeCompare(b));
}

const configFor = info => [
    // The folders the validator skips.
    { ignores: ['**/.*/', '**/node_modules/', '**/dist/', '**/build/', '**/coverage/'] },
    { files: ['**/*.{ts,tsx,mts,cts}'], languageOptions: { parser: tsParser } },
    plugin.configs[info ? 'writing-tests-info' : 'writing-tests'],
    // The plugin's default limit is 30. The validator's cases expect its limit of 20.
    { files: plugin.configs['writing-tests'].files, rules: { 'ai-feedback/writing-tests/max-test-lines': ['warn', { max: 20 }] } },
];

/** The roots in the case's `.claude/writing-tests/config.json`, as the validator reads them with no path. */
function defaultRoots(folder) {
    const config = nodePath.join(folder, '.claude', 'writing-tests', 'config.json');
    return statSync(config, { throwIfNoEntry: false }) ? JSON.parse(readFileSync(config, 'utf8')).roots : ['.'];
}

/** Writes `files` into a fresh folder, which the test context removes afterwards. */
function folderWith(context, files) {
    const folder = mkdtempSync(nodePath.join(tmpdir(), 'ai-feedback-'));
    context.after(() => rmSync(folder, { recursive: true }));
    for (const [name, source] of Object.entries(files)) {
        mkdirSync(nodePath.dirname(nodePath.join(folder, name)), { recursive: true });
        writeFileSync(nodePath.join(folder, name), source);
    }
    return folder;
}

async function lint(folder, flags, paths) {
    const eslint = new ESLint({ cwd: folder, overrideConfigFile: true, overrideConfig: configFor(flags.includes('--info')), errorOnUnmatchedPattern: false });
    const results = await eslint.lintFiles(paths.length > 0 ? paths : defaultRoots(folder));
    const findings = results.flatMap(result => result.messages.map(message => {
        const file = nodePath.relative(folder, result.filePath).replaceAll('\\', '/');
        const rule = message.ruleId?.replace('ai-feedback/writing-tests/', '');
        const kind = KINDS[`${rule}/${message.messageId}`] ?? KINDS[rule] ?? `unmapped(${message.ruleId}: ${message.message})`;
        return BY_FILE.has(kind) ? `${kind} ${file}` : `${kind} ${file}:${message.line}`;
    })).toSorted((a, b) => a.localeCompare(b));
    return { status: results.some(result => result.errorCount > 0) ? 1 : 0, findings };
}

/** One case: the plugin's result on `files`, with `flags` and `paths` as the validator CLI takes them, is `expected`. */
export function check(title, files, expected, flags = [], paths = ['.']) {
    it(title, async context => assert.deepEqual(await lint(folderWith(context, files), flags, paths), expected));
}

/** The installed validator, which the differential cases run beside the plugin. */
const VALIDATOR = nodePath.join(homedir(), '.claude', 'skills', 'writing-tests', 'scripts', 'validate-tests.mjs');

/** Each report heading of the validator, by its kind of finding. */
const HEADINGS = new Map([
    ['Info — mock of your own module', 'mockedOwn'],
    ['Info — variable reassigned inside a test', 'reassigned'],
    ['Warnings — control flow in a helper', 'helper'],
    ['Warnings — control flow in a hook', 'hookFlow'],
    ['Warnings — ambient state in a helper or hook', 'helperAmbient'],
    ['Warnings — fixed sleep in a helper or hook', 'helperSleep'],
    ['Warnings — one helper name, different bodies', 'sameName'],
    ['Warnings — weak assertion inside a test', 'weak'],
    ['Warnings — local name for a literal as the expected value', 'namedLiteral'],
    ['Warnings — expected value computed with arithmetic', 'computed'],
    ['Warnings — process.env inside a test', 'environment'],
    ['Warnings — real network call inside a test', 'network'],
    ['Warnings — one-time read held in a variable, then asserted', 'held'],
    ['Warnings — console output inside a test', 'logged'],
    ['Warnings — state shared between tests', 'shared'],
    ['Warnings — long test body', 'longTest'],
    ['Failures — copied helper', 'copied'],
    ['Failures — control flow inside a test', 'controlFlow'],
    ['Failures — ambient state inside a test', 'ambient'],
    ['Failures — fixed sleep inside a test', 'sleep'],
    ['Failures — test with no assertion', 'unasserted'],
    ['Failures — comparison folded into a boolean assertion', 'folded'],
    ['Failures — expected value imported from the code under test', 'importedExpected'],
    ['Failures — same test body twice', 'twice'],
    ['Failures — a fake, spy or stub left in place after the test', 'leak'],
    ['Failures — .only left in a file', 'focused'],
    ['Failures — async assertion with no await', 'unawaited'],
    ['Failures — one-time read inside an e2e assertion', 'unretried'],
]);

/** The validator's result on `folder`, in the same shape as `lint`. An unknown heading fails the parse. */
function validate(folder, flags) {
    const run = spawnSync(process.execPath, [VALIDATOR, ...flags, '.'], { cwd: folder, encoding: 'utf8' });
    const findings = {};
    let kind = null;
    for (const line of run.stdout.split('\n')) {
        const heading = line.match(/^(.+) \(\d+\):$/);
        if (heading) {
            kind = HEADINGS.get(heading[1]);
            assert.ok(kind, `unknown validator heading: ${heading[1]}`);
            findings[kind] = [];
        } else if (kind && line.startsWith('  ')) findings[kind].push(line.trim());
    }
    return { status: run.status, findings: expectedFindings(findings) };
}

/** One differential case: the plugin and the installed validator give the same result on `files`. */
export function sameAsValidator(title, files, flags = []) {
    const skip = !statSync(VALIDATOR, { throwIfNoEntry: false }) && `the validator is not installed at ${VALIDATOR}`;
    it(title, { skip }, async context => {
        const folder = folderWith(context, files);
        assert.deepEqual(await lint(folder, flags, ['.']), validate(folder, flags));
    });
}
