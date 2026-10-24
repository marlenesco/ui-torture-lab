# UI Torture Lab — Markdown Report

- Scenario: Unbreakable Text
- Run status: completed
- Lifecycle: Current Run Result
- Page origin: https\://fixture\.test
- Page path: /sample/
- Restore status: restored
- Reload required: no

Supported regressions were measured\.

## Coverage

- Eligible targets: 2
- Mutated targets: 1
- Excluded targets: 3
- Skipped targets: 1
- Safe-failed targets: 0
- Ineffective targets: 0
- Comparable targets: 1
- Inconclusive targets: 0
- Contributor targets: 1
- Findings: 4

## Findings

### Text Clipping

#### Finding 1

- Diagnostic locator: div\#boundary
- Scenario: Unbreakable Text
- Measured Delta: 20.25px
- Clipped axis: horizontal
- Baseline visible extent: 30px
- Mutated hidden extent: 20.25px
- Text Owner: span\#label
- Computed CSS: overflow-x hidden; overflow-y clip; white-space nowrap
- Primary affected range: span\#label
- Redacted preview: Public label
- Baseline range rectangles: left 1px, top 2px, right 31px, bottom 12px, width 30px, height 10px
- Mutated range rectangles: left 1px, top 2px, right 61px, bottom 12px, width 60px, height 10px
- Affected range 1: span\#label
- Redacted preview: Public label
- Baseline range rectangles: left 1px, top 2px, right 31px, bottom 12px, width 30px, height 10px
- Mutated range rectangles: left 1px, top 2px, right 61px, bottom 12px, width 60px, height 10px
- Possible Cause (hypothesis): A fixed boundary may clip expanded text\.

#### Finding 2

- Diagnostic locator: div\#second
- Scenario: Unbreakable Text
- Measured Delta: 10px
- Clipped axis: horizontal
- Baseline visible extent: 30px
- Mutated hidden extent: 20.25px
- Text Owner: span\#label
- Computed CSS: overflow-x hidden; overflow-y clip; white-space nowrap
- Primary affected range: span\#label
- Redacted preview: Public label
- Baseline range rectangles: left 1px, top 2px, right 31px, bottom 12px, width 30px, height 10px
- Mutated range rectangles: left 1px, top 2px, right 61px, bottom 12px, width 60px, height 10px
- Affected range 1: span\#label
- Redacted preview: Public label
- Baseline range rectangles: left 1px, top 2px, right 31px, bottom 12px, width 30px, height 10px
- Mutated range rectangles: left 1px, top 2px, right 61px, bottom 12px, width 60px, height 10px
- Possible Cause (hypothesis): A fixed boundary may clip expanded text\.

### Horizontal Containment Overflow

#### Finding 1

- Diagnostic locator: section\#container
- Scenario: Unbreakable Text
- Measured Delta: 18.5px
- Overflow side: inline-end
- Baseline maximum excess: 2px
- Mutated maximum excess: 20.5px
- Affected elements: 1
- Affected element: p\#content; side inline-end; baseline excess 2px; mutated excess 20.5px; delta 18.5px
- Possible Cause (hypothesis): An unbreakable item may exceed its boundary\.

### Viewport Overflow

#### Finding 1

- Diagnostic locator: target\-page
- Scenario: Unbreakable Text
- Measured Delta: 20.5px
- Finding Subject: Target Page
- Contribution side: inline-end
- Baseline: document extent 800px; viewport width 800px; excess 0px
- Mutated: document extent 820.5px; viewport width 800px; excess 20.5px
- Primary Contributor: p\#content; contribution 20.5px
- Primary Contributor geometry: baseline left 10px, right 800px; mutated left 10px, right 820.5px
- Contributor: p\#content; side inline-end; baseline excess 0px; mutated excess 20.5px; delta 20.5px; contribution 20.5px
- Possible Cause (hypothesis): A contributor may widen the document\.

## Restore

- Status: restored
- Conflicts: none

## Inconclusive reasons

None recorded.

## Limitations

Only the serialized, redacted result is included. Coverage is limited to the supported top-level light DOM and the selected Scenario. No Findings does not establish that the page has no layout problems. Possible Cause is a hypothesis.
