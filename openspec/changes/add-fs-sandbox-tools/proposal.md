## Why

The agent currently runs a built-in loop with no tools, so it can only answer from its own knowledge. Giving it a **read-only, sandboxed filesystem tool** lets it inspect a specific project/folder and answer grounded questions about real files — while a configurable root path and strictly non-mutating operations keep it safe. This also turns the phaze2 agent loop into a genuine multi-turn tool-using agent.

## What Changes

- Introduce a sandboxed filesystem toolset the agent can call, confined to a single configurable root directory (a "sandbox").
- Expose read-only operations only: `ls`, `cat`, `grep`, `find`/glob, `head`/`tail`, and `tree`. No write/move/delete/exec of arbitrary commands.
- Enforce path confinement: every path argument is resolved relative to the sandbox root and rejected if it escapes the root (e.g. via `..` or absolute paths outside it).
- Add an Effect `Config` value `SANDBOX_ROOT` (with a safe default) that defines the sandbox boundary.
- Wire these tools into the phaze2 agent: `createReactAgent` is built with the toolset instead of an empty list, enabling real tool-calling turns.
- Cap output size and apply a per-call timeout so tool results stay bounded.

## Capabilities

### New Capabilities
- `phaze3`: A sandboxed, read-only filesystem toolset (ls, cat, grep, find/glob, head/tail, tree) that the agent invokes to inspect files under a single configurable root directory, with strict path confinement and bounded output.

### Modified Capabilities
- `phaze2`: The agent loop is provided the phaze3 filesystem tools instead of an empty tool list, so replies may involve one or more tool-calling turns grounded in real file contents.

## Impact

- New Effect service/module exposing the filesystem tools to the LangChain agent (`tool()` definitions with schemas).
- Modifies the `ChatModel` agent construction to pass the toolset to `createReactAgent`.
- New configuration: `SANDBOX_ROOT` environment variable (with default); documented in `.env.example`.
- Requires a Groq model that supports tool/function calling (the current default already does).
- No changes to Telegram transport, persistence, or the write path — everything added is read-only.
