import { catalog, type HealthResult } from "./catalog.js";
import { assertProductionSafety, loadServerEnv } from "./env.js";

/**
 * Walks the catalogue, runs every health check, and reports what is reachable.
 *
 * v1 had no equivalent: a misconfigured environment surfaced as a runtime error
 * in a screen, hours later, with no indication which dependency was at fault.
 */

const ICON: Record<HealthResult["status"], string> = {
  ok: "PASS",
  fail: "FAIL",
  skip: "SKIP",
};

const COLOR: Record<HealthResult["status"], string> = {
  ok: "\u001b[32m",
  fail: "\u001b[31m",
  skip: "\u001b[33m",
};
const RESET = "\u001b[0m";
const DIM = "\u001b[2m";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (status: HealthResult["status"], text: string) =>
  useColor ? `${COLOR[status]}${text}${RESET}` : text;
const dim = (text: string) => (useColor ? `${DIM}${text}${RESET}` : text);

async function main(): Promise<void> {
  const env = loadServerEnv();

  console.log("");
  console.log("  LunchMeet doctor");
  console.log(dim(`  environment: ${env.NODE_ENV}`));
  console.log("");

  let failures = 0;
  let criticalFailures = 0;

  for (const entry of catalog) {
    const result: HealthResult = entry.check
      ? await entry.check(env).catch((error: unknown) => ({
          status: "fail" as const,
          detail: error instanceof Error ? error.message : String(error),
        }))
      : { status: "skip", detail: "No health check defined." };

    if (result.status === "fail") {
      failures += 1;
      if (entry.critical) criticalFailures += 1;
    }

    const label = entry.critical ? entry.title : `${entry.title} ${dim("(optional)")}`;
    console.log(`  [${paint(result.status, ICON[result.status])}] ${label}`);
    console.log(dim(`         ${result.detail}`));
  }

  const productionProblems = assertProductionSafety(env);
  if (productionProblems.length > 0) {
    console.log("");
    console.log(paint("fail", "  Production safety:"));
    for (const problem of productionProblems) {
      console.log(`    - ${problem}`);
    }
    criticalFailures += productionProblems.length;
  }

  console.log("");
  if (criticalFailures > 0) {
    console.log(paint("fail", `  ${criticalFailures} critical problem(s). The API will not work.`));
    process.exit(1);
  }
  if (failures > 0) {
    console.log(paint("skip", `  ${failures} non-critical problem(s). Some features degraded.`));
    process.exit(0);
  }
  console.log(paint("ok", "  All dependencies healthy."));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
