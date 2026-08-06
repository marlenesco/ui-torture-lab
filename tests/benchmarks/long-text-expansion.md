# Long Text expansion benchmark

Issue #5 fixes the MVP Long Text Expansion Factor at three and excludes source
content shorter than two grapheme clusters. One grapheme is commonly an
isolated glyph or symbol and is too weak a lexical source; two preserves terse
legitimate labels such as `OK`. The controlled fixture verifies both sides of
that boundary with excluded `!` and eligible `OK`. The choice is intentionally
not a user-selectable intensity.

The controlled Chrome benchmark uses a 290 px monospace label containing
`Checkout now!`. Twofold expansion remains on one line and therefore fails to
exercise wrapping. Threefold expansion crosses the boundary in two lines;
fourfold expansion also produces two lines without adding a distinct failure
condition. Three is therefore the smallest candidate that creates the intended
stress in this fixture.

The broader [`long-text-run`](../fixtures/pages/long-text-run/index.html)
fixture verifies the same factor against boundary whitespace, multiple inline
Text nodes, an emoji grapheme sequence, unsupported targets, and exact Restore.
The executable evidence lives in
[`long-text-factor-benchmark.spec.ts`](../e2e/long-text-factor-benchmark.spec.ts)
and [`long-text-run.spec.ts`](../e2e/long-text-run.spec.ts).

The benchmark also dogfoods the actual static build under `apps/site` at a
controlled 640 px viewport. The Engine first identifies the eligible nodes and
applies threefold expansion. The comparison then applies twofold expansion to
that exact target population with the same meaningful-interior and boundary-
whitespace rules. Threefold expansion produces more vertical layout stress
than both candidates, then restores the same Text nodes exactly. This uses
owned public product content rather than capturing or committing a third-party
page.

This bounded benchmark selects an MVP default; it does not claim that threefold
expansion models a translation ratio or every production interface.
