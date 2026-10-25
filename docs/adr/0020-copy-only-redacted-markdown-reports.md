# Copy only redacted Markdown Reports

Status: superseded by [ADR-0031](0031-download-redacted-markdown-reports.md). The paragraph below records the earlier copy-only decision.

The MVP's only export is an explicit Copy Report action that formats the serialized, redacted Current Run Result as deterministic Markdown suitable for issues, reviews, and plain-text tools. The visible preview and clipboard payload are the same string, the formatter is pure and DOM-independent, and previous-document, zero-Finding, aborted, and Restore-conflict results remain representable. Copy is attempted only from a user gesture without `clipboardWrite`; failure exposes selectable Markdown instead of requesting permission. JSON, files, screenshots, rich HTML, links, integrations, hidden content, new page reads, telemetry, and remote transfer are excluded.
