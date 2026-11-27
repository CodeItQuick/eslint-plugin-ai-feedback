# eslint-plugin-ai-feedback

ESLint rules that replace checks that a skill gave an AI agent in prose or in a custom script.
A lint error reaches the agent in the editor loop, with a file, a line and a fix.

Each rule message tells the agent what is wrong and what to do.

## Use

```js
// eslint.config.js
import aiFeedback from 'eslint-plugin-ai-feedback';

export default [aiFeedback.configs['writing-tests']];
```

For TypeScript test files, add the `typescript-eslint` parser for the same `files` glob.

## Configs

### `writing-tests`

Ported from `~/.claude/skills/writing-tests/scripts/validate-tests.mjs`.
A validator failure is an `error`. A validator warning is a `warn`.
Each rule ID has the `writing-tests/` prefix, for example `ai-feedback/writing-tests/no-focused-test`.

| Rule | Level | Catches |
|------|-------|---------|
| `no-control-flow-in-test` | error | `if`, `switch`, `try`, ternary, `&&`, `\|\|`, `??`, loops, `forEach` in a test body |
| `no-focused-test` | error | `.only` |
| `require-assertion` | error | a test with no `expect`, `assert` or `.should` |
| `no-folded-comparison` | error | `expect(a === b).toBe(true)`, `assert(a > b)` |
| `no-imported-expected-value` | error | an expected value that is a SCREAMING_CASE import from the code under test |
| `no-duplicate-test-body` | error | two tests with the same body in one file |
| `no-copied-helper` | error | a top-level helper or string constant with the same body as one in another spec file, under any name |
| `no-unrestored-fake` | error | a fake timer, spy, stub or env stub with no restore in an after-hook, also when an imported support helper sets it |
| `no-ambient-input` | error | `Date.now()`, `new Date()`, `Math.random()` in a test body, in a file that does not control them |
| `no-fixed-sleep` | error | `waitForTimeout()`, `setTimeout()` without fake timers, in a test body |
| `no-unawaited-async-assertion` | error | `resolves`, `rejects`, `expect.poll` and Playwright web-first matchers with no `await` |
| `no-one-time-read-assertion` | error | Playwright `expect(await locator.isVisible())` |
| `no-weak-assertion` | warn | `toBeDefined()`, `toBeTruthy()`, `> 0`, `typeof`, `xs.every(…)` collapsed to a boolean |
| `no-console-in-test` | warn | `console.log` in a test body |
| `no-control-flow-in-helper` | warn | a branch or loop in a test-file helper or hook |
| `no-ambient-input-in-helper` | warn | the same as `no-ambient-input`, in a test-file helper or hook |
| `no-fixed-sleep-in-helper` | warn | the same as `no-fixed-sleep`, in a test-file helper or hook |
| `no-named-expected-value` | warn | an expected value that is a module-level `const` for a literal |
| `no-computed-expected-value` | warn | an expected value computed with arithmetic, such as `amount * 1.08` |
| `no-env-in-test` | warn | `process.env` in a test, in a file that does not stub it |
| `no-network-in-test` | warn | `fetch("https://…")` and similar in a test, in a file that does not stub the network |
| `no-held-read` | warn | Playwright `const n = await locator.count()`, then `expect(n)` |
| `no-shared-state` | warn | a `let` that a test assigns and no `beforeEach` resets |
| `no-same-name-helper` | warn | one helper name with a different body in another spec file |
| `max-test-lines` | warn | a test body over 30 lines. Set `{ max }` to change the limit. |

### `writing-tests-info`

The `writing-tests` rules, plus the validator's `--info` lines as warnings:

| Rule | Catches |
|------|---------|
| `no-own-module-mock` | `vi.mock('./…')` or `jest.mock('@/…')` of a module of the project |
| `no-reassigned-let-in-test` | a `let` that a test declares and then reassigns |

## Cross-file rules

`no-copied-helper`, `no-same-name-helper` and `no-unrestored-fake` read files other than the one that ESLint lints.

- `no-copied-helper` and `no-same-name-helper` read every test file under the working directory. If `.claude/writing-tests/config.json` lists `roots`, they read only those roots.
- `no-unrestored-fake` reads each module that the spec imports from a relative path, one level deep.
- A file that does not parse is skipped.
- Each copy of a pair gets a report, so the counts are twice the validator's counts.

## Parity with validate-tests.mjs

`tests/validator-e2e/` runs the validator's own cases against the plugin:

- The `0*-*.test.mjs` and `10-*.test.mjs` files are unchanged copies of `~/.claude/skills/writing-tests/scripts/e2e/`. Their `validator-cli.mjs` is replaced by one that lints with ESLint. It compares the exit status and the kind, file and line of each finding.
- `00-unit-cases.test.mjs` runs each source from `validate-tests.test.mjs` through the installed validator and through the plugin, and compares every finding. If the validator is not installed, these cases are skipped.

If the validator's suite changes, copy the e2e files again.

These differences are intentional:

- `max-test-lines` defaults to 30. The validator uses 20. The parity tests set 20.
- `no-control-flow-in-test` also reports `&&`. The validator does not.
- `no-copied-helper` and `no-same-name-helper` report in each file of a pair. The validator prints one line for each pair.
- `require-assertion` counts a call only when a callee name starts with `expect` or `assert`, or ends with `Assert`. The validator also counts a property read such as `expected.total`.

## Test

```powershell
npm test
```
