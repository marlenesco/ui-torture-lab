# UI Torture Lab — Markdown Report

- Scenario: Long Text
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
- Contributor targets: 0
- Findings: 1000

## Findings

### Text Clipping

<!-- finding block -->
#### Finding 1

- Diagnostic locator: div\#boundary
- Scenario: Long Text
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

<!-- finding block -->
## Restore

- Status: restored
- Conflicts: none

## Inconclusive reasons

None recorded.

## Limitations

Only the serialized, redacted result is included. Coverage is limited to the supported top-level light DOM and the selected Scenario. No Findings does not establish that the page has no layout problems. Possible Cause is a hypothesis.
