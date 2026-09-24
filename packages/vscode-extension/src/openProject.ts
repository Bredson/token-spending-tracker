export interface OpenProjectDeps {
  exists: (path: string) => boolean;
  openFolder: (path: string) => Promise<void>;
  warn: (message: string) => void;
}

/** `projectPath` pochodzi z webview (a pierwotnie z logów), więc traktowany jako niezaufany. */
export async function openProjectFolder(projectPath: unknown, deps: OpenProjectDeps): Promise<void> {
  if (typeof projectPath !== "string" || projectPath.length === 0) {
    return;
  }
  if (!deps.exists(projectPath)) {
    deps.warn(`Token Tracker: katalog projektu już nie istnieje: ${projectPath}`);
    return;
  }
  await deps.openFolder(projectPath);
}
