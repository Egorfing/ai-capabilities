export type InitStatus = "created" | "skipped";

export interface InitFileReport {
  path: string;
  status: InitStatus;
  reason?: string;
}

export interface InitProjectOptions {
  cwd?: string;
}

export interface InitProjectResult {
  projectName: string;
  sourceRoot: string;
  config: InitFileReport;
  scaffold: InitFileReport[];
  nextSteps: string[];
}

export interface ConfigTemplateOptions {
  projectName: string;
}

export interface RegistryTemplateOptions {
  importPath: string;
}
