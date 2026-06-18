@.ai/guidelines.md

## Waiting for Background Builds

Run `uds deploy`, `uds zarf package create`, and `uds create` with `run_in_background: true`. Then use the Monitor tool with `until grep -qE 'package saved|ERROR|failed' <output_file>; do sleep 10; done` to wait for completion. Do not end your turn — 'you will be notified' does not resume the session and ending the turn kills the build.
