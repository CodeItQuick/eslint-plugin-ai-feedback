// The sources of ~/.claude/skills/writing-tests/scripts/validate-tests.test.mjs.
// That suite calls the validator's functions and checks one kind of finding.
// Here each source runs through the installed validator and through the plugin,
// and every finding of every kind must match.
import { describe } from 'node:test';
import { sameAsValidator } from './validator-cli.mjs';

const inTest = body => `it('does one thing', () => {\n${body}\n});\n`;
const one = source => ({ 's.test.ts': source });

describe('validator unit cases, differential', () => {
    const CONTROL_FLOW = {
        'if': 'if (ready) expect(a).toBe(1);',
        'switch': 'switch (kind) { case 1: go(); }\nexpect(a).toBe(1);',
        'try/catch': 'try { parse(bad); } catch (error) { expect(error).toBe(1); }',
        'ternary': 'expect(score).toBe(reversed ? 2 : 4);',
        '|| fallback': 'expect(a || b).toBe(1);',
        '?? fallback': 'expect(a ?? b).toBe(1);',
        'for': 'for (const x of xs) expect(x).toBe(1);',
        'while': 'while (more()) next();\nexpect(a).toBe(1);',
        'forEach': 'xs.forEach(x => expect(x).toBe(1));',
    };
    for (const [name, body] of Object.entries(CONTROL_FLOW)) sameAsValidator(`${name} inside a test body`, one(inTest(body)));

    sameAsValidator('an if and its else', one(inTest('if (ready) go();\nelse stop();\nexpect(a).toBe(1);')));
    sameAsValidator('a loop in a describe body around the tests', one("describe('banks', () => {\n    for (const bank of banks) {\n        it(bank.name, () => { expect(bank).toBe(1); });\n    }\n});\n"));
    sameAsValidator('control flow in a module-level helper', one('function answer(question) {\n    if (question.likert) return 3;\n    return 0;\n}\n' + inTest('expect(answer(q)).toBe(0);')));
    sameAsValidator('a typed arrow helper', one('const choose: Strategy = question => question.likert ? 3 : 0;\n'));
    sameAsValidator('an object type on a helper parameter', one('function order(ordered: ReadonlyArray<{ factor: string }>) {\n    if (ordered.length) return 1;\n}\n'));
    sameAsValidator('keywords inside comments and strings', one(inTest("// if (x) this would branch\nexpect(label).toBe('if (x) or y || z');")));
    sameAsValidator('a Playwright body after a destructured parameter', one("test('opens', async ({ page }) => {\n    if (await page.isVisible()) await expect(page).toHaveTitle('x');\n});\n"));
    sameAsValidator('a test with a function callback', one("it('opens', function () {\n    if (open) expect(a).toBe(1);\n});\n"));
    sameAsValidator('a test with an expression body', one("it('scores', () => expect(a || b).toBe(1));\n"));
    sameAsValidator('a regex .test( call', one(inTest('expect(/^Maps/.test(description)).toBe(true);')));
    sameAsValidator('test.skip with a condition inside a test', one("test('a survey', async ({ page }) => {\n    test.skip(likert === undefined, 'no survey');\n    await expect(page).toHaveTitle('x');\n});\n"));

    const WEAK = {
        'toBeDefined()': 'expect(session).toBeDefined();',
        'toBeTruthy()': 'expect(session).toBeTruthy();',
        'toBeFalsy()': 'expect(session).toBeFalsy();',
        'expect(typeof …)': "expect(typeof session).toBe('object');",
        'length > 0': 'expect(list.length).toBeGreaterThan(0);',
        'chai ok/exist': 'expect(session).to.be.ok;',
    };
    for (const [name, line] of Object.entries(WEAK)) sameAsValidator(`weak: ${name}`, one(inTest(line)));

    const AMBIENT = {
        'Date.now()': 'session.createdAt = Date.now();\nexpect(store.size).toBe(1);',
        'new Date()': 'session.createdAt = new Date();\nexpect(store.size).toBe(1);',
        'Math.random()': 'const pick = Math.random();\nexpect(store.size).toBe(1);',
    };
    for (const [name, body] of Object.entries(AMBIENT)) sameAsValidator(`ambient: ${name}`, one(inTest(body)));

    sameAsValidator('the clock under fake timers', one('beforeEach(() => vi.useFakeTimers());\n' + inTest('session.createdAt = Date.now();\nexpect(store.size).toBe(1);')));
    sameAsValidator('a fixed date', one(inTest("session.createdAt = new Date('2026-11-01');\nexpect(store.size).toBe(1);")));
    sameAsValidator('the random draw under a spy', one("beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0));\n" + inTest('const pick = Math.random();\nexpect(pick).toBe(0);')));
    sameAsValidator('fake timers and the random draw', one('beforeEach(() => vi.useFakeTimers());\n' + inTest('const pick = Math.random();\nexpect(store.size).toBe(1);')));
    sameAsValidator('ambient state outside a test', one('const STARTED = Date.now();\n' + inTest('expect(STARTED).toBe(1);')));
    sameAsValidator('waitForTimeout inside a test', one("test('answers', async ({ page }) => {\n    await page.waitForTimeout(600);\n    await expect(page).toHaveTitle('x');\n});\n"));
    sameAsValidator('setTimeout inside a test', one(inTest('await new Promise(resolve => setTimeout(resolve, 1_500));\nexpect(a).toBe(1);')));
    sameAsValidator('setTimeout under fake timers', one('beforeEach(() => vi.useFakeTimers());\n' + inTest('setTimeout(tick, 1_000);\nexpect(a).toBe(1);')));
    sameAsValidator('waitForTimeout under fake timers', one("beforeEach(() => vi.useFakeTimers());\ntest('answers', async ({ page }) => {\n    await page.waitForTimeout(600);\n    await expect(page).toHaveTitle('x');\n});\n"));
    sameAsValidator('a test with no assertion', one(inTest('store.create(1);')));
    sameAsValidator('an assertion word in a comment', one(inTest('// expect(a).toBe(1)\nstore.create(1);')));

    const ASSERTING = {
        'expect': 'expect(a).toBe(1);',
        'expect.poll': 'await expect.poll(() => a).toBe(1);',
        'node assert': 'assert.equal(a, 1);',
        'a helper named for an assertion': 'expectScore(page, 3);',
        'chai should': 'a.should.equal(1);',
    };
    for (const [name, body] of Object.entries(ASSERTING)) sameAsValidator(`asserts with ${name}`, one(inTest(body)));

    const FOLDED = [
        'expect(a === b).toBe(true);',
        'expect(a !== b).toBe(false);',
        'expect(a > b).toBeTruthy();',
        'expect(a <= b).not.toEqual(false);',
        'assert(a === b);',
        'assert.ok(a < b);',
        'expect(a).toBe(b);',
        'expect(count(a === b)).toBe(true);',
        'expect(xs.filter(x => x)).toEqual([]);',
        'expect(a === b).toEqual(answer);',
        "assert.equal(total, 3, 'a < b');",
    ];
    for (const line of FOLDED) sameAsValidator(`folded or not: ${line}`, one(inTest(line)));

    sameAsValidator('one test body written twice', one("it('first', () => {\n    expect(a).toBe(1);\n});\nit('second', () => {\n    expect(a).toBe(1); // the same\n});\n"));
    sameAsValidator('two test bodies that differ in a literal', one("it('first', () => {\n    expect(a).toBe('x');\n});\nit('second', () => {\n    expect(a).toBe('y');\n});\n"));
    sameAsValidator('one test body in two files', { 'agile.test.ts': inTest('expect(bank).toHaveLength(400);'), 'devops.test.ts': inTest('expect(bank).toHaveLength(400);') });
    sameAsValidator('a helper renamed in its second spec file', {
        'a.test.ts': 'function startQuiz(page) {\n    return page.click("#start");\n}\n',
        'b.test.ts': 'function beginQuiz(page) {\n    // the same, renamed\n    return page.click("#start");\n}\n',
    });
    sameAsValidator('a constant that differs only in its string', { 'a.test.ts': "const HOST = 'http://a';\n", 'b.test.ts': "const HOST = 'http://b';\n" });
    sameAsValidator('a constant computed from imports', {
        'a.test.js': 'const require = createRequire(import.meta.url);\nconst bank = [...juniorQuestions];\n',
        'b.test.js': 'const require = createRequire(import.meta.url);\nconst bank = [...juniorQuestions];\n',
    });
    sameAsValidator('one helper name with two bodies', {
        'a.test.js': 'async function sit(count) {\n    return count;\n}\n',
        'b.test.js': 'async function sit(playerId, count) {\n    return [playerId, count];\n}\n',
    });
    sameAsValidator('an expected value imported from src and from support', one("import { LIMIT } from '../src/caps.js';\nimport { HOST } from './support/api';\n" + inTest('expect(cap).toBe(LIMIT);\nexpect(url).toBe(HOST);')));
    sameAsValidator('a camelCase import as the expected value', one("import { backendTrack } from '../src/role-track.js';\n" + inTest('expect(track).toBe(backendTrack);')));
    sameAsValidator('a local literal const and an object const', one('const SITTING = 99;\nconst SAVED = { id: 1 };\n' + inTest('expect(total).toBe(SITTING);\nexpect(read).toEqual(SAVED);')));
    sameAsValidator('a chai boolean that collapses a call', one(inTest('expect(ids.some(id => id > 1)).to.eq(true);')));

    const FAILING_FILES = {
        'control flow': inTest('if (a) expect(a).toBe(1);'),
        'ambient state': inTest('const now = Date.now();\nexpect(a).toBe(1);'),
        'a fixed sleep': inTest('setTimeout(done, 10);\nexpect(a).toBe(1);'),
        'no assertion': inTest('store.create(1);'),
        'a folded comparison': inTest('expect(a === b).toBe(true);'),
        'a test written twice': inTest('expect(a).toBe(1);') + inTest('expect(a).toBe(1);'),
    };
    for (const [name, source] of Object.entries(FAILING_FILES)) sameAsValidator(`a file with ${name}`, one(source));
    sameAsValidator('a helper copied into two spec files', {
        'a.test.ts': 'function startQuiz(page) {\n    return page.click("#start");\n}\n',
        'b.test.ts': 'function startQuiz(page) {\n    return page.click("#start");\n}\n',
    });
    sameAsValidator('a clean file with a weak assertion', one(inTest('expect(session).toBeDefined();')));
});
