# Issue tracker: GitHub

Issues and specs for this repo live in GitHub Issues:

- Repository: `marlenesco/ui-torture-lab`
- Remote: `git@github.com:marlenesco/ui-torture-lab.git`

Use the `gh` CLI for all operations. Inside a configured clone, infer the repository from `git remote -v`. If the remote is not yet configured, pass `--repo marlenesco/ui-torture-lab` explicitly.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`.
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- **Close an issue**: `gh issue close <number> --comment "..."`.

## Issue quality for UI Torture Lab

- Use the canonical vocabulary from `CONTEXT.md` and link relevant ADRs when a proposal touches an established decision.
- Scenario or Detector proposals must define eligibility, exclusions, Baseline Evidence, Mutated Evidence, comparison and attribution rules, inconclusive conditions, Restore implications, and positive and negative fixtures.
- Do not present severity, quality scores, unsupported accessibility claims, or unchanged pre-existing defects as Findings.
- Reproduction material must be synthetic, minimal, and free of confidential pages, credentials, unredacted reports, proprietary source, or personal data.
- Security or privacy vulnerabilities must use the private reporting channel documented by the project rather than a public issue.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo later treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>`.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, retaining only `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`.
- **Comment, label, or close**: use `gh pr comment`, `gh pr edit`, and `gh pr close`.

GitHub shares one number space across issues and pull requests. Resolve an ambiguous `#42` with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

The map is a single issue with child issues as tickets.

- **Map**: one issue labelled `wayfinder:map`, containing Notes, Decisions-so-far, and Fog.
- **Child ticket**: a GitHub sub-issue linked to the map. If sub-issues are unavailable, add it to a task list in the map and include `Part of #<map>` in the child body.
- **Ticket labels**: `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- **Blocking**: use GitHub native issue dependencies. If unavailable, include `Blocked by: #<n>` in the child body.
- **Frontier query**: select the first open, unassigned child without open blockers, preserving map order.
- **Claim**: `gh issue edit <n> --add-assignee @me`.
- **Resolve**: comment with the answer, close the child issue, and add its context pointer to the map.
