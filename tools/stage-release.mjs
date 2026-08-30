import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = path.join(moduleRoot, "release");
const stageRoot = path.join(releaseRoot, "cwn-interface-theme");
const browserUploadRoot = path.join(releaseRoot, "github-upload-v0.11.2");
const browserDotfilesRoot = path.join(releaseRoot, "github-dotfiles-upload-v0.11.2");
const browserWorkflowRoot = path.join(releaseRoot, "github-workflow-v0.11.2");
const manifest = JSON.parse(await fs.readFile(path.join(moduleRoot, "module.json"), "utf8"));

if (manifest.version !== "0.11.2") {
  throw new Error(`Expected module version 0.11.2 but found ${manifest.version}.`);
}
if (!manifest.download.endsWith(`/v${manifest.version}/cwn-interface-theme-v${manifest.version}.zip`)) {
  throw new Error(`Unexpected module download URL "${manifest.download}".`);
}

const removeTree = (target) => fs.rm(target, {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 250,
});

await removeTree(stageRoot);
await fs.mkdir(stageRoot, { recursive: true });
for (const directory of ["assets", "lang", "scripts", "styles", "templates"]) {
  await fs.cp(path.join(moduleRoot, directory), path.join(stageRoot, directory), { recursive: true });
}
for (const filename of ["CHANGELOG.md", "LICENSE", "README.md", "module.json"]) {
  await fs.copyFile(path.join(moduleRoot, filename), path.join(stageRoot, filename));
}
for (const script of manifest.esmodules ?? []) await fs.access(path.join(stageRoot, script));
for (const stylesheet of manifest.styles ?? []) await fs.access(path.join(stageRoot, stylesheet));
await fs.copyFile(path.join(stageRoot, "module.json"), path.join(releaseRoot, "module.json"));

await removeTree(browserUploadRoot);
await fs.mkdir(browserUploadRoot, { recursive: true });
const browserReleaseFiles = [
  "CHANGELOG.md",
  "README.md",
  "module.json",
  "package.json",
  "lang/en.json",
  "scripts/cwn-interface-theme-v0112.mjs",
  "scripts/cwn-interface-theme-v0101.mjs",
  "scripts/sheet-refresh.mjs",
  "scripts/sheets/cwn-sheet-shared-v062.mjs",
  "scripts/sheets/drone-pilot-link.mjs",
  "scripts/sheets/cwn-npc-sheet-v062.mjs",
  "scripts/sheets/cwn-character-sheet-v091.mjs",
  "scripts/sheets/cwn-drone-sheet-v0100.mjs",
  "scripts/sheets/cwn-cyberdeck-sheet-v0101.mjs",
  "styles/cwn-interface-theme-v0101.css",
  "templates/sheets/character/cyberware-v062.hbs",
  "templates/sheets/npc/cyberware.hbs",
  "templates/sheets/drone/operations-v092.hbs",
  "templates/sheets/drone/configuration-v070.hbs",
  "templates/sheets/cyberdeck/operations-v0100.hbs",
  "templates/sheets/cyberdeck/configuration-v0101.hbs",
  "tests/character-sheet.test.mjs",
  "tests/cyberdeck-sheet.test.mjs",
  "tests/drone-sheet.test.mjs",
  "tests/drone-pilot-link.test.mjs",
  "tests/npc-sheet.test.mjs",
  "tests/manifest.test.mjs",
  "tests/sheet-refresh.test.mjs",
  "tools/stage-release.mjs",
];
for (const filename of browserReleaseFiles) {
  const destination = path.join(browserUploadRoot, filename);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(moduleRoot, filename), destination);
}

await removeTree(browserDotfilesRoot);
await fs.mkdir(path.join(browserDotfilesRoot, ".github", "workflows"), { recursive: true });
await fs.copyFile(
  path.join(moduleRoot, ".github", "workflows", "build-release.yml"),
  path.join(browserDotfilesRoot, ".github", "workflows", "build-release.yml"),
);
await removeTree(browserWorkflowRoot);
await fs.mkdir(browserWorkflowRoot, { recursive: true });
await fs.copyFile(
  path.join(moduleRoot, ".github", "workflows", "build-release.yml"),
  path.join(browserWorkflowRoot, "build-release.yml"),
);
// .gitignore is useful in a local checkout, but browser uploads can omit hidden
// files. Do not make release staging depend on this developer-only file.
try {
  await fs.copyFile(path.join(moduleRoot, ".gitignore"), path.join(browserDotfilesRoot, ".gitignore"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log(
  `Staged CWN Interface Theme ${manifest.version} at ${stageRoot}. `
  + `Browser upload files are at ${browserUploadRoot}; hidden paths are at ${browserDotfilesRoot}; `
  + `visible workflow upload is at ${browserWorkflowRoot}.`,
);
