# Large Text scaling benchmark

Issue #8 fixes the MVP Text Scaling Factor at two. The controlled Chrome
fixture uses a 240 px monospace label containing `Checkout now`. Its baseline
20 px font size and a 1.5x candidate remain on one line, so they do not
exercise normal reflow. The 2x candidate crosses the same wrap boundary in
two lines, making it the smallest tested factor that produces the intended
stress without a user-selectable intensity.

Large Text records each Text Scaling Target's own baseline computed pixel size
across one animation frame before any writes. It applies that value multiplied by two as an inline
`font-size` declaration with `!important`, which takes precedence over an
author stylesheet declaration of the same importance. The Engine verifies the
computed font size after application; an unverifiable or ineffective result is
locally inconclusive and remains conflict-aware restorable through the
Mutation Journal.

Icon fonts are excluded by their common computed font-family names and by a
Private Use Area codepoint in a direct text node. The latter conservatively
excludes unnamed icon fonts such as Dashicons without interpreting their
glyphs as regular copy.

The mechanism prototypes also cover a page with a strict `style-src 'none'`
CSP and a page rerender that replaces an applied target. In controlled Chrome,
the Engine's CSSOM property write still applies and Restore returns the exact
inline state. A rerender never rematches the replacement and instead produces
the established reload-required Restore conflict.

The broader [`large-text-run`](../fixtures/pages/large-text-run/index.html)
fixture verifies nested Text Scaling Targets, inherited baseline sizes,
fixed-height normal reflow, exclusions, exact Restore, and external style
conflicts. The executable evidence lives in
[`large-text-factor-benchmark.spec.ts`](../e2e/large-text-factor-benchmark.spec.ts)
and [`large-text-engine.spec.ts`](../e2e/large-text-engine.spec.ts).
