# AI Coworker Configuration

Learn from past mistakes/attempts: in the comments keep knowledge of what was tried and why it failed

This file is the tool-agnostic agent config:

- Refer to yourself as "AI Coworker" in docs and comments, not by product or company name
- Do not install or use `gh` CLI
- **Routine Pre-PR Validation**: `pnpm check:full`
- **Open a PR**: Push the branch, then construct and present a GitHub compare URL
  (`quick_pull=1`) to the user. Base branch is `master`. Prefill "title" (concise, under 70 chars) and "body" (markdown with ## Why and ## Changes sections)
- **Fetch PR review comments**: Use the GitHub REST API via curl. Fetch all three comment types (issue comments, reviews, and inline comments). Reviewers reply asynchronously — poll every minute until comments arrive
- **Copy to clipboard**:
  ```
  head -c -1 <<'EOF' | wl-copy
  content goes here
  EOF
  ```
