# phaze2 — Agentic Reply Loop (Groq + LangChain)

## 1. Dependencies & Configuration

- [x] 1.1 Add runtime dependencies: `@langchain/groq` and `@langchain/langgraph`
- [x] 1.2 Add `GROQ_API_KEY` to `.env.example`
- [x] 1.3 Read the Groq API key via `Config.redacted("GROQ_API_KEY")` so it is never logged
- [x] 1.4 Ensure a missing `GROQ_API_KEY` produces a clear ConfigError that prevents startup
- [x] 1.5 Define the model identifier as a constant (e.g. `llama-3.1-8b-instant`) and a concise system prompt constant

## 2. Language Model Service

- [x] 2.1 Define a `ChatModel` scoped `Effect.Service` that unwraps the redacted key with `Redacted.value` and constructs a `ChatGroq` client from the key and model constant
- [x] 2.2 Build the built-in agent once with `createReactAgent` from `@langchain/langgraph/prebuilt` using the model and an empty `tools: []` (no tools yet)
- [x] 2.3 Expose an `ask(message: string)` operation that returns an Effect: invoke the agent with the user message (plus system prompt) and extract the last message's content as the reply text
- [x] 2.4 Map agent/LLM failures into the Effect error channel (do not throw); never log the API key

## 3. Wire Agent into the Bot

- [x] 3.1 Add `ChatModel` to the `TelegramBot` service dependencies and acquire it when the service is built
- [x] 3.2 Replace the static `hello` reply: the text handler calls `ChatModel.ask(text)` as an Effect on the captured runtime and replies with the result
- [x] 3.3 On model failure, log via `Effect.logError` and reply with a graceful fallback message so long-polling continues
- [x] 3.4 Remove the now-unused static reply constant

## 4. Application Entry Point

- [x] 4.1 Provide `ChatModel.Default` alongside `TelegramBot.Default` in the application layer
- [x] 4.2 Confirm the program still type-checks (`bun run typecheck`) and no `console` usage was introduced

## 5. Verification

- [x] 5.1 Run with valid `TELEGRAM_BOT_TOKEN` and `GROQ_API_KEY`; confirm the bot connects and long-polls
- [x] 5.2 Send a text message and confirm the bot replies with a model-generated answer (not the static `hello`)
- [x] 5.3 Run without `GROQ_API_KEY` and confirm startup fails with a clear configuration error
- [x] 5.4 Simulate a model failure (e.g. invalid key at request time) and confirm the bot logs the error and sends the fallback reply without crashing
