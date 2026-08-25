## Why

The phaze3 filesystem tools currently run silently — when the agent calls `ls`, `cat`, `grep`, etc., there is no record of what was invoked, with which arguments, or how it turned out. Adding structured, annotated logging around every tool invocation gives us observability into the agent's behavior (what it inspected, how long it took, whether it failed or hit the sandbox guard) without changing what the tools do.

## What Changes

- Log every filesystem tool invocation via Effect's logging, both at start and on completion.
- Attach structured context to those logs using **Effect log annotations** (`Effect.annotateLogs`), so each line carries fields like `tool`, `args`, `outcome`, `durationMs`, and `resultBytes`.
- Cover both outcomes: successful calls log at info level; failures / out-of-sandbox rejections log at a higher level with the reason.
- Keep it Effect-idiomatic (no `console`) and never log secrets; arguments are filesystem paths/patterns only.
- Annotations are scoped to each invocation so concurrent tool calls don't bleed context into each other.

## Capabilities

### New Capabilities
- `phaze4`: Structured, annotated logging around agent tool invocations — each call emits Effect log lines annotated with the tool name, arguments, outcome, and timing, without altering tool results.

### Modified Capabilities
<!-- None: this adds observability around the existing phaze3 tools without changing their behavior or requirements. -->

## Impact

- Wraps the phaze3 tool Effects (in the `FsTools` service) with logging + `Effect.annotateLogs`; no change to tool inputs/outputs.
- No new runtime dependencies.
- No configuration changes required (optionally a log level could be tuned later).
- Slightly more log output at runtime; annotations make it structured and filterable.
