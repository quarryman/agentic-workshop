import { Effect } from "effect"
import { Telegraf } from "telegraf"
import { message } from "telegraf/filters"
import { STATIC_REPLY } from "./config.ts"

/**
 * Build a Telegraf bot as a scoped Effect resource.
 *
 * - acquire: constructs the client, registers the text handler, and starts
 *   long-polling. Resolves once polling has started.
 * - release: stops the bot so the process can shut down gracefully.
 */
export const makeBot = (token: string) =>
  Effect.acquireRelease(
    Effect.async<Telegraf, Error>((resume) => {
      const bot = new Telegraf(token)

      // Reply to any incoming text message in the originating chat.
      // The handler is modelled as an Effect and executed via the runtime.
      bot.on(message("text"), (ctx) =>
        Effect.runPromise(
          Effect.gen(function* () {
            yield* Effect.promise(() => ctx.reply(STATIC_REPLY))
            yield* Effect.log(`Replied "${STATIC_REPLY}" to chat ${ctx.chat.id}`)
          })
        )
      )

      let settled = false
      const settle = (result: Effect.Effect<Telegraf, Error>) => {
        if (settled) return
        settled = true
        resume(result)
      }

      // bot.launch() resolves only once the bot stops; the onLaunch callback
      // fires as soon as long-polling has started, which is our readiness signal.
      bot
        .launch(() => settle(Effect.succeed(bot)))
        .catch((error: unknown) =>
          settle(Effect.fail(error instanceof Error ? error : new Error(String(error))))
        )
    }),
    (bot) => Effect.sync(() => bot.stop("SIGTERM"))
  )
