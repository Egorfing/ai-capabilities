import type { CapabilityDefinitionInput, DefinedCapability } from "./capability-definition-types.js";

const destructiveKeywords = ["delete", "remove", "destroy", "drop", "reset", "wipe", "terminate"];

function warnIfPolicyLooksUnsafe(definition: CapabilityDefinitionInput) {
  const haystack = [definition.id, ...(definition.aliases ?? [])].join(" ").toLowerCase();
  const matchesDestructive = destructiveKeywords.some((keyword) => haystack.includes(keyword));
  if (!matchesDestructive) {
    return;
  }

  const riskLevel = definition.policy?.riskLevel ?? "low";
  if (riskLevel === "safe" || riskLevel === "low") {
    const confirmation = definition.policy?.confirmationPolicy ?? "none";
    console.warn(
      `[defineCapability] capability "${definition.id}" looks destructive (keyword match) but is classified as riskLevel="${riskLevel}" with confirmationPolicy="${confirmation}". Consider setting riskLevel="high" and confirmationPolicy="always" or hiding it.`,
    );
  }
}

export function defineCapability<Input = Record<string, unknown>, Output = unknown>(
  definition: CapabilityDefinitionInput<Input, Output>,
): DefinedCapability<Input, Output> {
  if (!definition || typeof definition !== "object") {
    throw new Error("defineCapability requires a definition object");
  }
  if (!definition.id) {
    throw new Error("Capability definition requires an id");
  }
  if (!definition.displayTitle) {
    throw new Error(`Capability ${definition.id} requires displayTitle`);
  }
  if (!definition.description) {
    throw new Error(`Capability ${definition.id} requires description`);
  }
  if (!definition.inputSchema) {
    throw new Error(`Capability ${definition.id} requires inputSchema`);
  }

  warnIfPolicyLooksUnsafe(definition);

  return Object.freeze({
    ...definition,
    tags: definition.tags ?? [],
    aliases: definition.aliases ?? [],
    exampleIntents: definition.exampleIntents ?? [],
    policy: definition.policy ?? {},
    metadata: definition.metadata ?? {},
    source: "manual" as const,
  });
}
