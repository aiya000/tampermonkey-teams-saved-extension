# AGENTS.md

## Naming

### Constants

Use `camelCase` for all constants, not `UPPER_SNAKE_CASE`:

```js
// Bad
const STORAGE_KEY = 'tse_v1'

// Good
const storageKey = 'tse_v1'
```

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

### Function size

When a function body grows to ~60 lines or more, extract sub-steps into named helper functions. Prefer small, well-named functions over long inline blocks.

## Control Flow Style

### if statements

Always use braces, even for single-line bodies:

```js
// Bad
if (!root) return
if (condition)
  return

// Good
if (!root) {
  return
}
```

### Null / undefined comparisons

Do not rely on falsy/truthy checks when comparing against `null` or `undefined`. Use explicit comparisons:

```js
// Bad
if (!root) { return }
if (throttle) { return }
if (gState.nativeRoot) { ... }

// Good
if (root === null) { return }
if (throttle !== null) { return }
if (gState.nativeRoot !== null) { ... }
```

This applies to all nullable values (`T | null`, `T | undefined`, optional chaining results, etc.).

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
/** @param {Foo|Bar} x */

// Good
/** @type {HTMLElement | null} */
/** @param {Foo | Bar} x */
```

## Comments

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
  console.error('Expected reader.result to be a string, got:', reader.result) // Or, considering throw new Error(...)
  return                                                                      //
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
