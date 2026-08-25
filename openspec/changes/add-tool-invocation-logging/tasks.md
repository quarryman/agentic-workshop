# phaze4 — Tool Invocation Logging (Effect annotations)

## 1. Invocation Wrapper

- [ ] 1.1 Replace the `runText(effect)` wrapper in `FsTools` with `runTool(name, args, effect)` used by all seven tools
- [ ] 1.2 Serialize `args` to JSON and truncate to a small cap for safe, bounded annotation values
- [ ] 1.3 Update each tool definition to pass its tool name and parsed args into `runTool`

## 2. Logging & Annotations

- [ ] 2.1 Emit a start log line (`Effect.logInfo`) when a tool is invoked
- [ ] 2.2 Measure invocation duration with Effect timing (`Effect.timed`/`Clock`)
- [ ] 2.3 Emit a completion log line: info on success, warning on `rejected`/`error`, including a `reason`
- [ ] 2.4 Classify outcome as `success` | `rejected` (string failure) | `error` (PlatformError/defect)
- [ ] 2.5 Wrap the invocation with `Effect.annotateLogs({ tool, args })` so all its logs carry that context
- [ ] 2.6 Add completion annotations `outcome`, `durationMs`, `resultBytes`
- [ ] 2.7 Preserve existing behavior: failures are still caught and returned as the tool's text result

## 3. Verification

- [ ] 3.1 Invoke a successful tool and confirm start + completion logs with `outcome=success`, `durationMs`, `resultBytes`, `tool`, `args`
- [ ] 3.2 Invoke an out-of-sandbox path and confirm a warning log with `outcome=rejected` and the reason
- [ ] 3.3 Confirm no `console` usage and that annotations contain only paths/patterns (no secrets)
- [ ] 3.4 Confirm the program still type-checks (`bun run typecheck`)
