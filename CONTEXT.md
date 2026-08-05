# UI Torture Lab

UI Torture Lab helps people who can change a web interface expose and reproduce concrete failures under adverse content and display conditions before release.

## Product Boundary

**Supported Browser**:
The current stable desktop release of Google Chrome on macOS, Windows, and Linux, using Manifest V3 in a normal browsing context. The MVP manifest disallows Incognito operation, and other Chromium browsers may work but are not supported.
_Avoid_: Chromium browsers, cross-browser extension

**Permission Budget**:
The MVP's fixed install-time capabilities: `activeTab`, `scripting`, and `storage`, with no persistent host access or permissions reserved for possible future features.
_Avoid_: Capability wishlist

**Explicit Page Grant**:
The product-level authorization created only by a toolbar action for one logical Target Page in the current top-level Document. Any top-level `pagehide` or reliably observed same-document navigation invalidates it even when Chrome retains the same Document, JavaScript heap, or technical access grant.
_Avoid_: Persistent site access

**Trusted Extension Context**:
An extension-owned context permitted to validate and access the Current Run Result in session storage. Target Page scripts and content scripts do not receive direct storage access.
_Avoid_: Content script, Target Page

**Isolated Execution Boundary**:
The Chrome `ISOLATED` world in which all MVP code operating directly on the Target Page executes using only shared DOM, CSSOM, and rendering state. No executable helper, message bridge, framework integration, or fallback enters the page's `MAIN` world, while the page remains free to mutate the shared DOM.
_Avoid_: JavaScript sandbox, immutable page, MAIN-world bridge

**Unsupported Page**:
A browser-protected, non-HTML, or non-HTTP(S) top-level surface where the MVP does not inject or initialize a Run, reported as a platform restriction rather than as a Detector failure. Direct `file:`, `data:`, `blob:`, browser-internal, and extension documents remain unsupported even when Chrome can be configured to expose them.
_Avoid_: Failed Run

**Official Website**:
The public, static, pre-installation source of truth for the product promise, privacy model, permissions, Supported Scope, and usage documentation.
_Avoid_: Dashboard, web application

**Supported Scope**:
The documented boundary of browsers, documents, Scenarios, Detectors, workflows, and exclusions for which the MVP makes an explicit reliability claim.
_Avoid_: Roadmap, possible compatibility

**Public Product Contract**:
The consistent claims shared by the Official Website and Chrome Web Store listing about capabilities, limitations, permissions, privacy, retention, and support.
_Avoid_: Marketing roadmap

**Public Source Repository**:
The complete open-source monorepo used to develop and produce the official extension, Engine, Official Website, tests, fixtures, and product documentation. It is the inspectable source behind the Public Product Contract rather than a simplified mirror of a private implementation.
_Avoid_: Public mirror, source-available snapshot

**Official Distribution**:
A UI Torture Lab release published through the maintainer-identified Official Website, Public Source Repository, and Chrome Web Store channels and therefore covered by the project's Public Product Contract. Modified distributions and forks permitted by the source license are not Official Distributions unless explicitly designated as such.
_Avoid_: Any fork, any compatible build

**Free MVP Access**:
The Official Distribution makes every MVP capability available without payment, account, registration, subscription, license key, usage limit, advertising, or feature gate. Optional external sponsorship does not unlock capabilities or change product behavior.
_Avoid_: Free tier, free trial, free to get started

**Best-Effort Support**:
The public maintenance model under which reproducible reports concerning the latest Official Distribution within the Supported Scope may be evaluated as product bugs, without any promise of individual assistance, response or resolution time, feature delivery, or backward compatibility.
_Avoid_: SLA, guaranteed support, application consulting

**Chrome Extension Adapter**:
The application-layer boundary that owns Chrome-specific tab lifecycle, session storage, permissions, script communication, and extension UI integration without leaking those APIs into the domain model or Detectors.
_Avoid_: Cross-browser abstraction framework

**Engine**:
The DOM- and CSS-aware package that owns Run orchestration, Scenarios, Mutations, measurements, Detectors, Findings, Restore, serialization, redaction, and Markdown formatting while remaining independent of React, WXT, and Chrome Extension APIs.
_Avoid_: Node.js-only core, extension adapter

