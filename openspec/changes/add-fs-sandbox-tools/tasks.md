# phaze3 — Sandboxed Read-Only Filesystem Tools

## 1. Configuration

- [x] 1.1 Add `sandboxRoot` config via `Config.string("SANDBOX_ROOT").pipe(Config.withDefault("."))`
- [x] 1.2 Add `SANDBOX_ROOT` (with note about the default) to `.env.example`
- [x] 1.3 Add output-limit constants (max cat bytes, max rows for grep/find/ls, max tree depth/nodes)
- [x] 1.4 Add dependencies: `@effect/platform` and `@effect/platform-node` (Node platform layer under Bun; `@effect/platform-bun` is avoided as it pulls the Effect cluster stack and fails to import); ensure `zod` is available for tool schemas

## 2. Sandbox Path Confinement

- [x] 2.1 Resolve the configured root to an absolute path once at construction
- [x] 2.2 Implement `resolveInSandbox(userPath)` that resolves against the root and rejects `..`/absolute escapes
- [x] 2.3 Use `FileSystem.realPath` so resolved targets (incl. symlinks) outside the root are rejected
- [x] 2.4 Return a clear error string for out-of-sandbox paths (no throw into the model)

## 3. Read-Only Tools

- [x] 3.1 Implement `ls(path?)` — directory entries with type and size via `FileSystem.readDirectory`/`stat`
- [x] 3.2 Implement `cat(path)` — bounded file text via `FileSystem.readFileString` with byte cap + truncation notice
- [x] 3.3 Implement `head(path, lines?)` and `tail(path, lines?)` — first/last N lines
- [x] 3.4 Implement `grep(pattern, path?, glob?)` — regex search returning `file:line: match`, row-capped
- [x] 3.5 Implement `find(glob, path?)` — list files matching a name/glob pattern, row-capped
- [x] 3.6 Implement `tree(path?, depth?)` — depth-limited directory tree via `FileSystem.readDirectory`, node-capped
- [x] 3.7 Define each tool with `tool()` from `@langchain/core/tools` and a `zod` schema; the callback runs the tool's Effect on the captured runtime via `Runtime.runPromise` and returns text

## 4. Service & Agent Wiring

- [x] 4.1 Define an `FsTools` Effect service (requiring `FileSystem`) that captures the runtime and builds the tool array bound to the resolved sandbox root
- [x] 4.2 Add `FsTools` as a dependency of `ChatModel` and pass its `tools` to `createReactAgent` (replacing `tools: []`)
- [x] 4.3 Provide `FsTools.Default` and the platform layer (`Layer.merge(NodeFileSystem.layer, NodePath.layer)`) in the application layer alongside the existing services
- [x] 4.4 Confirm the program type-checks (`bun run typecheck`) and no `console` usage was introduced

## 5. Verification

- [ ] 5.1 With `SANDBOX_ROOT` set to the project, ask the bot to list/read a file and confirm a grounded reply
- [ ] 5.2 Ask a `grep`/`find`/`tree` question and confirm the agent uses the tool and returns real results
- [x] 5.3 Ask for a path outside the sandbox (e.g. `/etc/passwd`) and confirm the tool refuses with an out-of-sandbox error
- [x] 5.4 Confirm a large file/directory result is truncated with a truncation notice
- [x] 5.5 Confirm read-only: no tool can create/modify/delete files
