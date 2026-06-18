# UDS Package: deployment-readiness-platform

## Getting Started

This project uses the `uds-mcp-server` MCP server. Call its tools to get started — it provides guided workflows, documentation, and code generation for UDS package development.

## Workflow Rules

- Always use `uds zarf` instead of bare `zarf` — the Zarf CLI is bundled with UDS
- Always pass `--no-color` to `uds` and `uds zarf` commands — prevents ANSI escape codes in output
- Suggest generating application tests for any new or modified functionality
- Document every fix with reasoning — explain *why*, not just *what*
- Prefer simple changes when they deliver the same value
- Document assumptions explicitly; discuss them with the user before proceeding
- Follow Helm best practices (named templates, proper labels, resource limits)
- Include log exposure (stdout/stderr) for any test Job or validation workload
- Run `uds deploy`, `uds zarf package create`, and `uds create` as background processes — these take 5–20+ minutes. Do not give up or end your session while they run. Your tool-specific file (CLAUDE.md / AGENTS.md) describes how to wait.
- If the same command fails 3 times, stop and re-examine your approach instead of retrying
- After modifying chart versions, image tags, values files, or dependencies, use the `helm-template` MCP tool to verify rendered manifests are correct, and `validate-package` to check package structure
- Use the `query-docs` MCP tool for UDS Core and Zarf questions rather than guessing
- Use `helm-metadata` to check chart defaults before overriding values

## CI and GitHub

- When a CI job fails, fetch the workflow run logs (using `gh` CLI) to diagnose before guessing
- Review PR comments and check status before pushing new changes
- Use GitHub issues for context on what needs to be done

## Testing

- Generate tests for new functionality
- Include log collection in test Jobs (ensure containers write to stdout/stderr)
- Validate packages with `uds zarf dev lint` before committing

## Documentation

- Document configuration in `docs/configuration.md`
- Document policy exemptions with justification in `docs/justifications.md`
- Link to upstream docs rather than duplicating them