**Extension UI**:
The detachable extension-owned interface and diagnostic overlays that remain outside the Target Scope and are excluded from traversal, eligibility, Mutation, measurement, contributor discovery, and Evidence. Visibility, collapse, unmount, or loss of this client does not own, Restore, or terminate an Active Run.
_Avoid_: Target Page content

**Measurement-Safe UI State**:
An unchanged Extension UI configuration used symmetrically during Baseline and mutated measurement and proven not to alter the layout viewport, document scroll extent, or Detector Evidence.
_Avoid_: Detector compensation

**Diagnostic Highlight**:
An extension-owned visual aid rendered only after Evidence capture to identify Finding Subjects, contributors, or affected ranges without participating in subsequent measurements.
_Avoid_: Evidence

## Language

**Primary User**:
A frontend developer testing a web interface they own or can modify, already open in their browser, during development, review, or before release.
_Avoid_: Core user, target user

**Secondary User**:
A QA engineer, UX/UI designer, full-stack developer, or student who can use technical findings to improve an interface but does not determine the MVP workflow.

## Testing

**Technical Validation**:
The fixture, benchmark, lifecycle, privacy, and browser validation that demonstrates whether the Engine and Official Distribution satisfy their explicit behavioral contracts.
_Avoid_: Usability validation

**Product Validation**:
Observed, formative evaluation with independent frontend developers that demonstrates whether the Primary User can complete the primary workflow, correctly interpret the result, investigate the relevant code area, Restore safely, and produce a useful Markdown Report without substantive assistance. It collects only voluntary, redacted feedback and is not measured by Finding count.
_Avoid_: Analytics, telemetry, technical benchmark

**Target Page**:
The top-level HTML document currently open over HTTP or HTTPS that the Primary User owns or can modify and has explicitly chosen to stress-test. Local development is supported through localhost or another local web server, not through direct file access.
_Avoid_: Test page, subject page

**Target Scope**:
The functional area subjected to a Run. In the MVP it is always the entire top-level document of the Target Page.
_Avoid_: Selected element, component scope

**Traversal Scope**:
The portions of the Target Page that Scenarios and Detectors may inspect. In the MVP it contains only the top-level document's light DOM and excludes iframe documents, Shadow DOM, and the extension interface.
_Avoid_: Target Scope

**Mutation Eligibility**:
A Scenario's explicit rules for deciding which nodes within the Traversal Scope may be changed safely and meaningfully.
_Avoid_: Target Scope

**Measurement Eligibility**:
A Detector's explicit rules for deciding which elements within the Traversal Scope can provide relevant and reliable Evidence.
_Avoid_: Mutation Eligibility

**Torture Session**:
The developer's temporary period of work with one Target Page, during which they may perform multiple Runs manually. A Torture Session does not imply persistence or cross-Run aggregation.
_Avoid_: Test suite, batch

**Run**:
The lifecycle that applies exactly one Scenario to the current Target Page and keeps its Mutations active during inspection independently of Extension UI visibility. It ends through explicit Restore, Page Exit, observed same-document navigation, tab termination, or an Engine-controlled safety abort. A new Run cannot begin until the previous Run has been safely restored or its document has ended.
_Avoid_: Test, suite execution

**Page Exit**:
The top-level `pagehide` boundary that always invalidates the Explicit Page Grant, stops the Active Run, and triggers an immediate synchronous conflict-aware best-effort Restore without relying on messaging, storage, React, timers, or another rendering frame. A later BFCache restoration never resumes the former Run.
_Avoid_: Guaranteed cleanup, unload, UI unmount

**Document Runtime**:
The single in-memory Engine instance associated with one current top-level Document, owning Active Run State independently of any detachable Extension UI. Reopening the UI reconnects to this existing runtime rather than acquiring a new Baseline or applying Mutations again.
_Avoid_: React root, Shadow host, service worker state

**Run Phase**:
The Engine-owned state of a Run's lifecycle, changed only through explicit domain transitions rather than UI component state.
_Avoid_: Panel view, React state

**Run Snapshot**:
An immutable, internally consistent view of current Engine state exposed to the extension UI without granting access to Engine internals or Mutation ownership.
_Avoid_: Mutable store

