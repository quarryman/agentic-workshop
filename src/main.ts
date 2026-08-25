import { Cause, Effect, Exit, Fiber } from "effect"
import { botToken } from "./config.ts"
import { makeBot } from "./bot.ts"

/**
 * Compose the config + bot resource into a single runnable program.
 * The scope keeps the bot alive until the fiber is interrupted, at which point
 * the resource's release step stops the bot.
 */
const program = Effect.scoped(
  Effect.gen(function* () {
    const token = yield* botToken
    yield* makeBot(token)
    yield* Effect.log("Bot started. Long-polling for updates...")
    yield* Effect.never
  })
)

// Run the program with the Effect runtime as the main entry point.
const fiber = Effect.runFork(program)

// Graceful shutdown: interrupting the fiber closes the scope and stops the bot.
const shutdown = () => {
  Effect.runFork(Fiber.interrupt(fiber))
}
process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)

fiber.addObserver((exit) => {
  if (Exit.isFailure(exit)) {
    if (!Cause.isInterruptedOnly(exit.cause)) {
      console.error(Cause.pretty(exit.cause))
      process.exitCode = 1
    }
  }
  process.exit()
})
