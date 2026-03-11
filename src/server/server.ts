import { createServer } from "./create-server.js";
import type { CapabilityHttpServer, ServerDependencies, ServerInfo, ServerOptions } from "./server-types.js";

export interface StartedServer {
  server: CapabilityHttpServer;
  info: ServerInfo;
}

export async function startServer(
  deps: ServerDependencies,
  options?: ServerOptions,
): Promise<StartedServer> {
  const server = createServer(deps, options);
  const info = await server.listen();
  return { server, info };
}