**Run Command**:
An explicit request sent by the extension UI to the Engine to begin or advance a valid domain transition, such as starting one Scenario or requesting Restore.
_Avoid_: Direct DOM mutation

**Active Run State**:
The in-memory, non-serializable operational state required for measurement, node identity, Mutation ownership, and Restore. It is destroyed when the Run ends or loses its document and is never persisted.
_Avoid_: Run Result

**Current Run Result**:
The single reduced, serializable, and redacted result retained for one tab after its latest Run, without DOM references, full page content, Mutation Journal, or automatic screenshots.
_Avoid_: Run history, Active Run State

**Markdown Report**:
The deterministic, human-readable representation of exactly one serialized Current Run Result, containing no data absent from the visible redacted result.
_Avoid_: Rich export, hidden payload

**Copy Report**:
The explicit user action that sends the visible Markdown Report to the clipboard or presents the same Markdown for manual copying when permissionless clipboard access is unavailable.
_Avoid_: Automatic export

**Previous-Target Snapshot**:
A Current Run Result retained after its Explicit Page Grant is invalidated by reload, document replacement, or observed same-document navigation. It remains available for evidence inspection only, with all live DOM actions disabled and no attempt to rematch its elements even when the same Document survives.
_Avoid_: Live result, previous-document only

**Scenario**:
A deterministic content or presentation stress condition applied to the Target Page within one Run.
_Avoid_: Test case, preset

### MVP Scenarios

**Long Text**:
A content-derived Scenario that deterministically expands each Eligible Text Node in place using lexical material from that same node while preserving normal wrapping opportunities, node identity, page structure, and boundary whitespace.
_Avoid_: Lorem ipsum replacement

**Eligible Text Node**:
A visible, meaningful text node that a Scenario can mutate in place without crossing node boundaries, changing page structure, compromising normal text behavior, or making Restore unreliable.
_Avoid_: Every text node

**Original Text Value**:
The exact value of an Eligible Text Node captured before Mutation and retained for Restore.

**Expanded Text Value**:
The deterministic value produced by Long Text from one node's Original Text Value without language detection, generated copy, translation, or external lexical material.

**Expansion Factor**:
The configured degree to which Long Text increases a node's meaningful text content. The MVP exposes one benchmarked default rather than user-selectable intensities.
_Avoid_: Translation ratio

**Unbreakable Text**:
A Scenario that preserves the original content of each Eligible Text Node and appends one canonical Unbreakable Token after a normal wrapping opportunity. It provides generic unbreakable-token stress without classifying or simulating a specific content type.
_Avoid_: Long Text

**Unbreakable Token**:
A deterministic, continuous ASCII-alphanumeric string with no intentionally introduced wrapping opportunities or content-specific semantics.
_Avoid_: URL fixture, email fixture, generated identifier

**Large Text**:
A Scenario that applies one deterministic Text Scaling Factor to the stable baseline computed font size of each Text Scaling Target, producing normal layout reflow without changing content, replacing nodes, or using inherited multiplication, zoom, or transforms.
_Avoid_: Browser zoom

**Text Scaling Target**:
A rendered element that directly owns at least one Eligible Text Node and has a stable, measurable font size that Large Text can change once and restore reliably.
_Avoid_: Every ancestor containing text

**Text Scaling Factor**:
The single benchmarked multiplier Large Text applies independently to each Text Scaling Target's baseline computed font size.
_Avoid_: Browser zoom level

**Mutation**:
A temporary, reversible change made to the Target Page's DOM, attributes, or styles in order to create a Scenario's stress condition. A Mutation preserves the identity of its target element whenever technically possible.
_Avoid_: Fix, patch

**Mutation Record**:
The Run-owned record of one Mutation's target, original state, applied state, and metadata required to decide whether exact Restore remains safe.
_Avoid_: DOM snapshot

**Applied Mutation**:
A Mutation whose target's owned state was immediately verified to exactly match the state recorded in its Mutation Record.

**Applied-Ineffective Mutation**:
An Applied Mutation that remains exactly known and restorable but did not produce its intended computed or rendered effect. It is locally inconclusive and does not invalidate the Run.
_Avoid_: Failed Mutation, Finding

