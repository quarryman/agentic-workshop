import { Cause, Effect, Exit, Fiber } from "effect"
import { TelegramBot } from "./bot.ts"
import { ChatModel } from "./chat.ts"

/**
 * The main program: build the TelegramBot service (which launches long-polling)
 * and keep the process alive until interrupted. Effect.never holds the scope
 * open so the bot keeps running; interrupting the fiber closes the scope and
 * runs the service finalizer that stops the bot.
 */
const program = Effect.gen(function* () {
  yield* TelegramBot
  yield* Effect.never
})

// Provide the service layer, scope the program, and report non-interruption
// failures via Effect's logger (no console usage).
const runnable = program.pipe(
  Effect.provide(TelegramBot.Default),
  Effect.provide(ChatModel.Default),
  Effect.scoped,
  Effect.tapErrorCause((cause) =>
    Cause.isInterruptedOnly(cause) ? Effect.void : Effect.logError(cause)
  )
)

// Run the program with the Effect runtime as the main entry point.
const fiber = Effect.runFork(runnable)

// Graceful shutdown: interrupting the fiber closes the scope and stops the bot.
const shutdown = () => {
  Effect.runFork(Fiber.interrupt(fiber))
}
process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)

fiber.addObserver((exit) => {
  if (Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause)) {
    // Failure cause was already logged via Effect.logError; signal a non-zero exit.
    process.exitCode = 1
  }
  process.exit()
})
