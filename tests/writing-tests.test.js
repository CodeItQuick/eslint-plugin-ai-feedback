import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { fileURLToPath } from 'node:url';
import plugin from '../index.js';

const fixture = path => fileURLToPath(new URL(`fixtures/${path}`, import.meta.url));

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();
const run = (name, cases) => tester.run(name, plugin.rules[`writing-tests/${name}`], cases);

run('no-control-flow-in-test', {
    valid: [
        'describe("x", () => { for (const c of cases) it(c.name, () => { expect(f(c.in)).toBe(c.out); }); });',
        'function helper(x) { if (x) return 1; }',
        'test.skip(isWindows, "reason")',
    ],
    invalid: [
        { code: 'it("x", () => { if (a) expect(a).toBe(1); });', errors: [{ messageId: 'controlFlow', data: { kind: 'if' } }] },
        { code: 'test("x", async () => { try { await f(); } catch (e) { expect(e).toBe(1); } });', errors: 1 },
        { code: 'it("x", () => { items.forEach(i => expect(i).toBe(1)); });', errors: [{ data: { kind: 'forEach' }, messageId: 'controlFlow' }] },
        { code: 'it("x", () => { const v = a ?? b; expect(v).toBe(1); });', errors: 1 },
        // The validator does not report &&. This plugin does on purpose: `ready && expect(a).toBe(1)` skips the assertion.
        { code: 'it("x", () => { ready && expect(a).toBe(1); });', errors: [{ messageId: 'controlFlow', data: { kind: '&& fallback' } }] },
        { code: 'it("x", () => { for (const i of xs) expect(i).toBe(1); });', errors: 1 },
        { code: 'it.each([1])("x %s", n => { expect(n ? 1 : 2).toBe(1); });', errors: 1 },
    ],
});

run('no-focused-test', {
    valid: ['it("x", () => {})', 'thing.only()'],
    invalid: [
        { code: 'it.only("x", () => {})', errors: 1 },
        { code: 'test.describe.only("x", () => {})', errors: 1 },
    ],
});

run('require-assertion', {
    valid: [
        'it("x", () => { expect(1).toBe(1); });',
        'it("x", () => { assert.equal(1, 1); });',
        'it("x", () => { expectSaved(row); });',
        'it("x", () => { nodeAssert.ok(a); });',
        'it("x", () => { a.should.equal(1); });',
        'test.todo("later")',
    ],
    invalid: [{ code: 'it("x", () => { run(); });', errors: [{ messageId: 'unasserted' }] }],
});

run('no-folded-comparison', {
    valid: ['it("x", () => { expect(a).toBe(b); });', 'it("x", () => { expect(a === b).toBe(c); });'],
    invalid: [
        { code: 'it("x", () => { expect(a === b).toBe(true); });', errors: 1 },
        { code: 'it("x", () => { assert(a > 2); });', errors: 1 },
        { code: 'it("x", () => { expect(a !== b).to.be.true; });', errors: 1 },
        { code: 'it("x", () => { assert.equal(a < b, false); });', errors: 1 },
    ],
});

run('no-weak-assertion', {
    valid: ['it("x", () => { expect(a).toBe(3); });', 'it("x", () => { expect(a.length).toBeGreaterThan(2); });'],
    invalid: [
        { code: 'it("x", () => { expect(a).toBeDefined(); });', errors: [{ messageId: 'weak', data: { what: 'toBeDefined' } }] },
        { code: 'it("x", () => { expect(a).not.toBeNull(); });', errors: 1 },
        { code: 'it("x", () => { expect(a.length).toBeGreaterThan(0); });', errors: 1 },
        { code: 'it("x", () => { expect(typeof a).toBe("string"); });', errors: 1 },
        { code: 'it("x", () => { expect(a).to.be.ok; });', errors: 1 },
        { code: 'it("x", () => { assert.isArray(a); });', errors: 1 },
        { code: 'it("x", () => { expect(xs.every(x => x > 0)).toBe(true); });', errors: [{ messageId: 'collapsed', data: { what: 'x.every(…)' } }] },
    ],
});

