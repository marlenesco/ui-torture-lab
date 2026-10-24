# UI Torture Lab — Markdown Report

- Scenario: Large Text
- Run status: completed
- Lifecycle: Current Run Result
- Page origin: https\://fixture\.test
- Page path: /caffè/東京/
- Restore status: restored
- Reload required: no

Caffè 東京 😺

## Coverage

- Eligible targets: 2
- Mutated targets: 1
- Excluded targets: 3
- Skipped targets: 1
- Safe-failed targets: 0
- Ineffective targets: 0
- Comparable targets: 1
- Inconclusive targets: 0
- Contributor targets: 0
- Findings: 1

## Findings

### Text Clipping

#### Finding 1

- Diagnostic locator: \`\[x\]\(https\://evil\.test\) &lt;img&gt; &amp; \*\*bold\*\*&#10;\# Heading&#13;&#10;\| cell \| \\ 😺
- Scenario: Large Text
- Measured Delta: 20.25px
- Clipped axis: horizontal
- Baseline visible extent: 30px
- Mutated hidden extent: 20.25px
- Text Owner: span\#label
- Computed CSS: overflow-x hidden; overflow-y clip; white-space nowrap
- Primary affected range: span\#label
- Redacted preview: Caffè 東京 😺 &lt;b&gt;&amp;\`\[redacted\]
- Baseline range rectangles: none
- Mutated range rectangles: none
- Possible Cause (hypothesis): \`\[x\]\(https\://evil\.test\) &lt;img&gt; &amp; \*\*bold\*\*&#10;\# Heading&#13;&#10;\| cell \| \\ 😺

## Restore

- Status: restored
- Conflicts: none

## Inconclusive reasons

None recorded.

## Limitations

Only the serialized, redacted result is included. Coverage is limited to the supported top-level light DOM and the selected Scenario. No Findings does not establish that the page has no layout problems. Possible Cause is a hypothesis.
