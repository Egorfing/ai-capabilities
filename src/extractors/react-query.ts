// ---------------------------------------------------------------------------
// React Query extractor: find useQuery / useMutation hooks via AST
// ---------------------------------------------------------------------------

import { relative } from "node:path";
import { Project, SyntaxKind, type CallExpression, type SourceFile, type Node } from "ts-morph";
import type {
  RawCapability,
  CapabilityKind,
  CapabilityEffect,
  DiagnosticEntry,
} from "../types/index.js";
import type { Extractor, ExtractionContext, ExtractionResult } from "./types.js";
import { EXTRACTION_STAGE } from "./types.js";
import { discoverProjectTsFiles, filterFilesByGlob } from "./file-discovery.js";

// The React Query call names we look for
const QUERY_CALLS = new Set(["useQuery", "useInfiniteQuery", "useSuspenseQuery"]);
const MUTATION_CALLS = new Set(["useMutation"]);

// NOTE: SKIP_DIRS constant unused now, remove? The code earlier used to skip directories.

// ---- AST helpers -----------------------------------------------------------

/** Find the enclosing exported function declaration (the custom hook wrapper). */
function findEnclosingHookName(node: Node): string | undefined {
  let current: Node | undefined = node;
  while (current) {
    if (current.isKind(SyntaxKind.FunctionDeclaration)) {
      const name = current.getName();
      if (name?.startsWith("use")) return name;
    }
    if (current.isKind(SyntaxKind.VariableDeclaration)) {
      const name = current.getName();
      if (name?.startsWith("use")) return name;
    }
    current = current.getParent();
  }
  return undefined;
}

/** Try to extract a string literal from a node (e.g. queryKey first element, URL). */
function tryGetStringLiteral(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  if (node.isKind(SyntaxKind.StringLiteral)) return node.getLiteralValue();
  if (node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) return node.getLiteralValue();
  if (node.isKind(SyntaxKind.TemplateExpression)) {
    // Extract the head portion of a template literal: `/api/orders/${id}` → "/api/orders/"
    const head = node.getHead().getLiteralText();
    if (head) return head;
  }
  return undefined;
}

/** Extract queryKey strings from a useQuery call. */
function extractQueryKey(call: CallExpression): string[] {
  const args = call.getArguments();
  if (args.length === 0) return [];

  const firstArg = args[0];

  // Object syntax: useQuery({ queryKey: [...], ... })
  if (firstArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
    const qkProp = firstArg.getProperty("queryKey");
    if (qkProp && qkProp.isKind(SyntaxKind.PropertyAssignment)) {
      const init = qkProp.getInitializer();
      if (init && init.isKind(SyntaxKind.ArrayLiteralExpression)) {
        return init
          .getElements()
          .map((el) => tryGetStringLiteral(el))
          .filter((s): s is string => s !== undefined);
      }
    }
  }

  // Legacy array-first syntax: useQuery(["key", ...], queryFn)
  if (firstArg.isKind(SyntaxKind.ArrayLiteralExpression)) {
    return firstArg
      .getElements()
      .map((el) => tryGetStringLiteral(el))
      .filter((s): s is string => s !== undefined);
  }

  return [];
}

/** Try to find API URL from queryFn / mutationFn. */
function extractApiUrl(call: CallExpression): string | undefined {
  const args = call.getArguments();
  if (args.length === 0) return undefined;

  const firstArg = args[0];
  if (!firstArg.isKind(SyntaxKind.ObjectLiteralExpression)) return undefined;

  // Look for queryFn or mutationFn property
  for (const propName of ["queryFn", "mutationFn"]) {
    const prop = firstArg.getProperty(propName);
    if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) continue;
    const init = prop.getInitializer();
    if (!init) continue;

    // Search all string literals and template expressions in the function body
    const strings = init.getDescendantsOfKind(SyntaxKind.StringLiteral);
    for (const s of strings) {
      const val = s.getLiteralValue();
      if (val.startsWith("/api/") || val.startsWith("http")) return val;
    }

    const templates = init.getDescendantsOfKind(SyntaxKind.TemplateExpression);
    for (const t of templates) {
      const head = t.getHead().getLiteralText();
      if (head.startsWith("/api/") || head.startsWith("http")) return head;
    }

    const noSubs = init.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral);
    for (const n of noSubs) {
      const val = n.getLiteralValue();
      if (val.startsWith("/api/") || val.startsWith("http")) return val;
    }
  }

  return undefined;
}

/** Try to extract input parameter types from the enclosing function. */
function extractInputParams(call: CallExpression): Record<string, unknown> {
  // Walk up to the enclosing function
  let current: Node | undefined = call;
  while (current) {
    if (current.isKind(SyntaxKind.FunctionDeclaration)) {
      const params = current.getParameters();
      if (params.length > 0) {
        const properties: Record<string, unknown> = {};
        for (const p of params) {
          const name = p.getName();
          // Try to get type info
          const typeNode = p.getTypeNode();
          if (typeNode) {
            // For interface/type references, store the type name
            properties[name] = { type: "unknown", description: typeNode.getText() };
          } else {
            properties[name] = { type: "unknown" };
          }
        }
        return { type: "object", properties };
      }
      break;
    }
    current = current.getParent();
  }

  // For mutations, look at mutationFn parameter type
  const args = call.getArguments();
  if (args.length > 0 && args[0].isKind(SyntaxKind.ObjectLiteralExpression)) {
    const fnProp = args[0].getProperty("mutationFn");
    if (fnProp && fnProp.isKind(SyntaxKind.PropertyAssignment)) {
      const init = fnProp.getInitializer();
      if (init && init.isKind(SyntaxKind.ArrowFunction)) {
        const fnParams = init.getParameters();
        if (fnParams.length > 0) {
          const p = fnParams[0];
          const typeNode = p.getTypeNode();
          if (typeNode) {
            return {
              type: "object",
              description: `Parameter: ${p.getName()}: ${typeNode.getText()}`,
            };
          }
        }
      }
    }
  }

  return { type: "object", properties: {} };
}

