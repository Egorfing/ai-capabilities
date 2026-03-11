// ---------------------------------------------------------------------------
// Router extractor: parse React Router config objects → navigation capabilities
// ---------------------------------------------------------------------------

import { relative } from "node:path";
import { Project, SyntaxKind, type ArrayLiteralExpression, type ObjectLiteralExpression } from "ts-morph";
import type { RawCapability, DiagnosticEntry } from "../types/index.js";
import type { Extractor, ExtractionContext, ExtractionResult } from "./types.js";
import { EXTRACTION_STAGE } from "./types.js";
import { discoverProjectTsFiles, filterFilesByGlob } from "./file-discovery.js";

const DEFAULT_SCHEMA = { type: "object", properties: {} };

export const routerExtractor: Extractor = {
  name: "router",
  sourceType: "router",

  async extract(ctx: ExtractionContext): Promise<ExtractionResult> {
    const diagnostics: DiagnosticEntry[] = [];

    const includePatterns = [
      ...ctx.config.paths.include,
      ...ctx.config.extractors.router.include,
    ];
    const excludePatterns = [
      ...ctx.config.paths.exclude,
      ...ctx.config.extractors.router.exclude,
    ];

    const discoveredFiles = discoverProjectTsFiles(ctx.projectPath);
    const routeFiles = filterFilesByGlob(
      discoveredFiles,
      ctx.projectPath,
      includePatterns,
      excludePatterns,
    );

    if (routeFiles.length === 0) {
      diagnostics.push({
        level: "info",
        stage: EXTRACTION_STAGE,
        sourceType: "router",
        message: `No router files matched include/exclude patterns in ${ctx.projectPath}`,
      });
      return { extractor: "router", capabilities: [], diagnostics };
    }

    const project = new Project({
      compilerOptions: { allowJs: true, noEmit: true },
      skipAddingFilesFromTsConfig: true,
    });
    for (const file of routeFiles) {
      project.addSourceFileAtPath(file);
    }

    const capabilities: RawCapability[] = [];
    let filesWithRoutes = 0;

    for (const sourceFile of project.getSourceFiles()) {
      const fileRel = relative(ctx.projectPath, sourceFile.getFilePath());
      const count = processFile(sourceFile, fileRel, capabilities, diagnostics);
      if (count > 0) {
        filesWithRoutes += 1;
        diagnostics.push({
          level: "info",
          stage: EXTRACTION_STAGE,
          sourceType: "router",
          message: `Extracted ${count} routes from ${fileRel}`,
          filePath: fileRel,
          details: { count },
        });
      }
    }

    diagnostics.push({
      level: "info",
      stage: EXTRACTION_STAGE,
      sourceType: "router",
      message: `Scanned ${routeFiles.length} files, found ${capabilities.length} routes`,
      details: { scanned: routeFiles.length, filesWithRoutes, routes: capabilities.length },
    });

    return { extractor: "router", capabilities, diagnostics };
  },
};

function processFile(
  sourceFile: import("ts-morph").SourceFile,
  filePath: string,
  capabilities: RawCapability[],
  diagnostics: DiagnosticEntry[],
): number {
  let count = 0;
  const arrays = sourceFile
    .getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)
    .filter((arr) => {
      const parent = arr.getParent();
      if (
        parent &&
        parent.isKind(SyntaxKind.PropertyAssignment) &&
        parent.getNameNode()?.getText() === "children"
      ) {
        return false;
      }
      return true;
    });

  for (const arr of arrays) {
    const produced = extractRoutesFromArray(arr, undefined, filePath, capabilities, diagnostics);
    count += produced;
  }

  return count;
}

