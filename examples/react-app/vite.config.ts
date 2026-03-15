import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "ai-capabilities": "ai-capabilities/browser",
    },
  },
  optimizeDeps: {
    exclude: ["ai-capabilities"],
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
