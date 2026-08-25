# Phase 1: Static-Reply Telegram Bot

## 1. Project Scaffolding

- [x] 1.1 Create the bot backend project directory with `package.json` (type: module) and a `start`/`dev` script
- [x] 1.2 Add `tsconfig.json` configured for a modern ESM TypeScript build
- [x] 1.3 Add runtime dependencies: `effect`, `telegraf`
- [x] 1.4 Add LangChain dependencies (install only): `langchain` and `@langchain/core`
- [x] 1.5 Add dev tooling (TypeScript) and a `.gitignore` / `.env.example` with `TELEGRAM_BOT_TOKEN`

## 2. Configuration

- [x] 2.1 Implement bot token loading via Effect `Config.string("TELEGRAM_BOT_TOKEN")`
- [x] 2.2 Ensure a missing token produces a clear ConfigError that prevents startup
- [x] 2.3 Define the static reply text as a constant with the value `hello`

## 3. Telegram Bot Integration

- [x] 3.1 Define a `TelegramBot` scoped `Effect.Service` that constructs the Telegraf client from the configured token
- [x] 3.2 Register a scope finalizer (`Effect.addFinalizer`) that calls `bot.stop()`; start long-polling with `bot.launch()` in the background (no acquire/release pair)
- [x] 3.3 Register a text-message handler modelled as an Effect (reply + `Effect.log`) run on the service runtime via `Runtime.runPromise`
- [x] 3.4 Handle graceful shutdown on SIGINT/SIGTERM by interrupting the fiber so the scope closes and the finalizer stops the bot

## 4. Application Entry Point

- [x] 4.1 Provide the `TelegramBot.Default` layer to a scoped program and keep it alive with `Effect.never`
- [x] 4.2 Run the program with `Effect.runFork`; report non-interruption failures via `Effect.logError` (no `console`) and set a non-zero exit code
- [x] 4.3 Confirm LangChain packages are installed but not imported in the runtime path

## 5. Verification

- [x] 5.1 Run with a valid `TELEGRAM_BOT_TOKEN` and confirm the bot connects and long-polls
- [ ] 5.2 Send a text message to the bot and confirm it replies with `hello` in the same chat
- [x] 5.3 Run without the token and confirm startup fails with a clear configuration error
- [x] 5.4 Send SIGINT and confirm the bot stops and the process exits cleanly
