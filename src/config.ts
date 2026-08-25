import { Config } from "effect"

/**
 * Telegram bot token read from the environment via Effect Config.
 * A missing value surfaces as a typed ConfigError at startup.
 */
export const botToken = Config.string("TELEGRAM_BOT_TOKEN")

/**
 * The static text the bot replies with for any incoming text message.
 */
export const STATIC_REPLY = "hello"
