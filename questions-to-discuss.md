# Real AI assistant for your product — discussion topics

## Context

We are extracting the chat + tool-calling assistant logic from `mva-front` into a standalone library. The assistant should not just give advice—it must execute pre-approved, safe actions inside the application.

---

## 1. Library scope and architecture

- What belongs in the library?
  - **Core only:** orchestrator, tool registry, request builder, response normalizer.
  - **Core + UI:** also ship a headless or styled React chat component.
  - **Core + UI + adapters:** add adapters for Vue, Svelte, vanilla JS.
- Should the core be framework-agnostic (pure TS + optional bindings)?
- How do we abstract over LLM providers? Current PoC targets Ollama (`qwen3-coder:30b`). Need adapter layer for OpenAI, Anthropic, local models, custom backends.
- What do we do with the system prompt? Provide a default or require the consumer to pass it?
- Should the library manage conversation state (messages, clarifications) or leave that to the consumer?
- Streaming support: current implementation uses `stream: false`. Do we ship both streaming and non-streaming flows?
- How does i18n work (current prompt/messages are in Russian)?

## 2. Tooling model

- How should consumers register their tools/actions? The current `toolRegistry.ts` is static—do we need a plugin API?
- How do we express “this tool is only available when context X is present”?
- Should the library validate tool arguments or should that remain the consumer’s job?
- How are tool results handled (success, error, side effects)?
- Do we support tool chains (one tool invoking another)?
- Which description format do we target for LLMs—OpenAI function-calling, Anthropic tool-use, or our own abstraction?

## 3. Security model

- Key value proposition: “the assistant can only do what you allow.” How is that enforced in the library?
- Do we need a permissions layer (e.g., tools that require user confirmation before execution)?
- How do we mitigate prompt-injection attacks via user input?
- Should the library sandbox tool execution?
- Rate limiting / abuse protection—library responsibility or consumer responsibility?

## 4. Existing solutions and competition

- How does this compare to:
  - **Vercel AI SDK** — streaming, tool calling, React hooks, multi-provider support.
  - **LangChain.js** — agents, tools, chains.
  - **CopilotKit** — in-app AI copilots with actions.
  - **Assistant UI** — React components for AI chat.
  - **OpenAI Assistants API** — server-side tool calls.
  - **Anthropic Tool Use** — native tooling for Claude.
- What’s the differentiator vs. these options?
- Is “only safe, pre-defined actions” enough as a pitch?
- Which market gap does this fill?

## 5. Naming and positioning

- Library name ideas—something that signals “an AI assistant that acts, not just chats.”
- npm namespace availability.
- Positioning options: “AI agent framework” vs. “assistant toolkit” vs. “chat SDK with tool calling”.
- Target audience: front-end engineers adding AI to existing apps, or broader?

## 6. Open-source strategy

- Which model?
  - Fully open (MIT/Apache 2.0) — maximum adoption.
  - Open core — free core + paid extensions.
  - Source available (BSL/SSPL) — code visible but commercial use restricted.
- How to build a community around the project?
- Governance model: single maintainer vs. organization?
- Contributor guidelines from day one?
- Platform choice: GitHub (larger reach) vs. GitLab (current project lives there)?

## 7. Licensing

- MIT — maximum freedom/distribution, no monetization protection.
- Apache 2.0 — MIT-style plus patent grants.
- AGPL — forces derivatives to stay open source (works for open-core play).
- BSL — source available, becomes fully open after a grace period.
- Dual licensing — OSS for open projects, commercial license for business.
- How does the license choice impact adoption vs. monetization?
- If open core: what stays in the free tier vs. premium?

## 8. Monetization paths

- **Open-core:** free library + paid premium features (analytics dashboard, enterprise tools, advanced security).
- **Hosted service:** managed offering (LLM routing, tool execution monitoring).
- **Marketplace:** paid tool/action plugins.
- **Support & consulting:** enterprise support contracts.
- **SaaS wrapper:** no-code/low-code builder on top of the SDK.
- **LLM proxy:** routed through our API, pay-per-request (Vercel AI style).
- Is monetizing a JS library in 2026 viable? Any successful examples?
- Is the market large enough? Who pays?

## 9. Technical execution plan

- Package layout: monorepo (core, react, vue, etc.) or single package?
- Build tooling: tsup, Vite library mode, unbuild?
- Testing strategy: unit tests for the core, integration tests for framework bindings.
- Documentation stack: Docusaurus, VitePress, Starlight?
- CI/CD: auto-publish, changelog generation.
- What ships first? Define the MVP scope.

## 10. API design questions

- What’s the simplest “hello world” for consumers?
- How many lines does it take to get a working assistant with one custom action?
- Should we offer both declarative config and programmatic APIs?
- How do we expose TypeScript generics for tool arguments (type-safe definitions)?
- Error-handling philosophy—throw vs. returning `Result` objects?

## 11. Long-term vision

- Where do we want this project to be in 2–3 years?
- Multimodality (voice, vision)?
- Agent-to-agent communication?
- Integration with MCP (Model Context Protocol)?
- Can this become the standard for “safe AI actions” in web apps?
- Path to becoming infrastructure/standard rather than just another library?

---

## Suggested priority order

1. Research existing solutions (section 4).
2. Articulate the unique value proposition.
3. Design the API (sections 1, 2, 10).
4. Select the license (section 7).
5. Build the MVP.
6. Plan the open-source launch (section 6).
7. Define monetization strategy (section 8).
