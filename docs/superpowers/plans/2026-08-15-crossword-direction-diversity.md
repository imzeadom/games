# Crossword Direction Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee a varied, difficulty-appropriate direction mix in every generated crossword puzzle.

**Architecture:** Extract puzzle generation into a pure TypeScript module with explicit direction metadata, requirement-aware placement, and a final invariant validator. Keep the React page responsible only for game state and interaction, and exercise the generator directly through Vite's TypeScript module loader in Node tests.

**Tech Stack:** TypeScript 5.9, React 19, Next/vinext, Vite 8, Node test runner

## Global Constraints

- Easy must contain at least one horizontal word and at least one vertical word.
- Medium must contain at least one horizontal, one vertical, and one diagonal word.
- Hard must contain at least one horizontal, one vertical, and one diagonal word, and at least one forward and one reverse word.
- Preserve existing grid sizes, word counts, vocabulary filters, overlap rules, selection behavior, scoring, and print behavior.
- Never return a partial board or a board that fails its difficulty invariant.
- Preserve the existing `Unable to generate crossword puzzle` terminal error.

---

## File Structure

- Create `app/crossword/generator.ts`: generation types, difficulty configuration, direction classification, constrained placement, invariant validation, and `makePuzzle`.
- Modify `app/crossword/page.tsx`: import generator types/configuration/function and remove duplicated generation code.
- Create `tests/crossword-generator.test.mjs`: direct behavioral tests for generated boards.
- Modify `tests/rendered-html.test.mjs`: read the extracted generator source and keep source-level regression assertions aligned with the new boundary.
- Modify `package.json`: include the focused generator test in the full test command.

### Task 1: Generator Behavior and Direction Constraints

**Files:**
- Create: `tests/crossword-generator.test.mjs`
- Create: `app/crossword/generator.ts`

**Interfaces:**
- Produces: `Difficulty`, `Word`, `PlacedWord`, `Puzzle`, `LEVELS`, `makePuzzle(difficulty: Difficulty): Puzzle`, and `directionTraits(positions: number[], size: number): { orientation: "horizontal" | "vertical" | "diagonal"; order: "forward" | "reverse" }`.
- Consumes: `VOCABULARY` and `VocabularyWord` from `app/crossword/vocabulary.ts`.

- [ ] **Step 1: Write the failing generator tests**

Create a Vite SSR test loader and assertions that inspect real generated positions:

```js
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let generator;
let vite;

before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  generator = await vite.ssrLoadModule("/app/crossword/generator.ts");
});

after(async () => vite?.close());

function traitsFor(puzzle) {
  return puzzle.words.map((word) => generator.directionTraits(word.positions, puzzle.size));
}

function assertSpelledCorrectly(puzzle) {
  for (const placed of puzzle.words) {
    assert.equal(
      placed.positions.map((position) => puzzle.letters[position]).join(""),
      placed.word,
    );
  }
}

test("easy puzzles always use horizontal and vertical words", () => {
  for (let index = 0; index < 50; index += 1) {
    const puzzle = generator.makePuzzle("easy");
    const orientations = new Set(traitsFor(puzzle).map(({ orientation }) => orientation));
    assert.deepEqual(orientations, new Set(["horizontal", "vertical"]));
    assertSpelledCorrectly(puzzle);
  }
});

test("medium puzzles always use horizontal, vertical, and diagonal words", () => {
  for (let index = 0; index < 50; index += 1) {
    const puzzle = generator.makePuzzle("medium");
    const orientations = new Set(traitsFor(puzzle).map(({ orientation }) => orientation));
    assert.deepEqual(orientations, new Set(["horizontal", "vertical", "diagonal"]));
    assertSpelledCorrectly(puzzle);
  }
});

test("hard puzzles always mix orientations and reading orders", () => {
  for (let index = 0; index < 50; index += 1) {
    const puzzle = generator.makePuzzle("hard");
    const traits = traitsFor(puzzle);
    assert.deepEqual(
      new Set(traits.map(({ orientation }) => orientation)),
      new Set(["horizontal", "vertical", "diagonal"]),
    );
    assert.deepEqual(
      new Set(traits.map(({ order }) => order)),
      new Set(["forward", "reverse"]),
    );
    assertSpelledCorrectly(puzzle);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/crossword-generator.test.mjs`

Expected: FAIL because `/app/crossword/generator.ts` does not exist.

- [ ] **Step 3: Implement the pure constrained generator**

Define explicit `Direction` records containing `rowStep`, `columnStep`, `orientation`, and `order`. Define per-difficulty requirements:

```ts
type Orientation = "horizontal" | "vertical" | "diagonal";
type ReadingOrder = "forward" | "reverse";
type Requirement = Partial<Pick<Direction, "orientation" | "order">>;

const REQUIREMENTS: Record<Difficulty, Requirement[]> = {
  easy: [{ orientation: "horizontal" }, { orientation: "vertical" }],
  medium: [
    { orientation: "horizontal" },
    { orientation: "vertical" },
    { orientation: "diagonal" },
  ],
  hard: [
    { orientation: "horizontal", order: "forward" },
    { orientation: "vertical", order: "reverse" },
    { orientation: "diagonal" },
  ],
};
```

