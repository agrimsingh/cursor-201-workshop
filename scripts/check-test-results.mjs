#!/usr/bin/env node
// Checks Vitest + Playwright JSON results against what each workshop step should look like.
//
//   node scripts/check-test-results.mjs --step N --vitest vitest.json --playwright e2e.json
//
// Expectations:
//   - Tests named "[filter-bug] ..." exist in both suites. They fail on steps 0-2 and pass from step 3.
//   - Tests named "[resolve-dispute] ..." do not exist before step 5, and exist and pass from step 5.
//   - Every other test passes.
import { existsSync, readFileSync } from "node:fs";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const step = Number(arg("step"));
const vitestFile = arg("vitest");
const playwrightFile = arg("playwright");
if (Number.isNaN(step) || !vitestFile || !playwrightFile) {
  console.error("usage: check-test-results.mjs --step N --vitest <file> --playwright <file>");
  process.exit(2);
}

const problems = [];
const tests = [];

if (!existsSync(vitestFile)) problems.push(`Vitest results not found at ${vitestFile}`);
else {
  const report = JSON.parse(readFileSync(vitestFile, "utf8"));
  for (const file of report.testResults ?? []) {
    for (const result of file.assertionResults ?? []) {
      tests.push({ suite: "vitest", name: result.fullName ?? result.title, passed: result.status === "passed", status: result.status });
    }
    if ((file.assertionResults ?? []).length === 0 && file.status === "failed") {
      problems.push(`Vitest file failed to load: ${file.name}: ${String(file.message).slice(0, 200)}`);
    }
  }
}

if (!existsSync(playwrightFile)) problems.push(`Playwright results not found at ${playwrightFile}`);
else {
  const report = JSON.parse(readFileSync(playwrightFile, "utf8"));
  const walk = (suite, prefix) => {
    for (const spec of suite.specs ?? []) {
      const statuses = (spec.tests ?? []).map((test) => test.status);
      tests.push({
        suite: "playwright",
        name: [...prefix, spec.title].join(" › "),
        passed: statuses.length > 0 && statuses.every((status) => status === "expected"),
        status: statuses.join(",") || "missing",
      });
    }
    for (const child of suite.suites ?? []) walk(child, child.title && !child.title.endsWith(".ts") ? [...prefix, child.title] : prefix);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  for (const error of report.errors ?? []) problems.push(`Playwright error: ${String(error.message).split("\n")[0]}`);
}

const tagged = (tag) => tests.filter((test) => test.name.includes(tag));
const filterBug = tagged("[filter-bug]");
const resolveDispute = tagged("[resolve-dispute]");
const others = tests.filter((test) => !test.name.includes("[filter-bug]") && !test.name.includes("[resolve-dispute]"));

for (const suite of ["vitest", "playwright"]) {
  if (!filterBug.some((test) => test.suite === suite)) problems.push(`no [filter-bug] test found in ${suite}`);
}
if (step < 3) {
  for (const test of filterBug.filter((t) => t.passed)) problems.push(`[filter-bug] should still fail on step ${step}: ${test.name}`);
} else {
  for (const test of filterBug.filter((t) => !t.passed)) problems.push(`[filter-bug] should pass from step 3: ${test.name}`);
}

if (step < 5) {
  for (const test of resolveDispute) problems.push(`[resolve-dispute] tests should not exist before step 5: ${test.name}`);
} else {
  for (const suite of ["vitest", "playwright"]) {
    if (!resolveDispute.some((test) => test.suite === suite)) problems.push(`no [resolve-dispute] test found in ${suite}`);
  }
  for (const test of resolveDispute.filter((t) => !t.passed)) problems.push(`[resolve-dispute] failing: ${test.name}`);
}

for (const test of others.filter((t) => !t.passed && t.status !== "skipped")) problems.push(`unexpected failure (${test.suite}): ${test.name}`);

const count = (list, suite) => list.filter((t) => t.suite === suite).length;
const passedCount = (list, suite) => list.filter((t) => t.suite === suite && t.passed).length;
console.log(
  [
    `step ${step}:`,
    `vitest ${passedCount(tests, "vitest")}/${count(tests, "vitest")} passed,`,
    `playwright ${passedCount(tests, "playwright")}/${count(tests, "playwright")} passed,`,
    `[filter-bug] ${filterBug.filter((t) => t.passed).length}/${filterBug.length} passing (expected ${step < 3 ? "0" : "all"}),`,
    `[resolve-dispute] ${resolveDispute.filter((t) => t.passed).length}/${resolveDispute.length} passing (expected ${step < 5 ? "none present" : "all"})`,
  ].join(" "),
);
for (const problem of problems) console.log(`  ✗ ${problem}`);
if (!problems.length) console.log("  ✓ test results match the expected state for this step");
process.exit(problems.length ? 1 : 0);
