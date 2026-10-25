# Large and dynamic document bounds

`runtime-bounds.spec.ts` exercises the public Engine Run controller with all three Scenarios on two original HTTP fixtures at a 1280×900 viewport:

- `large-document`: 500 rendered eligible text owners in ordinary wrapping paragraphs. Each Scenario must restore successfully, retain 500 eligible targets, and produce no Finding on the flexible layout.
- `dynamic-layout`: one clipping boundary alternates between 180 and 260 CSS pixels every animation frame, alongside a stable positive control. The unstable comparison must remain inconclusive without a Finding attributed to it, while the stable boundary still produces a supported Finding.

Every Run plus Restore is asserted below 8,000 ms. In the initial Chrome 155.0.8059.85/macOS run, all six browser tests passed and each entire test (including fixture setup and module import) took approximately 0.39–0.55 seconds. Metrics are attached as synthetic JSON for reporters that retain attachments; assertion failures show actual elapsed time.

These are measured fixture budgets, not a hard deadline for arbitrary DOM sizes or hostile page APIs. Work still depends on document size and browser scheduling. Frame waits are separately bounded to 1,000 ms and cancellation ends pending work; missing or unreliable samples remain inconclusive. Existing Scenario, Detector, replaced-node, geometry-tolerance, conflict, redaction, and lifecycle benchmarks remain the authority for their own policies.

```sh
pnpm build
pnpm exec playwright test tests/e2e/runtime-bounds.spec.ts --workers=2
```
