import type { CapabilityExecutionResult } from "ai-capabilities";
import type { createExampleRuntime } from "./runtime.js";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type Plan =
  | { kind: "create-project"; name: string; openAfterCreate: boolean }
  | { kind: "list-projects" }
  | { kind: "open-project"; projectId: string };

export type ChatMessage = Message;

export function createLocalAgent(runtime: ReturnType<typeof createExampleRuntime>) {
  return {
    async handleUserMessage(input: string): Promise<{ reply: string; events: CapabilityExecutionResult[] }> {
      const plan = createPlanFromText(input);
      if (!plan) {
        return {
          reply: "I could not infer the desired action. Try asking to create, list, or open a project.",
          events: [],
        };
      }

      switch (plan.kind) {
        case "create-project": {
          logAgent(`intent=createProject name="${plan.name}" followUp=${plan.openAfterCreate}`);
          const events: CapabilityExecutionResult[] = [];
          const creation = await executeCapability(runtime, "projects.create", { name: plan.name });
          events.push(creation);
          if (creation.status !== "success") {
            return { reply: formatFailure("projects.create", creation), events };
          }
          let reply = formatCreateReply(creation, plan.openAfterCreate);
          if (plan.openAfterCreate) {
            const project = creation.data as { id?: string };
            if (project?.id) {
              const navigation = await executeCapability(runtime, "navigation.open-project-page", { projectId: project.id });
              events.push(navigation);
              reply = formatNavigationReply(navigation, reply);
            }
          }
          return { reply, events };
        }
        case "list-projects": {
          logAgent("intent=listProjects");
          const listing = await executeCapability(runtime, "projects.list", {});
          const reply = listing.status === "success" ? formatListReply(listing) : formatFailure("projects.list", listing);
          return { reply, events: [listing] };
        }
        case "open-project": {
          logAgent(`intent=openProject projectId=${plan.projectId}`);
          const navigation = await executeCapability(runtime, "navigation.open-project-page", { projectId: plan.projectId });
          const reply =
            navigation.status === "success"
              ? "Opening the project page in your UI."
              : formatFailure("navigation.open-project-page", navigation);
          return { reply, events: [navigation] };
        }
        default:
          return {
            reply: "I could not infer the desired action. Try asking to create, list, or open a project.",
            events: [],
          };
      }
    },
  };
}

function createPlanFromText(text: string): Plan | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("create")) {
    const nameMatch = text.match(/create (?:a )?project (?:called|named)?\s*(.*)/i);
    const name = nameMatch?.[1]?.trim() || "Untitled";
    const openAfterCreate = !lower.includes("don't open");
    return { kind: "create-project", name, openAfterCreate };
  }
  if (lower.includes("list")) {
    return { kind: "list-projects" };
  }
  if (lower.includes("open")) {
    const idMatch = text.match(/project ([\w_-]+)/i);
    const projectId = idMatch?.[1] ?? "proj_1";
    return { kind: "open-project", projectId };
  }
  return undefined;
}

async function executeCapability(
  runtime: ReturnType<typeof createExampleRuntime>,
  capabilityId: string,
  input: Record<string, unknown>,
): Promise<CapabilityExecutionResult> {
  logAgent(`executing ${capabilityId} ${JSON.stringify(input)}`);
  const result = await runtime.invoke(capabilityId, input);
  if (result.status === "success") {
    console.log(`[runtime] ${capabilityId} result`, result.data);
  } else {
    console.warn(`[runtime] ${capabilityId} failed`, result.error);
  }
  return result;
}

function formatFailure(capabilityId: string, execution: CapabilityExecutionResult): string {
  return `Action ${capabilityId} failed: ${execution.error?.message ?? "unknown error"}`;
}

function formatCreateReply(execution: CapabilityExecutionResult, openedAfter: boolean): string {
  if (execution.status !== "success") {
    return formatFailure("projects.create", execution);
  }
  const project = execution.data as { name?: string; id?: string };
  const suffix = openedAfter ? " I'll open it now." : "";
  return `Created project ${project?.name ?? ""} (${project?.id ?? ""}).${suffix}`;
}

function formatListReply(execution: CapabilityExecutionResult): string {
  if (execution.status !== "success") {
    return formatFailure("projects.list", execution);
  }
  const result = execution.data as { projects?: Array<{ name: string }> };
  const names = result.projects?.map((p) => p.name).join(", ") ?? "no projects";
  return `Here are your projects: ${names}.`;
}

function formatNavigationReply(execution: CapabilityExecutionResult, fallback: string): string {
  if (execution.status !== "success") {
    return `${fallback} Navigation failed: ${execution.error?.message ?? "unknown error"}.`;
  }
  return `${fallback} Opening the project page in your UI.`;
}

function logAgent(message: string) {
  console.log(`[agent] ${message}`);
}