**Skipped Target**:
An intended target excluded before any write because its identity, source state, eligibility, or property no longer matched the prepared Mutation Record.
_Avoid_: Failed Run

**Safe Mutation Failure**:
A local application failure for which the engine can prove either that no change occurred or that every change is fully recorded, verified, and restorable.
_Avoid_: Unknown Mutation State

**Unknown Mutation State**:
A globally fatal condition in which the engine cannot determine whether or how a write occurred or cannot trust that its Mutation Journal describes every applied change.
_Avoid_: Safe Mutation Failure, skipped target

**Mutation Journal**:
The ordered collection of Mutation Records prepared before their writes and used to verify ownership, report effective coverage, and Restore applied changes in reverse order.
_Avoid_: DOM snapshot

**Aborted Run**:
A Run terminated before mutated measurement because an Unknown Mutation State or another global invalidation made its results unreliable. It produces no Findings and immediately attempts best-effort Restore.
_Avoid_: Completed Run

**Finding**:
A Detector result supported by comparable Baseline Evidence and Mutated Evidence showing that the active Scenario introduced a failure condition or measurably worsened one on the same Logical Element. Its affected element need not have been directly mutated when reflow, displacement, or obstruction propagated the regression.
_Avoid_: Score, warning

**Measured Delta**:
The unit-preserving difference between compatible Baseline Evidence and Mutated Evidence that demonstrates a regression.
_Avoid_: Severity, score

**Magnitude**:
A Detector-specific quantitative description of a Finding, retained in its natural units and usable only to order Findings from the same Detector.
_Avoid_: Severity, cross-detector score

**Possible Cause**:
A technical hypothesis derived from observed Evidence and explicitly presented as uncertain rather than as proven diagnosis or product impact.
_Avoid_: Root cause, severity

**Evidence**:
Observable, measurable data collected by a Detector during a Run and retained to justify a Finding.
_Avoid_: Guess, score

**Stable Measurement**:
Detector-specific Evidence whose relevant values remain within that Detector's tolerance throughout a bounded observation window.
_Avoid_: Page loaded, network idle

**Stability Window**:
A bounded, frame-based observation period in which one Detector determines whether its relevant measurements for one Logical Element are repeatable.
_Avoid_: Global page stability

**Baseline**:
The measured state of the Target Page captured within a Run before its Scenario applies any Mutations.
_Avoid_: Control page, previous run

**Baseline Evidence**:
Evidence collected from the Baseline using the same Detector, configuration, and viewport later used to collect Mutated Evidence.

**Mutated Evidence**:
Evidence collected while the Scenario's Mutations are active and compared with Baseline Evidence from the same Run.
_Avoid_: Final evidence

**Detector**:
A non-interactive rule that captures serializable layout or rendering Evidence, compares compatible Baseline Evidence and Mutated Evidence for the same Logical Element, and produces a Finding only for a new or measurably worsened failure condition.
_Avoid_: Audit, heuristic warning

### MVP Detectors

**Text Clipping**:
A regression in which previously visible rendered text becomes partially hidden or cut off on either axis after a Scenario, without an explicit active truncation mechanism supported by the MVP.
_Avoid_: Intentional truncation

**Text Owner**:
An element that directly or indirectly contains an Affected Text Range. It supports Text Clipping Evidence but is not necessarily the Finding Subject.
_Avoid_: Clipping Boundary

**Affected Text Range**:
A stable portion of rendered text that was visible in the Baseline and is measurably hidden by the same Clipping Boundary after Mutation.
_Avoid_: Full text content

**Clipping Boundary**:
An element proven through before-and-after geometry and effective clipping behavior to hide part of one or more descendant Affected Text Ranges.
_Avoid_: Any element with overflow hidden, container

**Nearest Proven Clipping Boundary**:
The closest ancestor of an Affected Text Range whose responsibility for the observed clipping can be demonstrated. It suppresses duplicate attribution to farther ancestors unless they introduce independently measurable clipping.

