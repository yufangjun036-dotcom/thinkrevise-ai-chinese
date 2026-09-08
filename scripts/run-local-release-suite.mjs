import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 3013;
const baseUrl = `http://127.0.0.1:${port}`;
const testEnvironment = {
  ...process.env,
  THINKREVISE_DEMO_MODE: "1",
  AI_RATE_LIMIT_PER_MINUTE: "500",
  AI_RATE_LIMIT_PER_DAY: "1000",
  AI_GLOBAL_DAILY_REQUEST_LIMIT: "2000",
  AI_CONCURRENT_PER_VISITOR: "3",
  AI_GLOBAL_CONCURRENT_LIMIT: "10",
};

function run(command, args, environment = testEnvironment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: environment, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed (${code ?? signal})`));
    });
  });
}

async function waitUntilReady() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("The isolated release-test server did not become ready.");
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: testEnvironment,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  await waitUntilReady();
  const home = await fetch(baseUrl);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("x-powered-by"), null);

  await run(process.execPath, ["scripts/check-api.mjs"], { ...testEnvironment, PROTOTYPE_URL: baseUrl });
  await run(process.execPath, ["scripts/check-boundary-recovery.mjs"], { ...testEnvironment, THINKREVISE_BASE_URL: baseUrl });
  await run(process.execPath, ["--experimental-strip-types", "scripts/check-demo-validation.mjs"]);
  console.log(`Isolated API, recovery and demo checks passed at ${baseUrl}. No paid API request was made.`);
} finally {
  if (server.exitCode === null) server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else {
      server.once("exit", resolve);
      setTimeout(resolve, 2_000);
    }
  });
}
