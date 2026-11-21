import { cp, mkdir } from "node:fs/promises";

const project = new URL("../", import.meta.url);
const output = new URL("dist/", project);
await mkdir(output, { recursive: true });

// Keep the existing relative URLs, including images selected by forest.js at runtime.
for (const path of ["index.html", "forest.css", "save-sync.js", "forest.js", "today-notes.js", "experiment-dog.js", "account.js", "ranch.html", "ranch.css", "ranch.js", "assets/"]) {
  await cp(new URL(path, project), new URL(path, output), { recursive: true });
}