run('no-ambient-input', {
    valid: [
        'vi.useFakeTimers(); it("x", () => { expect(Date.now()).toBe(0); });',
        'it("x", () => { expect(new Date("2020-01-01")).toBe(d); });',
        'vi.spyOn(Math, "random"); it("x", () => { expect(Math.random()).toBe(0.5); });',
    ],
    invalid: [
        { code: 'it("x", () => { expect(Date.now()).toBe(0); });', errors: [{ messageId: 'clock' }] },
        { code: 'it("x", () => { expect(Math.random()).toBe(0); });', errors: [{ messageId: 'random' }] },
    ],
});

run('no-ambient-input-in-helper', {
    valid: ['it("x", () => { expect(Date.now()).toBe(0); });', 'const NOW = Date.now();'],
    invalid: [
        { code: 'const stamp = () => new Date();', errors: [{ messageId: 'clock' }] },
        { code: 'beforeEach(() => { seed = Math.random(); });', errors: [{ messageId: 'random' }] },
    ],
});

run('no-fixed-sleep-in-helper', {
    valid: ['it("x", async () => { await page.waitForTimeout(5); });'],
    invalid: [{ code: 'async function settle(page) { await page.waitForTimeout(500); }', errors: [{ messageId: 'sleep' }] }],
});

run('no-fixed-sleep', {
    valid: ['vi.useFakeTimers(); setTimeout(f, 10);', 'await expect(page.getByText("x")).toBeVisible();'],
    invalid: [
        { code: 'it("x", async () => { await page.waitForTimeout(500); });', errors: 1 },
        { code: 'it("x", async () => { await new Promise(r => setTimeout(r, 10)); });', errors: 1 },
    ],
});

run('no-unrestored-fake', {
    valid: [
        'beforeEach(() => { vi.useFakeTimers(); }); afterEach(() => { vi.useRealTimers(); });',
        'it("x", () => { const s = vi.spyOn(a, "b"); }); afterAll(() => { vi.restoreAllMocks(); });',
        'const original = Math.random; it("x", () => { Math.random = () => 0; }); afterEach(() => { Math.random = original; });',
    ],
    invalid: [
        { code: 'it("x", () => { vi.useFakeTimers(); expect(1).toBe(1); vi.useRealTimers(); });', errors: [{ messageId: 'leak' }] },
        { code: 'it("x", () => { sinon.stub(a, "b"); });', errors: 1 },
        { code: 'it("x", () => { vi.stubEnv("A", "1"); }); afterEach(() => { vi.restoreAllMocks(); });', errors: 1 },
    ],
});

run('no-console-in-test', {
    valid: ['function debug() { console.log(1); }', 'it("x", () => { console.error(e); });'],
    invalid: [{ code: 'it("x", () => { console.log(result); });', errors: 1 }],
});

run('no-imported-expected-value', {
    valid: [
        'import { LIMIT } from "./limits.js"; it("x", () => { expect(clamp(LIMIT + 1)).toBe(10); });',
        'import { LIMIT } from "./support/limits.js"; it("x", () => { expect(a).toBe(LIMIT); });',
        'import { LIMIT } from "pkg"; it("x", () => { expect(a).toBe(LIMIT); });',
        'import { config } from "./config.js"; it("x", () => { expect(a).toBe(config); });',
    ],
    invalid: [
        { code: 'import { LIMIT } from "./limits.js"; it("x", () => { expect(clamp(99)).toBe(LIMIT); });', errors: [{ messageId: 'imported', data: { name: 'LIMIT', from: './limits.js' } }] },
        { code: 'import { LABELS } from "../labels.js"; it("x", () => { assert.equal(label(), LABELS.patience); });', errors: 1 },
    ],
});

run('no-duplicate-test-body', {
    valid: ['it("a", () => { expect(f(1)).toBe(1); }); it("b", () => { expect(f(2)).toBe(2); });'],
    invalid: [{
        code: 'it("a", () => { expect(f(1)).toBe(1); });\nit("b", () => {\n  // same\n  expect(f(1)).toBe(1);\n});',
        errors: [{ messageId: 'duplicate', data: { line: 1 }, line: 2 }],
    }],
});

run('no-unawaited-async-assertion', {
    valid: [
        'it("x", async () => { await expect(p).resolves.toBe(1); });',
        'it("x", () => expect(p).rejects.toThrow());',
        'it("x", () => { return expect(p).resolves.toBe(1); });',
        'it("x", async () => { expect(locator).toBeVisible(); });',
    ],
    invalid: [
        { code: 'it("x", async () => { expect(p).resolves.toBe(1); });', errors: 1 },
        { code: 'it("x", async () => { expect.poll(() => n).toBe(1); });', errors: 1 },
        { code: 'import { test, expect } from "@playwright/test"; test("x", async ({ page }) => { expect(page.getByText("x")).toBeVisible(); });', errors: 1 },
    ],
});

