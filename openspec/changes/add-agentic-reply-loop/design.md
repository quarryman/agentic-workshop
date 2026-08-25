## Context

The Telegram bot (capability `phaze2`) currently replies to every text message with the constant `hello`. LangChain core was pre-installed to enable an agentic response. This change wires in a real LLM: the incoming message is passed through a LangChain built-in agent loop and the model's answer is returned to the user.

The provider is **Groq** (free tier, no credit card, fast inference), accessed through `@langchain/groq`'s `ChatGroq`. The bot already follows an Effect service + layer architecture (`TelegramBot` as an `Effect.Service`), so the language model is introduced the same way, as a `ChatModel` service constructed from an Effect `Config` value.

## Goals / Non-Goals

**Goals:**
- Replace the static reply with an LLM-generated answer produced by a LangChain built-in agent loop.
- Use a built-in LangChain agent construct (not a hand-rolled loop) with **no tools** yet.
- Back the loop with Groq via `ChatGroq`, using a free Groq-hosted model.
- Read `GROQ_API_KEY` via Effect `Config`, failing fast with a clear error when missing.
- Expose the model as an `Effect.Service` (`ChatModel`) provided through the app layer, consistent with `TelegramBot`.
- Keep all logging/error reporting Effect-idiomatic (no `console`).

**Non-Goals:**
- No tools / function-calling, no retrieval, no memory/persistence across messages (single-turn).
- No streaming replies, no multi-provider abstraction, no webhook changes.
- No prompt-engineering framework beyond a minimal system prompt.

## Decisions

- **Built-in agent loop: `createReactAgent` from `@langchain/langgraph/prebuilt`.** This is the canonical built-in agentic loop in LangChain JS. Invoked with `tools: []`, it runs the standard agent graph but, having no tools, resolves in a single model turn — satisfying "agentic loop, built-in class, no tools yet" without custom orchestration. Alternative: calling `ChatGroq.invoke()` directly — rejected because the user explicitly wants an agent loop, not a bare model call. Alternative: legacy `AgentExecutor` — rejected as it is being superseded by LangGraph agents.
- **LLM client: `ChatGroq` from `@langchain/groq`.** Matches the chosen provider; minimal config (`apiKey`, `model`). Model: **`llama-3.1-8b-instant`** — a fast, free Groq-hosted model; the model id is a single constant so swapping it is trivial.
- **`ChatModel` as an `Effect.Service`.** The service constructs the `ChatGroq` instance and the compiled agent once, and exposes an `ask(message: string): Effect<string>` method that runs the agent and returns the reply text. This keeps LangChain (a Promise-based library) at the service boundary and hands the rest of the app a clean Effect API.
- **API key via `Config.redacted("GROQ_API_KEY")`.** Read as a `Redacted` value so it is never accidentally logged; unwrapped with `Redacted.value` only when constructing `ChatGroq`. A missing key surfaces as a typed `ConfigError` at startup (same pattern as `TELEGRAM_BOT_TOKEN`).
- **Wiring.** `TelegramBot`'s service now depends on `ChatModel`; the text handler calls `ChatModel.ask(text)` (as an Effect run on the captured runtime) and replies with the result. The entry point provides `ChatModel.Default` alongside `TelegramBot.Default` via the layer graph.
- **Agent invocation shape.** Call `agent.invoke({ messages: [{ role: "user", content: text }] })` and extract the content of the last message as the reply string. A short system prompt (e.g. "You are a helpful assistant replying in a Telegram chat.") is passed via the agent's `stateModifier`/`messageModifier` (or prepended as a system message) to keep replies concise.

## Risks / Trade-offs

- **Extra dependency (`@langchain/langgraph`)** for what is currently a single-turn call → Accepted: it is the intended foundation for adding tools next, so paying the dependency cost now avoids churn later.
- **LLM latency / rate limits on the free tier** → The handler runs asynchronously per message; failures are caught and reported via `Effect.logError`, and the bot replies with a graceful fallback message instead of crashing.
- **API errors or empty completions** → `ChatModel.ask` maps failures into the Effect error channel; the handler tolerates them so one bad request never stops long-polling.
- **Token/key leakage** → Mitigated by `Config.redacted`; the key is never logged and only unwrapped at client construction.

## Migration Plan

Additive change to a running bot. Deploy by adding `GROQ_API_KEY` to the environment and installing `@langchain/groq` + `@langchain/langgraph`. Rollback: revert the handler to the static constant; no persistent state is involved.

## Open Questions

- None blocking. Model id (`llama-3.1-8b-instant`) and system prompt are defaults that can be tuned without spec changes.
