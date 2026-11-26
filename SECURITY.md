# Security policy

RES instructs an AI agent to operate a real browser on accounts you control. Two kinds of problems matter most:

- **A safety rule that fails**: the skill lets the agent change production data, reach a real person, or skip the change ledger in a situation the rules should cover.
- **A data leak in the page scripts**: a script returns values from the page (names, emails, IDs, tokens, storage values) instead of shapes and counts, including values used as object keys or URL path segments.
- **Prompt injection**: text in the product (a record, a comment, an API response) makes the agent act outside the skill's rules.
- **A file leak in the handoff**: `build-report.mjs` or `pack-kb.mjs` puts a file from outside the knowledge base into `REPORT.html` or the zip.
- **A mask that fails**: `mask.js` leaves personal data readable in a screenshot it reports as masked.

## Reporting

Report either kind privately through GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). Include the agent and model you used, the product, the environment level, and the exact steps. Do not include real customer data or credentials in the report.

Other problems go to the public issue tracker.

## Supported versions

Only the latest release receives fixes.
