# Inspection highlight recovery — issue #26

On 2026-10-26 the operator reported that Highlight subject showed no visible
outline, later displayed a rectangle over a different part of the page after
scrolling, and retained that rectangle after Restore. The actual Target Page was
the public Pages preview, not the local Text Clipping fixture initially assumed.
Those observations are supplementary website evidence; they do not pass the
controlled-fixture case. The operator reported that Long Text Restore returned
the original text. Private browser screenshots are not published here.

## Reproduction and cause

A small isolated native-extension harness reproduced both failures. On a 700px
viewport, an offscreen subject rectangle was drawn at y=1941.4px with scrollY=0.
After Navigate and Highlight followed by a 120px scroll, the subject moved to
y=218.4px but the fixed rectangle remained at y=338.4px. Range highlighting also
rendered below the viewport without scrolling. These are synthetic reproduction
coordinates, not measurements inferred from the operator's screenshot.

Highlight rendered fixed viewport coordinates once and did not reveal an
offscreen target. No scroll/resize listener refreshed those coordinates. Restore
released Engine references but left the static diagnostic rectangle rendered.
The existing Engine Evidence and ownership-safe text Restore were separate from
these UI defects.

## Correction and focused verification

- Subject highlighting reveals the live Subject or Primary Contributor with
  immediate native scrolling; range highlighting reveals the first affected text
  owner. Page smooth-scroll styles cannot race the initial geometry read.
- A dedicated diagnostic renderer coalesces page/nested scrolling and resize into
  one animation frame. Each refresh resolves the existing live Finding reference,
  never a selector replacement, and reads current rectangles without creating
  new Detector Evidence or changing saved results.
- Restore, Run end, unavailable live references and panel close remove rectangles,
  cancel pending frames and release listeners/readers. Scroll cannot revive a
  closed overlay or a completed Run's live reference.
- The native `inspection-highlights` regression fixture covers offscreen Subject
  and range actions, smooth-scroll independence, page/nested scrolling, resize,
  Restore/Close/navigation cleanup, replacement refusal and Viewport Overflow's
  Primary Contributor. Both offscreen tests failed before the correction; the
  focused nine-case suite passed afterward on Chrome 155/macOS.

The change adds no permission, network path, persistence, MAIN-world helper or
automatic Run. Native scrolling remains an explicit inspection action after
Evidence capture; automatic geometry refresh does not move the page again.

The runtime artifact changes, so previous draft ZIPs and Store screenshot hashes
cannot represent the corrected candidate. Regenerate Store assets from the
recorded corrected runtime and build the next ZIP only from the selected public
source after merge. The real-toolbar retest and remaining macOS/Windows/Linux
manual checks are still pending. Technical Validation and issue #26 remain open.
