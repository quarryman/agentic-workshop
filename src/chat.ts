import { ChatGroq } from "@langchain/groq"
import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { Data, Effect, Redacted } from "effect"
import { groqApiKey, groqModel, SYSTEM_PROMPT } from "./config.ts"
import { FsTools } from "./fstools.ts"

/** Failure raised when the agent/LLM call errors. Never carries the API key. */
export class ChatModelError extends Data.TaggedError("ChatModelError")<{
  readonly cause: unknown
}> {}

/**
 * Extract the plain text of the agent's final message. LangChain message
 * content can be a string or an array of content blocks; normalise to a string.
 */
const extractText = (messages: ReadonlyArray<{ content: unknown }>): string => {
  const last = messages[messages.length - 1]
  const content = last?.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : part && typeof part === "object" && "text" in part
            ? String((part as { text: unknown }).text)
            : ""
      )
      .join("")
  }
  return content == null ? "" : String(content)
}

/**
 * The language model as an Effect service.
 *
 * Constructs a Groq chat client from the configured (redacted) API key and
 * compiles a built-in LangChain agent loop (`createReactAgent`) with the
 * sandboxed read-only filesystem tools. Exposes `ask`, which runs the agent
 * for a user message and returns the reply text as an Effect. LangChain's
 * Promise API is kept at this boundary.
 */
export class ChatModel extends Effect.Service<ChatModel>()("ChatModel", {
  effect: Effect.gen(function* () {
    const key = yield* groqApiKey
    const model = yield* groqModel
    const fsTools = yield* FsTools

    const llm = new ChatGroq({
      apiKey: Redacted.value(key),
      model,
    })

    // Built-in agentic loop with the read-only filesystem tools (real tool calling).
    const agent = createReactAgent({
      llm,
      tools: fsTools.tools,
      prompt: SYSTEM_PROMPT,
    })

    const ask = (message: string): Effect.Effect<string, ChatModelError> =>
      Effect.tryPromise({
        try: () =>
          agent.invoke({ messages: [{ role: "user", content: message }] }),
        catch: (cause) => new ChatModelError({ cause }),
      }).pipe(Effect.map((result) => extractText(result.messages)))

    return { ask } as const
  }),
}) {}
