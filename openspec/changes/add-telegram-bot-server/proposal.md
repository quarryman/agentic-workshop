## Why

We need a backend service that receives Telegram messages and responds to users. Building it on Effect.ts gives us a typed, composable foundation for reliable I/O, error handling, and dependency management. Starting with a static reply keeps the first iteration simple and verifiable, while installing LangChain up front prepares the codebase for an agentic response loop in a later change.

## What Changes

- Add a new Effect.ts server application that runs as a Telegram bot backend.
- Integrate Telegraf as the Telegram Bot API client to receive incoming messages and send replies.
- On any incoming text message, reply with a fixed static text response.
- Load the Telegram bot token from configuration/environment via Effect's Config.
- Add LangChain as a dependency (installed only) to enable a future agentic loop; no agent logic is wired in yet.
- Add project scaffolding: package manifest, TypeScript config, entry point, and run scripts.

## Capabilities

### New Capabilities
- `phaze1`: An Effect.ts service that connects to Telegram via Telegraf, receives user messages, and replies with a configured static text response, with the bot token supplied through configuration.

### Modified Capabilities
<!-- None: this is a greenfield service. -->

## Impact

- New project directory for the Effect.ts Telegram bot backend (source, config, scripts).
- New runtime dependencies: `effect`, `telegraf`, `langchain` (and required LangChain core packages).
- New dev dependencies: TypeScript and its runtime tooling.
- Requires a `TELEGRAM_BOT_TOKEN` environment variable to run.
- No changes to other existing projects in the workspace.
