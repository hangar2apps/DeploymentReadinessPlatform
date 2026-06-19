@.ai/guidelines.md

## Waiting for Background Builds

Run `uds deploy`, `uds zarf package create`, and `uds create` with `run_in_background: true`. Then use the Monitor tool with `until grep -qE 'package saved|ERROR|failed' <output_file>; do sleep 10; done` to wait for completion. Do not end your turn — 'you will be notified' does not resume the session and ending the turn kills the build.

## Comment formatting

Do not break comments across lines to meet a character limit. Break only at idea boundaries — sentence, paragraph, or code-block transitions.

## Bash Style

- prioritize readability and simple syntax
- add comments explaining any complex syntax and its intent

## Documentation style

Do not produce ASCII / box-drawing diagrams (e.g. fenced code blocks containing `┌──┐`, `│`, `└──┘`, arrow art, side-by-side flow diagrams) in Markdown documentation. Express the same information as numbered steps, prose, or fenced code blocks containing real shell commands, config snippets, or file paths. ASCII diagrams render unevenly across fonts and viewers, are tedious to maintain when the underlying flow changes, and the same content reads more clearly as a numbered list of "on side X, run/configure Y" steps.

If a true diagram is genuinely necessary, use a Mermaid fenced block (```mermaid) so it renders natively on GitHub instead.

Do no break Markdown text across lines to meet a character limit.  Break at idea boundaries - paragraph, code block, list item, etc.
