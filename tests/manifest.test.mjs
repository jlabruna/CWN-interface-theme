import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await fs.readFile(new URL("../module.json", import.meta.url), "utf8"),
);

test("manifest targets Foundry V14 and SWNR 2.3.1", () => {
  assert.equal(manifest.version, "0.5.2");
  assert.equal(manifest.compatibility.verified, "14.365");
  assert.equal(manifest.compatibility.maximum, undefined);
  const swnr = manifest.relationships.systems.find((entry) => entry.id === "swnr");
  assert.equal(swnr.compatibility.minimum, "2.3.1");
  assert.equal(swnr.compatibility.verified, "2.3.1");
  assert.deepEqual(manifest.esmodules, ["scripts/cwn-interface-theme-v052.mjs"]);
  assert.deepEqual(manifest.styles, ["styles/cwn-interface-theme-v052.css"]);
});

test("download URL matches the manifest version", () => {
  assert.ok(
    manifest.download.endsWith(
      `/v${manifest.version}/cwn-interface-theme-v${manifest.version}.zip`,
    ),
  );
});
