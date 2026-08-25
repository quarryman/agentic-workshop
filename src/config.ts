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
  "You are a helpful assistant replying in a Telegram chat. Keep answers concise and friendly."
