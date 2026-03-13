# Recommended file structure

The example integration in `examples/react-app` illustrates the target layout for a frontend project:

```
src/
  ai-capabilities/
    capabilities/
      createProject.ts        # Backend/API mutation capability
      listProjects.ts         # Read capability (safe, public)
      openProjectPage.ts      # Frontend/UI navigation capability
    registry.ts               # Collects and registers capabilities
    index.ts                  # Re-exports for convenience
  agent/
    runtime.ts                # Creates CapabilityRuntime + handlers, injects router/ui context
    localAgent.ts             # Minimal agent loop (replace with real LLM)
  data/
    projectStore.ts           # Example data layer invoked by capabilities
  components/
    AiChat.tsx                # Simple chat UI wired to the agent/runtime
  App.tsx                     # Mounts the chat component
ai-capabilities.config.json    # Config discovered via `npx ai-capabilities init`
```

## How the pieces connect
1. **Capabilities** – Defined with `defineCapability({ ... })`, stored in `src/ai-capabilities/capabilities/*`.
2. **Registry** – Uses `registerCapabilityDefinitions` to bind capabilities to the runtime’s `CapabilityRegistry`.
3. **Runtime** – Creates a `CapabilityRuntime` with a manifest derived from the same capabilities and injects router/ui/notify adapters through `handlerContext`.
4. **Agent** – Decides which capability to call (placeholder logic). Replace with a real LLM by sending the canonical manifest/public manifest as context.
5. **Chat UI** – Collects user input, calls the agent, displays replies.

Copy this structure into your application, swap `projectStore` for real API calls, and wire the router/ui adapters to your own navigation components.
