import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allEnvVars } from "./catalog.js";

/**
 * Verifies ops/PRODUCTION_SECRETS.md still describes every variable the code
 * actually reads.
 *
 * Documentation that drifts from the code is worse than none, because it is
 * trusted. This runs in CI so the manifest cannot rot the way v1's setup docs
 * did (they still described a `write-config.js` that had been deleted).
 *
 * The check is one-way by design: the manifest legitimately documents release
 * and CI credentials such as EXPO_TOKEN that the API runtime never reads.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const docPath = path.join(repoRoot, "ops", "PRODUCTION_SECRETS.md");

function main(): void {
  const doc = readFileSync(docPath, "utf8");

  const documented = new Set(
    [...doc.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)].map((match) => match[1]!)
  );

  const missing = allEnvVars()
    .filter((spec) => !documented.has(spec.name))
    .map((spec) => `${spec.name} (${spec.entryTitle})`);

  const unique = [...new Set(missing)].sort();

  if (unique.length > 0) {
    console.error("");
    console.error("  ops/PRODUCTION_SECRETS.md is out of date.");
    console.error("");
    console.error("  These variables are declared in packages/config/src/catalog.ts");
    console.error("  but are not documented in the manifest:");
    console.error("");
    for (const name of unique) {
      console.error(`    - ${name}`);
    }
    console.error("");
    console.error("  Add them to the manifest, or remove them from the catalogue.");
    console.error("");
    process.exit(1);
  }

  console.log(
    `ops/PRODUCTION_SECRETS.md documents all ${allEnvVars().length} catalogued variables.`
  );
}

main();
