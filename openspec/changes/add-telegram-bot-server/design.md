## Context

This is a greenfield Effect.ts service that acts as a Telegram bot backend. The first iteration only needs to reply with static text, but the architecture should leave a clean seam for a future LangChain-based agentic loop. Telegraf is the de-facto TypeScript client for the Telegram Bot API and handles update parsing, long-polling, and reply helpers. Effect provides typed configuration, structured concurrency, resource-safe lifecycle management, and error handling.

The service is a new project directory inside the workspace and does not touch existing projects.

## Goals / Non-Goals

**Goals:**
- Stand up an Effect.ts application that boots a Telegraf bot and long-polls for updates.
- Reply to any incoming text message with a single configured static string.
- Read the bot token through Effect `Config` so misconfiguration fails fast and clearly.
- Manage the bot lifecycle (launch/stop) with Effect resource management for graceful shutdown.
- Install LangChain so a later change can add agent logic without new dependency churn.

**Non-Goals:**
- No agentic/LLM behavior in this change — LangChain is installed but unused.
- No webhook mode, no persistence/database, no multi-command routing.
- No handling of non-text message types beyond a generic reply.
- No deployment/hosting automation.

## Decisions

- **Runtime foundation: Effect.ts.** Provides typed config, error channels, and `Scope`-based resource management. Alternative: plain Node + dotenv — rejected because the project's intent is to build on Effect.
- **Telegram client: Telegraf.** Mature, well-typed, simple `bot.on('text', ...)` and `ctx.reply()` API, built-in long-polling via `bot.launch()`. Alternatives: `grammy` or raw Bot API calls — rejected to match the requested library.
- **Update transport: long-polling (`bot.launch()`).** Zero infra (no public URL/TLS needed) for a local/dev-first bot. Alternative: webhooks — deferred; adds hosting complexity not needed now.
- **Bot as a scoped Effect service (`Effect.Service`).** The bot is a long-lived process, not an acquire/release pair — building the service launches long-polling and registers a scope finalizer (`Effect.addFinalizer`) that calls `bot.stop()`. SIGINT/SIGTERM interrupt the fiber, closing the scope and running the finalizer for graceful shutdown.
- **Message handler modelled as an Effect.** The Telegraf text handler runs an Effect (`reply` + `Effect.log`) on the service's captured runtime via `Runtime.runPromise`, keeping the reply/logging logic idiomatic.
- **Configuration via `Config.string("TELEGRAM_BOT_TOKEN")`.** Missing token surfaces as a typed `ConfigError` at startup rather than a runtime crash deep in Telegraf.
- **Static reply as a constant.** The static response text is the constant `"hello"` referenced by the text handler, making the future swap to an agent a one-function change.
- **Effect-idiomatic observability.** All logging goes through `Effect.log` / `Effect.logError`; no `console` usage. The entry point reports non-interruption failures via `tapErrorCause` + `Effect.logError` and sets a non-zero exit code.
- **LangChain installed only.** Add `langchain` (+ `@langchain/core`) to dependencies to lock the future direction; no imports wired into the runtime path yet to avoid dead code affecting startup.
- **Package manager / runtime: Bun.** Use Bun for dependency management and to run the TypeScript entry point directly (no separate build/ts-node step). Provide `start`/`dev` scripts (e.g., `bun run src/main.ts`) and a `tsconfig.json`.

## Risks / Trade-offs

- **Long-polling only** → Fine for dev; a production deployment may need webhooks. Mitigation: lifecycle is abstracted, so switching transport is localized.
- **Installing LangChain unused** → Dependency weight and possible version drift before it is used. Mitigation: pin versions; a follow-up change will exercise it soon.
- **Telegraf signal handling vs Effect interruption** → Double-registered shutdown handlers could conflict. Mitigation: drive shutdown exclusively through the Effect scope finalizer.
- **Token leakage** → Token in env only, never logged. Mitigation: read via `Config`, avoid printing config values.

## Migration Plan

Greenfield addition — no data migration. Deploy by setting `TELEGRAM_BOT_TOKEN` and running the start script. Rollback: stop the process; no shared state is affected.

## Open Questions

- None outstanding. Decisions locked: Bun runtime, and static reply text is the constant `"hello"`.