Shuffle requirement assignment per board while retaining coverage. For each required word, restrict candidate directions to those matching its requirement; for remaining words, use every direction allowed by the difficulty. Shuffle candidate directions and valid start cells rather than repeatedly selecting one direction with replacement. After placement, derive traits from positions and reject the board unless `satisfiesRequirements(difficulty, placed, size)` confirms every invariant.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/crossword-generator.test.mjs`

Expected: 3 tests pass, 0 fail, with 150 generated boards satisfying spelling and direction invariants.

- [ ] **Step 5: Run lint on the new module and tests**

Run: `npx eslint app/crossword/generator.ts tests/crossword-generator.test.mjs`

Expected: exit 0 with no errors or warnings.

- [ ] **Step 6: Commit the generator slice**

```bash
git add app/crossword/generator.ts tests/crossword-generator.test.mjs
git commit -m "feat: guarantee crossword direction diversity"
```

### Task 2: React Integration and Regression Coverage

**Files:**
- Modify: `app/crossword/page.tsx`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Difficulty`, `Puzzle`, `LEVELS`, and `makePuzzle` from `app/crossword/generator.ts`.
- Produces: unchanged `/crossword` UI, gameplay, and print behavior.

- [ ] **Step 1: Update the source-boundary regression test first**

Read `app/crossword/generator.ts` alongside the page source, then assert that the page imports `makePuzzle` and that the generator contains the invariant configuration:

```js
const generator = await readFile(
  new URL("../app/crossword/generator.ts", import.meta.url),
  "utf8",
);
assert.match(crossword, /import[\s\S]*makePuzzle[\s\S]*from "\.\/generator"/);
assert.match(generator, /orientation: "horizontal"/);
assert.match(generator, /orientation: "vertical"/);
assert.match(generator, /orientation: "diagonal"/);
assert.match(generator, /order: "reverse"/);
```

- [ ] **Step 2: Run the rendered test and verify RED**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL because the page still defines and calls its local generator instead of importing the extracted one.

- [ ] **Step 3: Integrate the generator and full test command**

Remove local `Difficulty`, word/puzzle types, `LEVELS`, `shuffled`, `sampleVocabulary`, and `makePuzzle` from the page. Import the same public names from `./generator`. Change `package.json` to:

```json
"test": "npm run build && node --test tests/*.test.mjs"
```

Keep every UI call site using `makePuzzle(difficulty)` unchanged.

- [ ] **Step 4: Run focused and rendered tests**

Run: `node --test tests/crossword-generator.test.mjs tests/rendered-html.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: Run the complete quality gate**

Run: `npm run lint`

Expected: exit 0 with no errors or warnings.

Run: `npm test`

Expected: production build succeeds and all Node tests pass.

- [ ] **Step 6: Commit the integration slice**

```bash
git add app/crossword/page.tsx tests/rendered-html.test.mjs package.json
git commit -m "test: cover crossword direction guarantees"
```

### Task 3: Independent Acceptance and Delivery

**Files:**
- Modify only if acceptance finds a concrete defect.

**Interfaces:**
- Consumes: complete feature branch and repository checks.
- Produces: independently accepted commit suitable for fast-forward delivery.

- [ ] **Step 1: Dispatch independent acceptance**

Give a fresh reviewer the confirmed design, commit range from `main` to feature HEAD, and this checklist: inspect direction classification, verify invariants cannot be bypassed, run focused tests, run lint and full tests, and smoke-test easy/medium/hard generation plus print-batch generation in the browser. The reviewer must report findings by severity and state PASS only when no blocking issue remains.

- [ ] **Step 2: Resolve and re-verify any findings**

For each valid finding, first add or adjust a test that reproduces it, observe RED, implement the smallest correction, observe GREEN, and rerun the complete quality gate. Ask the independent reviewer to recheck the resulting HEAD.

- [ ] **Step 3: Verify repository state before delivery**

Run: `git status --short --branch`

Expected: only the pre-existing untracked `test-results/` may remain; no feature files are uncommitted.

Run: `git log --oneline main..HEAD`

Expected: design, generator, and integration commits are present.

- [ ] **Step 4: Fast-forward main and verify the merged result**

Switch to `main`, run `git merge --ff-only feat/crossword-direction-diversity`, then rerun `npm run lint` and `npm test` from the merged `main` checkout. Do not proceed if either command fails.

- [ ] **Step 5: Push and publish**

Push `main` to `origin`. Package the unchanged successful production build according to the Sites hosting workflow, save a new site version for the existing project in `.openai/hosting.json`, deploy it, and poll until deployment status is `succeeded`.

- [ ] **Step 6: Confirm the live result**

Open the deployed `/crossword` route, generate each difficulty at least once, and confirm the deployment serves the new application version without runtime errors. Report the pushed commit, independent acceptance result, and deployed URL.
