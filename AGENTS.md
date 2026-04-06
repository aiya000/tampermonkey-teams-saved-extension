# AGENTS.md

## Design Principles

Follow SOLID, KISS, YAGNI, and DRY.

## Git Rules

- Always use `git pull --rebase`; plain `git pull` is not allowed
- Never use `--no-verify`
- Keep each commit focused on a single purpose
- When addressing review feedback, use one commit per comment; do not bundle multiple fixes

## Naming

### Constants

Use `camelCase` for all constants, not `UPPER_SNAKE_CASE`:

```js
// Bad
const STORAGE_KEY = 'tse_v1'

// Good
const storageKey = 'tse_v1'
```

### Variable and function names

Name variables and functions so that the name and type together make the purpose clear. Do not embed type information in a name when the type already conveys it.

## Function Style

### Object methods

Use arrow functions in object literals, not method shorthand:

```js
// Bad
const store = {
  load() { ... },
  save(data) { ... }
}

// Good
const store = {
  load: () => { ... },
  save: (data) => { ... }
}
```

### Function size and responsibility

Each function should have a single, clear responsibility. When a function body grows to ~60 lines or more, extract sub-steps into named helper functions.

## Control Flow Style

### `if` statements

Always use braces, even for single-line bodies:

```js
// Bad
if (!root) return

// Good
if (!root) {
  return
}
```

### Null / undefined comparisons

Do not use falsy/truthy checks when comparing against `null` or `undefined`. Use explicit comparisons:

```js
// Bad
if (!root) { return }
if (gState.nativeRoot) { ... }

// Good
if (root === null) { return }
if (gState.nativeRoot !== null) { ... }
```

When a value may be both `null` and `undefined`, check both explicitly:

```js
// Bad
if (!foo || foo === null) { ... }

// Good
if (foo === null || foo === undefined) { ... }
```

This applies to all nullable values (`T | null`, `T | undefined`, optional chaining results, etc.).

## Comments

Write a comment when the intent behind code is not immediately obvious. Remove comments that restate what the code already expresses clearly.

### Overview and step comments belong in JSDoc

Do not write "overview" or "step" comments as standalone `//` comments above or inside a function. Put them in the function's JSDoc instead:

```js
// Bad — standalone comment above JSDoc
// el はカード要素またはその子孫
/**
 * @param {Element} el
 */
function getMessageId(el) {
  // ステップ1: IDを取り出す
  // ステップ2: フォールバック
}

// Good — all description in JSDoc
/**
 * Extracts a stable message ID from a card element.
 * Steps:
 *   1. Prefer the id attribute ("SavedSliceCardItem|{number}")
 *   2. Fall back to a cyrb53 hash of sender + text
 * @param {Element} el - A card element or its descendant
 * @returns {string}
 */
function getMessageId(el) { ... }
```

### Silenced exceptions

When a `catch` block intentionally ignores an error, add a comment explaining why:

```js
// Bad
} catch {
  return fallback
}

// Good
} catch {
  // JSON.parse throws on malformed input; fall back to empty state
  return fallback
}
```

## JSDoc Annotation Style

### Function doc comments

Always use multi-line format for `@param` and `@returns`. Never inline them on a single `/** ... */` line.

```js
// Bad
/** @param {string} str */
function cyrb53(str) { ... }

// Good
/**
 * @param {string} str
 */
function cyrb53(str) { ... }
```

For multiple params, one `@param` per line:

```js
/**
 * @param {string} msgId
 * @param {string} sender
 * @param {string} text
 * @param {string} status
 */
function markAs(msgId, sender, text, status) { ... }
```

### @param descriptions

When a parameter name is not self-explanatory, add a description after the name:

```js
/**
 * @param {string} msgId - Message ID: "SavedSliceCardItem|{number}" or "hash:{hash}"
 * @param {string} status - "done" or "archived"
 */
```

### String literal union types

When a string parameter or property has a fixed set of valid values, use a union of string literals instead of `string`. Put the union in the type, not in the description:

```js
// Bad — type information buried in description
/**
 * @param {string} status - "done" or "archived"
 */

// Good — type is self-documenting
/**
 * @param {'done' | 'archived'} status
 */
```

### `@type` annotations

Simple types are fine on one line:

```js
/** @type {string} */
const foo = ...
```

For object types without property descriptions, use multi-line `@type`:

```js
/**
 * @type {{
 *   tab: 'saved' | 'done' | 'archived',
 *   panel: HTMLElement | null,
 * }}
 */
```

When properties need descriptions, use `@typedef` + `@property` instead of inline `@type {{...}}`:

```js
// Bad — no room for property descriptions
/**
 * @type {{
 *   panel: HTMLElement | null, // 注入済みパネル要素
 * }}
 */

// Good — @typedef allows @property descriptions
/**
 * @typedef {object} GState
 * @property {'saved' | 'done' | 'archived'} tab - Active tab identifier
 * @property {HTMLElement | null} panel - The injected panel element
 */
/** @type {GState} */
const gState = { ... }
```

### `@returns` curly braces

The `{}` around the type is required in JSDoc to specify the return type. Always include it:

```js
// Bad  — TypeScript treats "boolean" as a description, not a type
/** @returns boolean */

// Good
/** @returns {boolean} */
```

### Union types

Always put spaces around `|` in union types:

```js
// Bad
/** @type {HTMLElement|null} */

// Good
/** @type {HTMLElement | null} */
```

## Type Safety

### Type guards over type assertions

Never use JSDoc type assertions (`/** @type {X} */ (expr)`). Use type guards instead.

Prefer `instanceof` checks for DOM elements:

```js
// Bad
const target = /** @type {HTMLInputElement} */ (e.target)

// Good
if (!(e.target instanceof HTMLInputElement)) {
  return
}
const file = e.target.files?.[0]
```

Prefer `typeof` checks for primitives:

```js
// Bad
const result = /** @type {string} */ (reader.result)

// Good
if (typeof reader.result !== 'string') {
  console.error('Expected reader.result to be a string, got:', reader.result)
  return
}
const imp = JSON.parse(reader.result)
```

For array filtering, rely on TypeScript's inferred type predicates (TypeScript 5.5+):

```js
// Array.from(...).filter(el => el instanceof HTMLElement)
// → inferred as HTMLElement[] automatically
```

Named type predicates in JSDoc (when needed):

```js
/**
 * @param {Element} el
 * @returns {el is HTMLElement}
 */
function isHTMLElement(el) {
  return el instanceof HTMLElement
}
```

### Global scope

Avoid polluting the global scope. In TypeScript projects, do not use `declare global` or `declare var` in application code; place global type extensions in dedicated `.d.ts` files.

## Code Design

### Extending vs. separating

When deciding whether to extend existing code or extract it into a new module:

- **Separate when**: the change spans multiple concerns, makes testing complex, or exceeds the module's current responsibility
- **Extend when**: the change fits within the existing responsibility and stays within the same file
- Ask: "Does this change fit within the existing module's responsibility?"

### Minimum change principle

Keep changes to existing code as small as necessary to achieve the goal.

### Tests

Do not re-implement production logic in tests to verify it — tests should assert the behavior of the actual production code. If a function is hard to test directly due to external dependencies, extract the pure logic into a separate function and test that.
