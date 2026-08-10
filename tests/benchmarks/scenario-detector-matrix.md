# Scenario and Detector matrix benchmark

Each of the nine MVP Scenario/Detector pairings takes two independent animation-frame samples before mutation and two after mutation. The detector-specific geometry tolerance is 0.5 CSS pixels. Viewport extent attribution alone retains the documented 1 CSS-pixel rounding allowance in [viewport-overflow-geometry.md](./viewport-overflow-geometry.md); it is not a severity threshold.

An animation-frame sample is bounded by a 1,000 ms timeout. A missing frame is recorded as detector-local inconclusive rather than reusing stale geometry or extending a Run without bound. The public Engine Run fixture covers all nine positive pairings and a changed Large Text style target; existing detector fixtures cover intentional exclusions, unstable/replaced nodes, and valid no-Finding cases.

Scenario intensities remain fixed and benchmarked: Long Text uses the content-derived factor in [long-text-expansion.md](./long-text-expansion.md), Unbreakable Text uses the canonical token in [unbreakable-token.md](./unbreakable-token.md), and Large Text uses the fixed scaling factor in [large-text-scaling.md](./large-text-scaling.md). Measurements remain natural-unit deltas only: no severity, confidence, or cross-detector ranking is assigned.