run('no-control-flow-in-helper', {
    valid: [
        'describe("x", () => { for (const c of cases) it(c.name, () => { expect(c.in).toBe(c.out); }); });',
        'it("x", () => { const pick = q => (q ? 1 : 2); expect(pick(1)).toBe(1); });',
        'const ORIGINAL = process.env.A; afterEach(() => { if (ORIGINAL === undefined) delete process.env.A; });',
    ],
    invalid: [
        { code: 'function answer(q) { if (q.multi) return q.all; return q.one; }', errors: [{ messageId: 'helper', data: { kind: 'if' } }] },
        { code: 'const choose = q => q.multi ? q.all : q.one;', errors: [{ messageId: 'helper', data: { kind: 'ternary' } }] },
        { code: 'beforeEach(() => { if (process.env.CI) seed(); });', errors: [{ messageId: 'hook', data: { kind: 'if' } }] },
    ],
});

run('no-named-expected-value', {
    valid: [
        'const EXPECTED = 3; it("x", () => { expect(f(EXPECTED)).toBe(3); });',
        'import { LIMIT } from "./x.js"; it("x", () => { expect(a).toBe(LIMIT); });',
        'const ITEMS = [1]; it("x", () => { expect(a).toEqual(ITEMS); });',
    ],
    invalid: [
        { code: 'const EXPECTED = 3; it("x", () => { expect(f()).toBe(EXPECTED); });', errors: [{ messageId: 'named', data: { name: 'EXPECTED' } }] },
        { code: 'export const LABEL = "Patience"; it("x", () => { assert.equal(label(), LABEL); });', errors: 1 },
    ],
});

run('no-computed-expected-value', {
    valid: [
        'it("x", () => { expect(total(2)).toBe(2.16); });',
        'it("x", () => { expect(a).toBe(-1); });',
        'it("x", () => { expect(a).toBe("id-" + id); });',
        'it("x", () => { expect(a).toBe(LIMIT); });',
    ],
    invalid: [{ code: 'it("x", () => { expect(total(amount)).toBe(amount * 1.08); });', errors: [{ messageId: 'computed', data: { expression: 'amount * 1.08' } }] }],
});

run('no-env-in-test', {
    valid: [
        'it("x", () => { vi.stubEnv("A", "1"); expect(process.env.A).toBe("1"); });',
        'const A = process.env.A;',
    ],
    invalid: [{ code: 'it("x", () => { expect(read(process.env.HOME)).toBe(1); });', errors: 1 }],
});

run('no-network-in-test', {
    valid: [
        'vi.stubGlobal("fetch", f); it("x", async () => { await fetch("https://a.test"); });',
        'it("x", async () => { await fetch("/local"); });',
        'import { test } from "@playwright/test"; test("x", async () => { await fetch("https://a.test"); });',
    ],
    invalid: [
        { code: 'it("x", async () => { await fetch("https://api.example.com"); });', errors: 1 },
        { code: 'it("x", async () => { await axios.get(`https://api.example.com/${id}`); });', errors: 1 },
    ],
});

const PW = 'import { test, expect } from "@playwright/test"; ';

run('no-one-time-read-assertion', {
    valid: [
        PW + 'test("x", async ({ page }) => { await expect(page.getByText("a")).toBeVisible(); });',
        'it("x", async () => { expect(await box.isVisible()).toBe(true); });',
    ],
    invalid: [{
        code: PW + 'test("x", async ({ page }) => { expect(await page.getByText("a").isVisible()).toBe(true); });',
        errors: [{ messageId: 'unretried', data: { method: 'isVisible' } }],
    }],
});

run('no-held-read', {
    valid: [
        PW + 'test("x", async ({ page }) => { await expect(page.getByText("a")).toBeVisible(); const n = await page.locator("li").count(); expect(n).toBe(3); });',
        PW + 'test("x", async ({ page }) => { await expect(async () => { const n = await page.locator("li").count(); expect(n).toBe(3); }).toPass(); });',
        PW + 'test("x", async ({ page }) => { const n = await page.locator("li").count(); expect(other).toBe(3); });',
    ],
    invalid: [{
        code: PW + 'test("x", async ({ page }) => { const n = await page.locator("li").count(); expect(n).toBe(3); });',
        errors: [{ messageId: 'held', data: { name: 'n', method: 'count' } }],
    }],
});

