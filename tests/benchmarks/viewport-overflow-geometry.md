# Viewport Overflow geometry prototype

The detector uses `document.documentElement.clientWidth` as the top-level layout viewport. It deliberately does not read `visualViewport`, zoom, iframe viewport, or vertical position.

For document extent it selects the largest of `clientWidth`, `offsetWidth`, and `scrollWidth` from both `documentElement` and `body`. The standards-mode fixture verifies the serialized extent equals that maximum after Unbreakable Text, verifies the viewport source is the root client width, and retains a 180.25 CSS-pixel containment boundary to exercise subpixel geometry. The same fixture includes the browser scrollbar-sensitive `clientWidth` path; its value remains the detector reference even when a platform renders overlay scrollbars.

`scrollWidth` and `offsetWidth` are integer CSS-pixel metrics while range and element rects preserve CSS-pixel fractions. A direct contributor may consequently end at most one CSS pixel below the selected document extent solely because the extent metric rounds upward. The detector permits that bounded one-pixel match only for the extent attribution; its independent before/after stability sampling remains 0.5 CSS pixels. The focused Engine test asserts the standard root/body maximum and retains the subpixel case, preventing a wider attribution tolerance.
