## Context

phaze3 exposes read-only filesystem tools (`ls`, `cat`, `grep`, `find`, `head`, `tail`, `tree`) to the agent through the `FsTools` Effect service. Every tool already funnels through a single wrapper (`runText`) that runs the tool's `Effect` on the captured runtime and converts failures into a text result. That wrapper is the natural choke point to add observability. This change wraps invocations with Effect logging and **log annotations** so each call is recorded with structured context, without changing tool inputs or outputs.

## Goals / Non-Goals

**Goals:**
- Emit a log line when a tool is invoked and when it completes.
- Attach structured fields via `Effect.annotateLogs` — `tool`, `args`, `outcome`, `durationMs`, `resultBytes` — so logs are filterable.
- Distinguish outcomes: `success`, `rejected` (out-of-sandbox / bad input), and `error` (I/O failure).
- Stay Effect-idiomatic (no `console`) and never log secrets.

**Non-Goals:**
- No change to tool behavior, arguments, or results.
- No metrics/tracing backend, no persistence of logs.
- No per-tool custom log schemas beyond the shared annotation set.

## Decisions

- **Single wrapping point.** Add a `runTool(name, args, effect)` helper in `FsTools` that replaces the current `runText`; all seven tools call it. This guarantees uniform logging with zero duplication and keeps each tool definition unchanged apart from passing its name/args.
- **Annotations via `Effect.annotateLogs`.** The whole invocation `Effect` is wrapped with `Effect.annotateLogs({ tool, args })`, so *every* log line produced during that call (start, completion, and any internal logs) carries those fields. Because `annotateLogs` applies to a specific effect, annotations are naturally **scoped per invocation** and safe under concurrent tool calls. The completion log adds event-specific annotations (`outcome`, `durationMs`, `resultBytes`).
- **Two events per call.** A start log (`Effect.logInfo("tool.invoke")` / debug) and a completion log. Success completes at info level; `rejected` and `error` complete at warning level with a `reason`. Timing is measured with Effect (`Effect.timed` / `Clock`) and reported as `durationMs`.
- **Outcome classification.** Tool Effects fail either with a plain **string** (sandbox rejection / invalid input from `resolveInSandbox`) → `outcome=rejected`, or with a `PlatformError`/defect (I/O failure) → `outcome=error`. Success → `outcome=success` with `resultBytes` = length of the returned text. The existing behavior of returning the failure as the tool's text result is preserved (the agent still sees it).
- **Safe, bounded annotation values.** `args` are serialized (JSON) and truncated to a small cap; they only ever contain filesystem paths/patterns, never tokens or keys, so there is no secret-leak risk. Non-string annotation values (numbers) are passed as-is.

## Risks / Trade-offs

- **Log verbosity** → One start + one completion line per tool call. Mitigated by using info/debug for the start event and keeping annotations compact; log level can be tuned later.
- **Large arguments** → Truncate serialized `args` to a fixed length before annotating.
- **Duration on failure** → Timing is captured around the tool effect so both success and failure report `durationMs`.

## Migration Plan

Additive and behavior-preserving. Deploy by shipping the updated `FsTools` wrapper; no config or dependency changes. Rollback: revert `runTool` back to the plain `runText` wrapper.

## Open Questions

- Start-event level (`info` vs `debug`) — defaulting to `info` for visibility during the workshop; can be lowered to `debug` if noisy.