run('no-shared-state', {
    valid: [
        'let cart; beforeEach(() => { cart = []; }); it("x", () => { cart = [1]; expect(cart).toEqual([1]); });',
        'let cart; it("x", () => { let cart = 1; cart = 2; expect(cart).toBe(2); });',
        'let n = 0; function bump() { n++; }',
    ],
    invalid: [{ code: 'let count = 0; it("a", () => { count++; expect(count).toBe(1); });', errors: [{ messageId: 'shared', data: { name: 'count' } }] }],
});

const bodyOfLines = lines => `it("x", () => {\n${'  expect(1).toBe(1);\n'.repeat(lines)}});`;

run('max-test-lines', {
    valid: [bodyOfLines(30), { code: bodyOfLines(5), options: [{ max: 5 }] }],
    invalid: [
        { code: bodyOfLines(31), errors: [{ messageId: 'long', data: { lines: 31, max: 30 } }] },
        { code: bodyOfLines(6), options: [{ max: 5 }], errors: [{ messageId: 'long', data: { lines: 6, max: 5 } }] },
    ],
});

run('no-own-module-mock', {
    valid: ['vi.mock("node:fs")', 'jest.mock("axios")'],
    invalid: [
        { code: 'vi.mock("../src/pricing.js")', errors: [{ messageId: 'mocked', data: { path: '../src/pricing.js' } }] },
        { code: 'jest.mock("@/db")', errors: 1 },
    ],
});

run('no-reassigned-let-in-test', {
    valid: ['it("x", () => { let a = 1; expect(a).toBe(1); });', 'let a; beforeEach(() => { a = 1; });'],
    invalid: [{ code: 'it("x", () => { let total = 1; total += 2; expect(total).toBe(3); });', errors: [{ messageId: 'reassigned', data: { name: 'total' } }] }],
});

const SPEC = fixture('copied/spec.test.js');

run('no-copied-helper', {
    valid: [
        { code: 'function signIn(page) { return page.goto("/home"); }', filename: SPEC },
        { code: 'function signIn(page) { return page.goto("/login"); }', filename: fixture('copied/other.test.js') },
    ],
    invalid: [
        {
            code: 'function logIn(page) {\n  // same code, new name\n  return page.goto("/login");\n}',
            filename: SPEC,
            errors: [{ messageId: 'copied', data: { name: 'logIn', other: 'signIn', file: 'tests/fixtures/copied/other.test.js' } }],
        },
        { code: 'const WELCOME = "hello there";', filename: SPEC, errors: 1 },
    ],
});

run('no-same-name-helper', {
    valid: [{ code: 'function openCart(page) { return page.goto("/cart"); }', filename: SPEC }],
    invalid: [{
        code: 'function openCart(page, id) { return page.goto(`/cart/${id}`); }',
        filename: SPEC,
        errors: [{ messageId: 'drifted', data: { name: 'openCart', files: 'tests/fixtures/copied/other.test.js' } }],
    }],
});

const STUBS = 'import { stubScore, resetScore, freezeClock } from "./support/stubs.js"; ';

run('no-unrestored-fake', {
    valid: [
        { code: STUBS + 'it("x", () => { stubScore(1); }); afterEach(resetScore);', filename: fixture('spec.test.js') },
        { code: STUBS + 'it("x", () => { stubScore(1); }); afterEach(() => { resetScore(); });', filename: fixture('spec.test.js') },
        { code: STUBS + 'it("x", () => { freezeClock(); });', filename: fixture('spec.test.js') },
    ],
    invalid: [
        {
            code: STUBS + 'it("x", () => { stubScore(1); });',
            filename: fixture('spec.test.js'),
            errors: [{ messageId: 'helperLeak', data: { helper: 'stubScore', from: './support/stubs.js', what: 'vi.stubGlobal()', needs: 'unstubAllGlobals()' } }],
        },
        {
            code: 'it("x", async () => { const { stubScore: stub } = await import("./support/stubs.js"); stub(1); });',
            filename: fixture('spec.test.js'),
            errors: 1,
        },
    ],
});
