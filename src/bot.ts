import { Effect, Runtime } from "effect"
import { Telegraf } from "telegraf"
import { message } from "telegraf/filters"
import { ChatModel } from "./chat.ts"
import { botToken } from "./config.ts"

/** Reply sent when the model call fails, so long-polling never stops. */
const FALLBACK_REPLY = "Sorry, I couldn't process that right now. Please try again."

/**
 * The Telegram bot as a scoped Effect service.
 *
 * Building the service resolves the ChatModel dependency, constructs the
 * Telegraf client from the configured token, registers a text-message handler
 * that answers via the agent loop, starts long-polling in the background, and
 * installs a scope finalizer that stops the bot when the scope closes.
 */
export class TelegramBot extends Effect.Service<TelegramBot>()("TelegramBot", {
  scoped: Effect.gen(function* () {
    const token = yield* botToken

    // Acquire the language model service used to generate replies.
    const chat = yield* ChatModel

    // Capture the current Effect runtime so the Telegraf callback (which lives
    // outside the Effect world) can execute Effect-based reply/logging logic.
    const runtime = yield* Effect.runtime<never>()

    const bot = new Telegraf(token)

    // Reply to any incoming text message with the agent's answer. On failure,
    // log via Effect.logError and send a graceful fallback so polling continues.
    bot.on(message("text"), (ctx) =>
      Runtime.runPromise(runtime)(
        Effect.gen(function* () {
          const text = ctx.message.text
          const reply = yield* chat.ask(text).pipe(
            Effect.tapError((error) => Effect.logError(error)),
            Effect.catchAll(() => Effect.succeed(FALLBACK_REPLY))
          )
          yield* Effect.promise(() => ctx.reply(reply))
          yield* Effect.log(`Replied to chat ${ctx.chat.id}`)
        })
      )
    )

    // Stop the bot when the scope closes (graceful shutdown).
    yield* Effect.addFinalizer(() => Effect.sync(() => bot.stop()))

    // Start long-polling in the background; surface launch errors via the logger.
    yield* Effect.sync(() => {
      void bot.launch().catch((error: unknown) =>
        Runtime.runFork(runtime)(Effect.logError(error))
      )
    })

    yield* Effect.log("Bot started. Long-polling for updates...")

    return { bot } as const
  }),
}) {}
