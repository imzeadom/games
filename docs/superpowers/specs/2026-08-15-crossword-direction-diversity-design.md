# Crossword Direction Diversity Design

## Goal

Every generated word-search puzzle must use a difficulty-appropriate mix of
word directions, so a valid board can never collapse into a single placement
pattern such as all vertical words or one repeated diagonal direction.

## Existing Behavior and Root Cause

`app/crossword/page.tsx` currently chooses a random allowed direction for each
placement attempt. A board is accepted as soon as every selected word fits.
There is no board-level direction validation, so random generation can return
a technically valid but repetitive puzzle.

## Required Direction Invariants

Directions are classified by orientation:

- horizontal: the row does not change;
- vertical: the column does not change;
- diagonal: both row and column change.

Directions are also classified by reading order:

- forward: rightward horizontal, downward vertical, or downward diagonal;
- reverse: leftward horizontal, upward vertical, or upward diagonal.

Every returned puzzle must satisfy these exact invariants:

- Easy: contains at least one horizontal word and at least one vertical word.
- Medium: contains at least one horizontal, one vertical, and one diagonal word.
- Hard: contains at least one horizontal, one vertical, and one diagonal word,
  and contains at least one forward and one reverse word.

The existing grid sizes, word counts, vocabulary filters, overlap rules,
selection behavior, scoring, and print behavior remain unchanged.

## Architecture

Move the generation-specific types, difficulty configuration, sampling,
placement, and validation into a pure crossword generator module. The React
page imports the public difficulty configuration and `makePuzzle` function;
UI state and interaction remain in the page.

The generator builds a randomized requirement sequence for the requested
difficulty. It assigns the required orientation and reading-order coverage to
the first placements, then selects freely from all allowed directions for the
remaining words. Candidate directions and starting cells remain randomized.
Longer words continue to be placed before shorter words to preserve the
current success rate.

Hard-mode requirements may be combined when possible: for example, a reverse
horizontal placement can satisfy both the horizontal and reverse requirements.
The assignment algorithm must still leave enough placements to cover every
remaining requirement. It must not depend on a fixed direction order, so
boards retain variation between games.

## Validation and Failure Handling

A pure validator derives every placed word's row and column step from its
stored positions and checks the difficulty invariants. A board is returned
only when all selected words were placed and validation succeeds.

If an individual placement cannot be found within the attempt limit, or a
complete board fails validation, generation restarts with an empty board.
After the existing board-attempt limit is exhausted, the generator throws the
existing `Unable to generate crossword puzzle` error. Invalid or partial
boards are never exposed to the UI or print flow.

## Testing

Add focused generator tests that invoke real generation code and assert:

- easy boards always contain both horizontal and vertical placements;
- medium boards always contain horizontal, vertical, and diagonal placements;
- hard boards always contain all three orientations and both reading orders;
- generated positions spell each selected word correctly in the returned
  letter grid;
- repeated generation across each difficulty preserves all invariants.

The existing rendered-output test, lint, production build, and full test suite
must continue to pass. Independent acceptance will review the implementation,
run the automated checks, and smoke-test the browser game and print generation.

## Delivery

After independent acceptance succeeds, commit all implementation changes on
the feature branch, fast-forward `main` to that branch, push `main` to GitHub,
and publish the resulting production build using the repository's Sites
hosting configuration.
