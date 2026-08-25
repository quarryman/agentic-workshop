import { Config } from "effect"

/**
 * Telegram bot token read from the environment via Effect Config.
 * A missing value surfaces as a typed ConfigError at startup.
 */
export const botToken = Config.string("TELEGRAM_BOT_TOKEN")

/**
 * Groq API key read as a redacted value so it is never accidentally logged.
 * A missing value surfaces as a typed ConfigError at startup.
 */
export const groqApiKey = Config.redacted("GROQ_API_KEY")

/**
 * The Groq-hosted model backing the agent loop, read from `GROQ_MODEL` with a
 * sensible free-tier default. Override it in the environment to swap models.
 */
export const groqModel = Config.string("GROQ_MODEL").pipe(
  Config.withDefault("openai/gpt-oss-20b")
)

/**
 * Concise system prompt steering replies for a Telegram chat context.
 */
export const SYSTEM_PROMPT =
  "You are a helpful assistant replying in a Telegram chat. Keep answers concise and friendly. " +
  "You have read-only filesystem tools (ls, cat, grep, find, head, tail, tree) scoped to a sandbox " +
  "directory; use them to answer questions grounded in real files when relevant."

/**
 * Sandbox root for the read-only filesystem tools, read from `SANDBOX_ROOT`
 * with a default of the current directory. Resolved to an absolute path at
 * service construction; all tools operate relative to it.
 */
export const sandboxRoot = Config.string("SANDBOX_ROOT").pipe(
  Config.withDefault(".")
)

/** Output limits keeping tool results bounded. */
export const MAX_CAT_BYTES = 64 * 1024
export const MAX_ROWS = 200
export const MAX_TREE_DEPTH = 3
export const MAX_TREE_NODES = 500
export const MAX_WALK_FILES = 2000
export const DEFAULT_HEAD_TAIL_LINES = 20
