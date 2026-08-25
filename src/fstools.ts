import { FileSystem, Path } from "@effect/platform"
import { tool } from "@langchain/core/tools"
import { Effect, Runtime } from "effect"
import { z } from "zod"
import {
  DEFAULT_HEAD_TAIL_LINES,
  MAX_CAT_BYTES,
  MAX_ROWS,
  MAX_TREE_DEPTH,
  MAX_TREE_NODES,
  MAX_WALK_FILES,
  sandboxRoot,
} from "./config.ts"

/** Directories skipped during recursive walks to avoid huge/noisy scans. */
const SKIP_DIRS = new Set(["node_modules", ".git"])

/** Convert a simple glob (supporting * and ?) into an anchored RegExp. */
const globToRegExp = (glob: string): RegExp =>
  new RegExp(
    "^" +
      glob
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$"
  )

/**
 * Read-only, sandboxed filesystem tools exposed to the agent.
 *
 * All I/O goes through Effect's `FileSystem` service (Bun implementation).
 * Every path argument is confined to `SANDBOX_ROOT` via `resolveInSandbox`,
 * which uses `FileSystem.realPath` to reject `..`/absolute/symlink escapes.
 * Tool logic is written as Effects and run on the captured runtime at the
 * LangChain boundary; failures are returned as plain text so the agent adapts.
 */
