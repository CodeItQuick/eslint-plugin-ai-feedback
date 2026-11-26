# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This repository is an ESLint plugin, `eslint-plugin-ai-feedback`. Its rules replace checks that a skill gave an AI agent in prose or in a custom script. A rule message is the feedback that the agent reads. Each message must say what is wrong and what to do.

Each skill that is ported becomes one config in `index.js`. The `writing-tests` config ports `~/.claude/skills/writing-tests/scripts/validate-tests.mjs`. A validator failure is an `error`, and a validator warning is a `warn`.

## Commands

```powershell
npm test
```

```powershell
node --test tests/writing-tests.test.js
```

```powershell
node --test --test-name-pattern="no-weak-assertion"
```

Do not give `node --test` a directory. It reads a directory as a module and fails. Give it a file, or give it no path.

```powershell
npx eslint .
```

The repository lints itself with the `writing-tests` config. `tests/fixtures/` is ignored, because its files hold findings on purpose.

## Architecture

- `rules/` holds one rule for each file. `index.js` registers each rule and puts it in a config. A new rule must go in both places.
- `lib/tests.js` finds the test structure in the AST: test calls (`it`, `test`, `.only`, `.each`), hooks, helpers, `expect` chains and assert calls. Most rules start from `enclosingTest()` or `placeOf()`.
- `lib/files.js` reads files other than the linted file. ESLint gives a rule one file, so the cross-file rules (`no-copied-helper`, `no-same-name-helper`, and the support-helper part of `no-unrestored-fake`) parse other files with the active parser. The cache is keyed by the modification time of each file.
- When a check must warn in one place and fail in another, write one rule for each place. Examples are `no-ambient-input` and `no-ambient-input-in-helper`. ESLint gives one rule one severity.
- File-level exemptions, such as fake timers in the file, read `codeText()`. That text has its comments blanked, so a call named in a comment does not count.

## Tests

- `tests/writing-tests.test.js` holds the RuleTester cases for each rule. It runs RuleTester on `node:test`.
- `tests/validator-e2e/` checks parity with the validator:
  - The numbered `*.test.mjs` files are unchanged copies of `~/.claude/skills/writing-tests/scripts/e2e/`. Do not edit them. If the validator's suite changes, copy them again.
  - `validator-cli.mjs` replaces the validator's harness. It lints each case with ESLint and compares the exit status and the kind, file and line of each finding. When you add a rule that ports a validator check, add its rule ID to `KINDS`.
  - `00-unit-cases.test.mjs` runs each source through the installed validator and through the plugin, and compares every finding. If the validator is not installed, these cases are skipped.
- The README lists the intentional differences from the validator. Keep that list current.

## Commit Messages

Use Arlo's Commit Notation. Every commit summary starts with a risk level, a space, a change type, then the summary:

```
^ F Add no-held-read rule
. r Extract placeOf into lib/tests.js
! B Fix require-assertion for sinon.assert
```

**Risk level**: the first character.

| Code | Level | Meaning |
|------|-------|---------|
| `.` | (Proven) Safe | Addresses all known and unknown risks |
| `^` | Validated | Addresses all known risks |
| `!` | Risky | Some known risks remain unverified |
| `@` | (Probably) Broken | No risk attestation |

**Change type**: the second character. Uppercase means that the change alters program behavior. Lowercase means that it does not.

| Code | Type |
|------|------|
| `F` / `f` | Feature: change or extend one aspect of behavior, and alter no others |
| `B` / `b` | Bugfix: repair one undesirable behavior, and alter no others |
| `R` / `r` | Refactoring: change the implementation, not the behavior |
| `D` / `d` | Documentation: communicates to the team, with no behavior impact |
| `m` | Merge: the risk is the maximum risk of any commit in the branch |
| `t` | Test-only: alter tests, and do not alter behavior |
| `e` | Environment: tooling, config or linting, with no program behavior |
| `a` | Auto: formatting or code generation |
| `c` | Comment: comments only |
| `C` | Content: user-visible copy |
| `p` | Process: team process or working agreement |
| `s` | Spec: spec or design documents |
| `n` | NOP: empty commit |
| `@` | Unknown or multiple: usually written `@ @` |

**The 8-line rule:** A feature or bugfix that touches more than 8 lines, tests included, cannot claim `.` or `^`. Split the commit. Do not downgrade the claim.

`.gitmessage` holds this cheat sheet. It is registered with `git config --local commit.template .gitmessage`. A new clone must run that command again.