**Finding Subject**:
The primary domain entity to which a Finding applies. It is an element for boundary-level Findings and the Target Page for Viewport Overflow, which instead provides a Primary Contributor as its inspectable entry point.
_Avoid_: Mutated element

**Explicit Truncation**:
A computed and behaviorally active CSS mechanism—single-line ellipsis or multiline line clamp in the MVP—that deliberately limits visible text. It demonstrates implementation intent, not whether truncation is correct for the product.
_Avoid_: Overflow clipping alone, Text Clipping Finding

**Horizontal Containment Overflow**:
A new or measurably worsened horizontal excess in which descendant boxes extend beyond the usable bounds of the Nearest Proven Containing Boundary, whether or not content is hidden.
_Avoid_: Text Clipping, Viewport Overflow

**Containing Boundary**:
An element whose usable horizontal bounds form a relevant layout context for one or more descendant boxes.
_Avoid_: Any parent, top-level viewport

**Nearest Proven Containing Boundary**:
The closest ancestor whose stable before-and-after geometry proves that a descendant newly or increasingly exceeds its relevant horizontal bounds.

**Overflowing Element**:
A stable descendant box providing Evidence that it newly or increasingly exceeds a Proven Containing Boundary. It supports the Finding but is not its primary subject.

**Horizontal Excess**:
The measurable distance by which an Overflowing Element extends beyond a Containing Boundary on inline-start, inline-end, or both sides.
_Avoid_: Any visual protrusion

**Intentional Horizontal Scrolling**:
An operational horizontal scroll mechanism explicitly provided by a Containing Boundary. The MVP excludes it from Horizontal Containment Overflow Findings.
_Avoid_: Containment failure

**Viewport Overflow**:
A new or measurably worsened page-level horizontal scroll extent beyond the top-level Layout Viewport, supported by at least one stable Viewport Overflow Contributor.
_Avoid_: Vertical off-screen position, Horizontal Containment Overflow

**Layout Viewport**:
The top-level viewport used by page layout and by Viewport Overflow measurements. The MVP does not interpret the visual viewport, zoom, iframe viewports, or vertical visibility as part of this concept.
_Avoid_: Visual viewport, visible screen area

**Viewport Overflow Contributor**:
A stable element whose before-and-after geometry directly explains a measurable part of the Target Page's new or worsened horizontal scroll extent.
_Avoid_: Any element outside the viewport

**Primary Contributor**:
The Viewport Overflow Contributor selected deterministically by greatest measured contribution, then greatest regression, then stable document order, and used as the Finding's initial inspection target.
_Avoid_: Finding Subject

**Layout and Rendering Regression**:
A new or measurably worsened geometric or rendered failure condition introduced by a Scenario and demonstrated through comparable before-and-after Evidence.
_Avoid_: Accessibility violation, behavioral defect, quality score

**Logical Element**:
The exact same page element instance measured in the Baseline and while Mutations are active, without reconstruction or rematching.
_Avoid_: CSS selector, DOM node

**Locator**:
Diagnostic metadata that helps a developer find or inspect an element. A Locator describes an element but does not prove its identity across measurements.
_Avoid_: Element identity, rematching key

**Inconclusive Result**:
An internal diagnostic outcome indicating that a Detector could not obtain stable, comparable Baseline and mutated measurements, including when the measured element is no longer the same connected element. It is not a Finding and is not shown as a Scenario-caused problem in the MVP.
_Avoid_: Finding, failure

**Run Invalidation**:
The termination of an entire Run after a structural event, such as navigation or document replacement, makes its remaining comparisons or Restore lifecycle unreliable.
_Avoid_: Inconclusive Result

**Restore**:
The conflict-aware, best-effort operation that reverses each Run-owned Mutation whose current target state still exactly matches its applied state, without overwriting external changes. It processes every Mutation in reverse application order even when individual targets cannot be restored.
_Avoid_: Reset

**Restore Conflict**:
A condition in which a Mutation cannot be safely reversed because its target was changed, replaced, disconnected, moved to another document, became unavailable, or rejected the Restore operation.
_Avoid_: Finding

**Reload Required**:
The terminal Run outcome after any Restore Conflict, blocking another Run in the same document until an explicit top-level reload or a new document is created.
_Avoid_: Automatic reload, partial success