function extractRoutesFromArray(
  arr: ArrayLiteralExpression,
  parentPath: string | undefined,
  filePath: string,
  capabilities: RawCapability[],
  diagnostics: DiagnosticEntry[],
): number {
  let count = 0;
  for (const element of arr.getElements()) {
    if (!element.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
    count += extractRouteFromObject(element, parentPath, filePath, capabilities, diagnostics);
  }
  return count;
}

function extractRouteFromObject(
  obj: ObjectLiteralExpression,
  parentPath: string | undefined,
  filePath: string,
  capabilities: RawCapability[],
  diagnostics: DiagnosticEntry[],
): number {
  const pathValue = getStringProperty(obj, "path");
  if (!pathValue) {
    return 0;
  }

  const fullPath = normalizeRoutePath(parentPath, pathValue);
  const slug = pathToSlug(fullPath);
  const params = extractPathParams(fullPath);
  const inputSchema = buildInputSchema(params);
  const element = getElementName(obj);

  const capability: RawCapability = {
    id: `navigate.to.${slug}`,
    kind: "navigation",
    title: `Navigate to ${fullPath}`,
    description: `Navigate to route ${fullPath}`,
    source: {
      type: "router",
      filePath,
      location: fullPath,
    },
    inputSchema,
    effects: ["navigation"],
    tags: ["router", "navigation"],
    metadata: {
      path: fullPath,
      element,
    },
  };

  capabilities.push(capability);
  let count = 1;

  const children = getArrayProperty(obj, "children");
  if (children) {
    count += extractRoutesFromArray(children, fullPath, filePath, capabilities, diagnostics);
  } else {
    const rawChildren = obj.getProperty("children");
    if (rawChildren && !children) {
      diagnostics.push({
        level: "warning",
        stage: EXTRACTION_STAGE,
        sourceType: "router",
        message: "Route 'children' must be an array of objects",
        filePath,
      });
    }
  }

  return count;
}

function getStringProperty(obj: ObjectLiteralExpression, name: string): string | undefined {
  const prop = obj.getProperty(name);
  if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return undefined;
  const init = prop.getInitializer();
  if (!init) return undefined;
  if (init.isKind(SyntaxKind.StringLiteral) || init.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
    return init.getLiteralValue();
  }
  return undefined;
}

function getArrayProperty(obj: ObjectLiteralExpression, name: string): ArrayLiteralExpression | undefined {
  const prop = obj.getProperty(name);
  if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return undefined;
  const init = prop.getInitializer();
  if (!init || !init.isKind(SyntaxKind.ArrayLiteralExpression)) return undefined;
  return init;
}

function getElementName(obj: ObjectLiteralExpression): string | undefined {
  const prop = obj.getProperty("element");
  if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return undefined;
  const init = prop.getInitializer();
  if (!init) return undefined;
  if (init.isKind(SyntaxKind.JsxElement)) {
    return init.getOpeningElement().getTagNameNode().getText();
  }
  if (init.isKind(SyntaxKind.JsxSelfClosingElement)) {
    return init.getTagNameNode().getText();
  }
  return init.getText();
}

function normalizeRoutePath(parentPath: string | undefined, childPath: string): string {
  if (!parentPath) {
    return childPath.startsWith("/") ? cleanPath(childPath) : cleanPath(`/${childPath}`);
  }
  if (childPath.startsWith("/")) {
    return cleanPath(childPath);
  }
  const base = parentPath.endsWith("/") ? parentPath : `${parentPath}/`;
  return cleanPath(`${base}${childPath}`);
}

function cleanPath(path: string): string {
  const cleaned = path.replace(/\/+/g, "/");
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

function pathToSlug(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "root";
  return segments
    .map((seg) => slugToken(seg))
    .filter(Boolean)
    .join(".")
    .toLowerCase();
}

function slugToken(segment: string): string {
  const cleaned = segment
    .replace(/^:/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned;
}

function extractPathParams(path: string): string[] {
  const matches = path.match(/:([A-Za-z0-9_]+)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1));
}

function buildInputSchema(params: string[]) {
  if (params.length === 0) return DEFAULT_SCHEMA;
  const properties: Record<string, unknown> = {};
  for (const name of params) {
    properties[name] = {
      type: "string",
      description: `Route parameter "${name}"`,
    };
  }
  return {
    type: "object",
    properties,
    required: params,
  };
}
