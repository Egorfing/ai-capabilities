# Demo run checklist

Follow these steps to reproduce the “Create & open project” scenario locally without external API keys.

```bash
# 1. Install repo dependencies (root)
npm install

# 2. Bootstrap config + scaffold (idempotent)
npx ai-capabilities init

# 3. Generate manifests so doctor/inspect have artifacts
npx ai-capabilities extract

# 4. Check readiness and policies
npx ai-capabilities doctor

# 5. Launch the React demo (inside examples/react-app)
cd examples/react-app
npm install
npm run dev
```

Then:

1. Open `http://localhost:5173` in a browser.
2. In the **AI Chat** component, type: `Create a project called Analytics`.
3. Observe the conversation log plus the console output (look for `[agent]` and `[runtime]` prefixes) that shows:
   - intent detection
   - execution of `projects.create`
   - automatic follow-up call to `navigation.open-project-page`
4. Try additional prompts: `List my projects`, `Open project proj_2`.

Use Ctrl+C to stop the dev server. Rerun `doctor` after editing capabilities to ensure the demo stays “Pilot ready”.
