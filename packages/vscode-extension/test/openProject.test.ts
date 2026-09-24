import { describe, expect, it } from "vitest";
import { openProjectFolder, type OpenProjectDeps } from "../src/openProject";

function makeDeps(existing: string[]) {
  const opened: string[] = [];
  const warnings: string[] = [];
  const deps: OpenProjectDeps = {
    exists: (path) => existing.includes(path),
    openFolder: async (path) => {
      opened.push(path);
    },
    warn: (message) => warnings.push(message),
  };
  return { deps, opened, warnings };
}

describe("openProjectFolder", () => {
  it("opens the folder when it exists on disk", async () => {
    const { deps, opened, warnings } = makeDeps(["/tmp/project-a"]);
    await openProjectFolder("/tmp/project-a", deps);
    expect(opened).toEqual(["/tmp/project-a"]);
    expect(warnings).toEqual([]);
  });

  it("warns instead of opening when the folder no longer exists", async () => {
    const { deps, opened, warnings } = makeDeps([]);
    await openProjectFolder("/tmp/gone", deps);
    expect(opened).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("/tmp/gone");
  });

  it("ignores an empty or non-string path without touching disk or showing anything", async () => {
    const { deps, opened, warnings } = makeDeps(["/tmp/project-a"]);
    await openProjectFolder("", deps);
    await openProjectFolder(undefined, deps);
    await openProjectFolder(42, deps);
    expect(opened).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