// ---- Capability ID generation -----------------------------------------------

function hookNameToId(hookName: string): string {
  // useCreateOrder → create-order, useOrders → orders
  const withoutUse = hookName.replace(/^use/, "");
  return withoutUse
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

// ---- Main extraction -------------------------------------------------------

function processFile(
  sourceFile: SourceFile,
  projectPath: string,
  diagnostics: DiagnosticEntry[],
): RawCapability[] {
  const capabilities: RawCapability[] = [];
  const filePath = relative(projectPath, sourceFile.getFilePath());

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const fnName = call.getExpression().getText();

    const isQuery = QUERY_CALLS.has(fnName);
    const isMutation = MUTATION_CALLS.has(fnName);

    if (!isQuery && !isMutation) continue;

    const hookName = findEnclosingHookName(call);
    if (!hookName) {
      diagnostics.push({
        level: "warning",
        stage: EXTRACTION_STAGE,
        sourceType: "react-query",
        message: `Found ${fnName} call not inside a use* function, skipping.`,
        filePath,
      });
      continue;
    }

    const kind: CapabilityKind = isMutation ? "mutation" : "read";
    const effects: CapabilityEffect[] = isMutation
      ? ["network-request", "state-mutation"]
      : ["network-request"];

    const queryKey = isQuery ? extractQueryKey(call) : [];
    const apiUrl = extractApiUrl(call);
    const inputSchema = extractInputParams(call);
    const slug = hookNameToId(hookName);

    const cap: RawCapability = {
      id: `hook.${slug}`,
      source: {
        type: "react-query",
        filePath,
        location: hookName,
      },
      kind,
      title: hookName,
      inputSchema,
      effects,
      tags: ["react-query", kind],
      metadata: {
        hookName,
        reactQueryCall: fnName,
        queryKey: queryKey.length > 0 ? queryKey : undefined,
        apiUrl: apiUrl ?? undefined,
      },
    };

    capabilities.push(cap);
  }

  return capabilities;
}

// ---- Extractor implementation ----------------------------------------------

export const reactQueryExtractor: Extractor = {
  name: "react-query",
  sourceType: "react-query",

  async extract(ctx: ExtractionContext): Promise<ExtractionResult> {
    const diagnostics: DiagnosticEntry[] = [];
    const includePatterns = [
      ...ctx.config.paths.include,
      ...ctx.config.extractors.reactQuery.include,
    ];
    const excludePatterns = [
      ...ctx.config.paths.exclude,
      ...ctx.config.extractors.reactQuery.exclude,
    ];

    const discoveredFiles = discoverProjectTsFiles(ctx.projectPath);
    const tsFiles = filterFilesByGlob(
      discoveredFiles,
      ctx.projectPath,
      includePatterns,
      excludePatterns,
    );

    if (tsFiles.length === 0) {
      diagnostics.push({
        level: "info",
        stage: EXTRACTION_STAGE,
        sourceType: "react-query",
        message: `No .ts/.tsx files matched include/exclude patterns in ${ctx.projectPath}`,
      });
      return { extractor: "react-query", capabilities: [], diagnostics };
    }

    const tsconfigPath =
      ctx.config.extractors.reactQuery.tsconfig ?? ctx.config.project.tsconfig;

    const project = new Project({
      ...(tsconfigPath ? { tsConfigFilePath: tsconfigPath } : {}),
      compilerOptions: { allowJs: true, noEmit: true },
      skipAddingFilesFromTsConfig: true,
    });

    for (const f of tsFiles) {
      project.addSourceFileAtPath(f);
    }

    const allCapabilities: RawCapability[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      try {
        const caps = processFile(sourceFile, ctx.projectPath, diagnostics);
        allCapabilities.push(...caps);
      } catch (err) {
        diagnostics.push({
          level: "error",
          stage: EXTRACTION_STAGE,
          sourceType: "react-query",
          message: `Error processing ${sourceFile.getFilePath()}: ${err instanceof Error ? err.message : String(err)}`,
          filePath: sourceFile.getFilePath(),
          details: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    diagnostics.push({
      level: "info",
      stage: EXTRACTION_STAGE,
      sourceType: "react-query",
      message: `Scanned ${tsFiles.length} files (from ${discoveredFiles.length} discovered), found ${allCapabilities.length} React Query hooks.`,
      details: { scanned: tsFiles.length, discovered: discoveredFiles.length, capabilities: allCapabilities.length },
    });

    return { extractor: "react-query", capabilities: allCapabilities, diagnostics };
  },
};