export class FsTools extends Effect.Service<FsTools>()("FsTools", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const rootConfig = yield* sandboxRoot

    // Resolve the sandbox root to an absolute, symlink-free path once.
    const root = yield* fs
      .realPath(path.resolve(rootConfig))
      .pipe(Effect.orElseSucceed(() => path.resolve(rootConfig)))

    const runtime = yield* Effect.runtime<never>()

    /** Resolve a user path within the sandbox, or fail with an error string. */
    const resolveInSandbox = (
      userPath: string
    ): Effect.Effect<string, string> =>
      Effect.gen(function* () {
        const candidate = path.isAbsolute(userPath)
          ? userPath
          : path.join(root, userPath)
        const resolved = path.resolve(candidate)
        // realPath collapses symlinks; if the path does not exist yet, fall back
        // to the lexically resolved path (the read itself will then report ENOENT).
        const real = yield* fs
          .realPath(resolved)
          .pipe(Effect.orElseSucceed(() => resolved))
        const rel = path.relative(root, real)
        const inside =
          real === root || (rel !== ".." && !rel.startsWith(".." + path.sep))
        if (!inside) {
          return yield* Effect.fail(`Path is outside the sandbox: ${userPath}`)
        }
        return real
      })

    const rel = (p: string) => path.relative(root, p) || "."

    /** Recursively collect files under a directory, capped and skipping heavy dirs. */
    const walkFiles = (
      base: string,
      match?: (name: string) => boolean
    ): Effect.Effect<ReadonlyArray<string>, string> =>
      Effect.gen(function* () {
        const out: string[] = []
        const stack = [base]
        while (stack.length > 0 && out.length < MAX_WALK_FILES) {
          const dir = stack.pop()!
          const names = yield* fs
            .readDirectory(dir)
            .pipe(Effect.orElseSucceed(() => [] as ReadonlyArray<string>))
          for (const name of names) {
            if (SKIP_DIRS.has(name)) continue
            const full = path.join(dir, name)
            const info = yield* fs
              .stat(full)
              .pipe(Effect.orElseSucceed(() => null))
            if (!info) continue
            if (info.type === "Directory") stack.push(full)
            else if (info.type === "File") {
              if (!match || match(name)) {
                out.push(full)
                if (out.length >= MAX_WALK_FILES) break
              }
            }
          }
        }
        return out
      })

    // --- Tool implementations (Effects returning text) ---

    const lsImpl = (p?: string) =>
      Effect.gen(function* () {
        const dir = yield* resolveInSandbox(p ?? ".")
        const names = yield* fs.readDirectory(dir)
        const shown = names.slice(0, MAX_ROWS)
        const rows: string[] = []
        for (const name of shown) {
          const info = yield* fs
            .stat(path.join(dir, name))
            .pipe(Effect.orElseSucceed(() => null))
          const type = info?.type === "Directory" ? "dir " : "file"
          const size = info && info.type === "File" ? Number(info.size) : 0
          rows.push(`${type}\t${size}\t${name}`)
        }
        let out = rows.join("\n") || "(empty directory)"
        if (names.length > MAX_ROWS) {
          out += `\n... (${names.length - MAX_ROWS} more entries truncated)`
        }
        return out
      })

    const catImpl = (p: string) =>
      Effect.gen(function* () {
        const file = yield* resolveInSandbox(p)
        const content = yield* fs.readFileString(file)
        if (content.length > MAX_CAT_BYTES) {
          return (
            content.slice(0, MAX_CAT_BYTES) +
            `\n... (truncated at ${MAX_CAT_BYTES} bytes)`
          )
        }
        return content || "(empty file)"
      })

    const headTailImpl = (p: string, n: number, mode: "head" | "tail") =>
      Effect.gen(function* () {
        const file = yield* resolveInSandbox(p)
        const content = yield* fs.readFileString(file)
        const lines = content.split("\n")
        const picked =
          mode === "head" ? lines.slice(0, n) : lines.slice(-n)
        return picked.join("\n") || "(no lines)"
      })

    const grepImpl = (pattern: string, p?: string, glob?: string) =>
      Effect.gen(function* () {
        const base = yield* resolveInSandbox(p ?? ".")
        const re = yield* Effect.try({
          try: () => new RegExp(pattern),
          catch: () => `Invalid regex: ${pattern}`,
        })
        const nameMatch = glob
          ? (name: string) => globToRegExp(glob).test(name)
          : undefined
        const files = yield* walkFiles(base, nameMatch)
        const rows: string[] = []
        for (const f of files) {
          if (rows.length >= MAX_ROWS) break
          const content = yield* fs
            .readFileString(f)
            .pipe(Effect.orElseSucceed(() => ""))
          const lines = content.split("\n")
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i]!)) {
              rows.push(`${rel(f)}:${i + 1}: ${lines[i]!.trim()}`)
              if (rows.length >= MAX_ROWS) break
            }
          }
        }
        if (rows.length === 0) return "(no matches)"
        let out = rows.join("\n")
        if (rows.length >= MAX_ROWS) out += `\n... (results truncated at ${MAX_ROWS} rows)`
        return out
      })

    const findImpl = (glob: string, p?: string) =>
      Effect.gen(function* () {
        const base = yield* resolveInSandbox(p ?? ".")
        const re = globToRegExp(glob)
        const files = yield* walkFiles(base, (name) => re.test(name))
        const shown = files.slice(0, MAX_ROWS).map(rel)
        if (shown.length === 0) return "(no files match)"
        let out = shown.join("\n")
        if (files.length > MAX_ROWS) {
          out += `\n... (${files.length - MAX_ROWS} more truncated)`
        }
        return out
      })

    const treeImpl = (p?: string, depth?: number) =>
      Effect.gen(function* () {
        const base = yield* resolveInSandbox(p ?? ".")
        const maxDepth = Math.min(depth ?? MAX_TREE_DEPTH, MAX_TREE_DEPTH)
        const lines: string[] = [rel(base) + "/"]
        let nodes = 0
        let truncated = false

        const walk = (
          dir: string,
          prefix: string,
          d: number
        ): Effect.Effect<void, string> =>
          Effect.gen(function* () {
            if (d > maxDepth || nodes >= MAX_TREE_NODES) return
            const names = (yield* fs
              .readDirectory(dir)
              .pipe(Effect.orElseSucceed(() => [] as ReadonlyArray<string>)))
              .filter((n) => !SKIP_DIRS.has(n))
              .slice()
              .sort()
            for (let i = 0; i < names.length; i++) {
              if (nodes >= MAX_TREE_NODES) {
                truncated = true
                return
              }
              const name = names[i]!
              const full = path.join(dir, name)
              const info = yield* fs
                .stat(full)
                .pipe(Effect.orElseSucceed(() => null))
              const isDir = info?.type === "Directory"
              const last = i === names.length - 1
              lines.push(`${prefix}${last ? "└── " : "├── "}${name}${isDir ? "/" : ""}`)
              nodes++
              if (isDir) {
                yield* walk(full, prefix + (last ? "    " : "│   "), d + 1)
              }
            }
          })

        yield* walk(base, "", 1)
        if (truncated) lines.push(`... (tree truncated at ${MAX_TREE_NODES} nodes)`)
        return lines.join("\n")
      })

    // --- LangChain tool wrappers: run each Effect on the captured runtime,
    //     converting failures (string or defect) into a plain text result. ---

    const runText = <E>(eff: Effect.Effect<string, E>): Promise<string> =>
      Runtime.runPromise(runtime)(
        eff.pipe(
          Effect.catchAll((e) => Effect.succeed(String(e))),
          Effect.catchAllDefect((d) => Effect.succeed(`Error: ${String(d)}`))
        )
      )

    const tools = [
      tool(async ({ path: p }) => runText(lsImpl(p)), {
        name: "ls",
        description:
          "List directory entries (type, size, name) within the sandbox. Path is optional and defaults to the sandbox root.",
        schema: z.object({ path: z.string().optional() }),
      }),
      tool(async ({ path: p }) => runText(catImpl(p)), {
        name: "cat",
        description: "Read the full text content of a file within the sandbox.",
        schema: z.object({ path: z.string() }),
      }),
      tool(async ({ path: p, lines }) => runText(headTailImpl(p, lines ?? DEFAULT_HEAD_TAIL_LINES, "head")), {
        name: "head",
        description: "Read the first N lines (default 20) of a file within the sandbox.",
        schema: z.object({ path: z.string(), lines: z.number().int().positive().optional() }),
      }),
      tool(async ({ path: p, lines }) => runText(headTailImpl(p, lines ?? DEFAULT_HEAD_TAIL_LINES, "tail")), {
        name: "tail",
        description: "Read the last N lines (default 20) of a file within the sandbox.",
        schema: z.object({ path: z.string(), lines: z.number().int().positive().optional() }),
      }),
      tool(async ({ pattern, path: p, glob }) => runText(grepImpl(pattern, p, glob)), {
        name: "grep",
        description:
          "Regex-search file contents under a path in the sandbox. Returns 'relpath:line: match' rows. Optional glob filters which file names are searched.",
        schema: z.object({
          pattern: z.string(),
          path: z.string().optional(),
          glob: z.string().optional(),
        }),
      }),
      tool(async ({ glob, path: p }) => runText(findImpl(glob, p)), {
        name: "find",
        description:
          "Find files whose name matches a glob (e.g. '*.ts') under a path in the sandbox.",
        schema: z.object({ glob: z.string(), path: z.string().optional() }),
      }),
      tool(async ({ path: p, depth }) => runText(treeImpl(p, depth)), {
        name: "tree",
        description:
          "Show a depth-limited directory tree within the sandbox. Path and depth are optional.",
        schema: z.object({
          path: z.string().optional(),
          depth: z.number().int().positive().optional(),
        }),
      }),
    ]

    return { tools } as const
  }),
}) {}
