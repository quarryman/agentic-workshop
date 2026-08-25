## Context

phaze2 gave the bot a LangChain agent loop (`createReactAgent`) built with `tools: []`, so it never actually branches into tool calls. This change adds a read-only filesystem toolset (capability `phaze3`) and hands it to that agent, turning it into a genuine tool-using loop. The tools let the model inspect files under one configurable directory to answer grounded questions, without any ability to modify the system.

The bot already uses Effect services + a Groq-backed `ChatModel`. The filesystem tools are introduced the same way: an Effect service that builds LangChain `tool()` objects bound to a resolved sandbox root, which `ChatModel` consumes when constructing the agent.

## Goals / Non-Goals

**Goals:**
- Provide read-only tools — `ls`, `cat`, `grep`, `find`/glob, `head`/`tail`, `tree` — the agent can call.
- Confine every operation to a single configurable root directory (`SANDBOX_ROOT`); reject any path that escapes it.
- Keep results bounded (max bytes/lines/entries) so tool output can't blow up a reply or context.
- Wire the toolset into the phaze2 agent so it performs real multi-turn tool calling.

**Non-Goals:**
- No write, move, delete, chmod, or arbitrary command execution.
- No network access, no following symlinks outside the sandbox.
- No per-user sandboxes or auth — a single process-wide root for now.
- No streaming of tool output.

## Decisions

- **Native TS implementations, not a shell.** Each tool is implemented with Bun/Node `fs` primitives (`readdir`, `readFile`, `stat`) plus in-process matching, rather than spawning `bash`/binaries. Rationale: eliminates shell-injection risk entirely, is deterministic, and avoids depending on binaries that may be absent (e.g. `tree` is not installed by default on macOS). The tools still present the same read-only semantics the user asked for ("bash-style" ls/grep/cat/...). Alternative — spawning real binaries via a no-shell `spawn` with argument arrays — rejected for portability and the extra hardening burden.
- **Tool surface (7 tools):**
  - `ls(path?)` — list entries of a directory (name, type, size).
  - `cat(path)` — return a file's text content (bounded).
  - `grep(pattern, path?, glob?)` — regex search across files under a path; returns `file:line: match` rows.
  - `find(glob, path?)` — list files matching a name/glob pattern.
  - `head(path, lines?)` / `tail(path, lines?)` — first/last N lines of a file.
  - `tree(path?, depth?)` — depth-limited directory tree, rendered natively.
- **Path confinement.** A shared `resolveInSandbox(userPath)` resolves the argument against the absolute sandbox root, then `realpath`-checks the result (and its nearest existing parent) so it must equal the root or live beneath `root + sep`. Absolute paths outside the root, `..` traversal, and symlinks escaping the root are rejected with a clear tool error string (the agent sees the error and can adjust).
- **Configuration.** `SANDBOX_ROOT` read via `Config.string("SANDBOX_ROOT").pipe(Config.withDefault("."))`, resolved to an absolute path once at service construction. Documented in `.env.example`.
- **Bounded output.** Constants cap per-tool output: max file bytes for `cat` (e.g. 64 KB), max match/entry rows for `grep`/`find`/`ls` (e.g. 200), max `tree` nodes and depth. Truncation is signalled in the returned text so the model knows results were cut.
- **LangChain integration.** Tools are defined with `tool()` from `@langchain/core/tools` using `zod` schemas for arguments; each returns a string. An Effect service (`FsTools`) exposes the built `tools` array. `ChatModel` depends on `FsTools` and passes `tools` to `createReactAgent`. Zod is already available transitively via LangChain; if not, it is added explicitly.
- **Model.** Tool calling requires a function-calling-capable Groq model; the current default (`openai/gpt-oss-20b`) supports tools, so no model change is forced.

## Risks / Trade-offs

- **Symlink escape** → Mitigated by `realpath`-checking resolved paths against the root before any read.
- **Large files / directories** → Mitigated by byte/line/entry caps and truncation markers; `grep`/`find` also cap files scanned.
- **Reimplementing grep/tree semantics** → Slight behavior differences vs GNU tools, but sufficient for inspection; kept intentionally simple.
- **Agent over-calling tools / latency** → The react loop may take several turns; acceptable for now, and the recursion is naturally bounded by the model plus a sane max-iteration default from `createReactAgent`.
- **Sensitive files under the root** → Whatever is in `SANDBOX_ROOT` is readable; operators choose the root deliberately, and the default is the project directory.

## Migration Plan

Additive. Deploy by optionally setting `SANDBOX_ROOT` (defaults to the current directory) and installing `zod` if not already present. Rollback: build the agent with `tools: []` again; no persistent state is involved.

## Open Questions

- Default root (`.`) vs a dedicated `./sandbox` folder — defaulting to `.` for convenience; can be tightened via env without code changes.
