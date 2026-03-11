// ---------------------------------------------------------------------------
// Form/schema extractor: parse Zod schemas → form capabilities
// ---------------------------------------------------------------------------

import { relative } from "node:path";
import {
  Project,
  SyntaxKind,
  type Expression,
  type ObjectLiteralExpression,
} from "ts-morph";
import type { JsonSchema, RawCapability, DiagnosticEntry } from "../types/index.js";
import type { Extractor, ExtractionContext, ExtractionResult } from "./types.js";
import { EXTRACTION_STAGE } from "./types.js";
import { discoverProjectTsFiles, filterFilesByGlob } from "./file-discovery.js";

export const formExtractor: Extractor = {
  name: "forms",
  sourceType: "form",

  async extract(ctx: ExtractionContext): Promise<ExtractionResult> {
    const diagnostics: DiagnosticEntry[] = [];

    const includePatterns = [
      ...ctx.config.paths.include,
      ...ctx.config.extractors.form.include,
    ];
    const excludePatterns = [
      ...ctx.config.paths.exclude,
      ...ctx.config.extractors.form.exclude,
    ];

    const discoveredFiles = discoverProjectTsFiles(ctx.projectPath);
    const formFiles = filterFilesByGlob(
      discoveredFiles,
      ctx.projectPath,
      includePatterns,
      excludePatterns,
    );

    if (formFiles.length === 0) {
      diagnostics.push({
        level: "info",
        stage: EXTRACTION_STAGE,
        sourceType: "form",
        message: `No form files matched include/exclude patterns in ${ctx.projectPath}`,
      });
      return { extractor: "forms", capabilities: [], diagnostics };
    }

    const project = new Project({
      compilerOptions: { allowJs: true, noEmit: true },
      skipAddingFilesFromTsConfig: true,
    });
    for (const file of formFiles) {
      project.addSourceFileAtPath(file);
    }

    const capabilities: RawCapability[] = [];
    let filesWithSchemas = 0;

    for (const sourceFile of project.getSourceFiles()) {
      const filePath = relative(ctx.projectPath, sourceFile.getFilePath());
      const produced = processFile(sourceFile, filePath, capabilities, diagnostics);
      if (produced > 0) {
        filesWithSchemas += 1;
        diagnostics.push({
          level: "info",
          stage: EXTRACTION_STAGE,
          sourceType: "form",
          message: `Extracted ${produced} schemas from ${filePath}`,
          filePath,
          details: { count: produced },
        });
      }
    }

    diagnostics.push({
      level: "info",
      stage: EXTRACTION_STAGE,
      sourceType: "form",
      message: `Scanned ${formFiles.length} files, found ${capabilities.length} form schemas`,
      details: { scanned: formFiles.length, filesWithSchemas, schemas: capabilities.length },
    });

    return { extractor: "forms", capabilities, diagnostics };
  },
};

function processFile(
  sourceFile: import("ts-morph").SourceFile,
  filePath: string,
  capabilities: RawCapability[],
  diagnostics: DiagnosticEntry[],
): number {
  let count = 0;

  for (const decl of sourceFile.getVariableDeclarations()) {
    if (!decl.isExported()) continue;
    const initializer = decl.getInitializer();
    if (!initializer || !isZodObjectCall(initializer)) continue;
    const schema = extractSchemaFromZod(initializer, diagnostics, filePath);
    if (!schema) continue;

    const name = decl.getName();
    const slug = schemaNameToSlug(name);
    const cap: RawCapability = {
      id: `form.${slug}`,
      kind: "workflow",
      title: `${name}`,
      description: `User form "${name}"`,
      source: {
        type: "form",
        filePath,
        location: name,
      },
      inputSchema: schema,
      effects: [],
      tags: ["form"],
      metadata: {
        schemaName: name,
      },
    };

    capabilities.push(cap);
    count += 1;
  }

  return count;
}

function isZodObjectCall(expr: Expression): expr is import("ts-morph").CallExpression {
  if (!expr.isKind(SyntaxKind.CallExpression)) return false;
  const callee = expr.getExpression();
  if (!callee) return false;
  return callee.getText().endsWith("z.object");
}

function schemaNameToSlug(name: string): string {
  return name
    .replace(/Schema$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function extractSchemaFromZod(
  callExpr: import("ts-morph").CallExpression,
  diagnostics: DiagnosticEntry[],
  filePath: string,
): JsonSchema | undefined {
  const arg = callExpr.getArguments()[0];
  if (!arg || !arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
    diagnostics.push({
      level: "warning",
      stage: EXTRACTION_STAGE,
      sourceType: "form",
      message: "z.object must receive an object literal",
      filePath,
    });
    return undefined;
  }
  return buildSchemaFromObject(arg);
}

function buildSchemaFromObject(obj: ObjectLiteralExpression): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const prop of obj.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
    const nameNode = prop.getNameNode();
    if (!nameNode) continue;
    const key = nameNode.getText().replace(/['"]/g, "");
    const initializer = prop.getInitializer();
    if (!initializer) continue;
    const { schema, optional } = convertZodExpression(initializer);
    properties[key] = schema;
    if (!optional) {
      required.push(key);
    }
  }

  const result: JsonSchema = { type: "object", properties };
  if (required.length > 0) {
    result.required = required;
  }
  return result;
}

function convertZodExpression(expr: Expression): { schema: JsonSchema; optional: boolean } {
  const { baseExpr, optional } = unwrapOptional(expr);
  if (baseExpr.isKind(SyntaxKind.CallExpression)) {
    const callee = baseExpr.getExpression();
    if (callee && callee.isKind(SyntaxKind.PropertyAccessExpression)) {
      const calleeText = callee.getText();
      if (calleeText.endsWith("z.string")) {
        return { schema: { type: "string" }, optional };
      }
      if (calleeText.endsWith("z.number")) {
        return { schema: { type: "number" }, optional };
      }
      if (calleeText.endsWith("z.boolean")) {
        return { schema: { type: "boolean" }, optional };
      }
      if (calleeText.endsWith("z.enum")) {
        const arg = baseExpr.getArguments()[0];
        if (arg && arg.isKind(SyntaxKind.ArrayLiteralExpression)) {
          const values = arg
            .getElements()
            .map((el) => (el.isKind(SyntaxKind.StringLiteral) ? el.getLiteralValue() : undefined))
            .filter((v): v is string => v !== undefined);
          return { schema: { type: "string", enum: values }, optional };
        }
      }
      if (calleeText.endsWith("z.array")) {
        const arg = baseExpr.getArguments()[0] as Expression | undefined;
        if (arg) {
          const inner = convertZodExpression(arg).schema;
          return { schema: { type: "array", items: inner }, optional };
        }
      }
      if (calleeText.endsWith("z.object")) {
        const arg = baseExpr.getArguments()[0];
        if (arg && arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
          return { schema: buildSchemaFromObject(arg), optional };
        }
        return { schema: { type: "object" }, optional };
      }
    }
  }

  return { schema: { type: "string" }, optional };
}

function unwrapOptional(expr: Expression): { baseExpr: Expression; optional: boolean } {
  let current: Expression = expr;
  let optional = false;

  while (current.isKind(SyntaxKind.CallExpression)) {
    const callExpr = current;
    const callee = callExpr.getExpression();
    if (!callee.isKind(SyntaxKind.PropertyAccessExpression)) break;
    const name = callee.getName();
    if (name === "optional") {
      optional = true;
      current = callee.getExpression();
      continue;
    }
    break;
  }

  return { baseExpr: current, optional };
}
