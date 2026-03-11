// ---------------------------------------------------------------------------
// Extractor registry: register and look up extractors by name
// ---------------------------------------------------------------------------

import type { Extractor } from "./types.js";

export class ExtractorRegistry {
  private readonly extractors = new Map<string, Extractor>();

  /** Register an extractor. Throws if name already taken. */
  register(extractor: Extractor): void {
    if (this.extractors.has(extractor.name)) {
      throw new Error(`Extractor "${extractor.name}" is already registered.`);
    }
    this.extractors.set(extractor.name, extractor);
  }

  /** Get an extractor by name, or undefined. */
  get(name: string): Extractor | undefined {
    return this.extractors.get(name);
  }

  /** Return all registered extractors. */
  getAll(): Extractor[] {
    return [...this.extractors.values()];
  }

  /** List registered extractor names. */
  names(): string[] {
    return [...this.extractors.keys()];
  }
}

/** Shared default registry. */
export const defaultRegistry = new ExtractorRegistry();
