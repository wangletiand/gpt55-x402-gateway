import { spawn } from "node:child_process";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
let serverProcess;

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
      lastError = new Error(`health status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error("server did not become healthy");
}

async function ensureServer() {
  if (process.env.SMOKE_BASE_URL) return;
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (response.ok) return;
  } catch {
    // Start a temporary local server below.
  }
  serverProcess = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL(".", import.meta.url),
    env: { ...process.env, HOST: "127.0.0.1", PORT: "3000" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
  serverProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitForHealth();
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
}

process.on("exit", stopServer);
process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopServer();
  process.exit(143);
});

async function assertOk(name, fn) {
  try {
    await fn();
    console.log(`${name}=ok`);
  } catch (error) {
    console.error(`${name}=failed`);
    console.error(error);
    process.exitCode = 1;
  }
}

await ensureServer();

await assertOk("health", async () => {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) throw new Error(`health status ${response.status}`);
  const payload = await response.json();
  if (payload.status !== "ok") throw new Error("health payload mismatch");
});

await assertOk("server_json", async () => {
  const response = await fetch(`${baseUrl}/server.json`);
  if (!response.ok) throw new Error(`server.json status ${response.status}`);
  const payload = await response.json();
  if (payload.name !== "gpt55-model-gateway") throw new Error("server.json name mismatch");
});

await assertOk("buyer_guide", async () => {
  const response = await fetch(`${baseUrl}/buyer-guide.json`);
  if (!response.ok) throw new Error(`buyer-guide status ${response.status}`);
  const payload = await response.json();
  if (payload?.payment?.schemes && Array.isArray(payload.payment.schemes) && payload.payment.schemes.includes("upto")) {
    throw new Error("buyer guide still advertises upto on the public production gateway");
  }
  const exactOnly = payload?.payment?.schemes;
  if (!Array.isArray(exactOnly) || !exactOnly.includes("exact")) throw new Error("buyer guide missing exact payment scheme");
});

await assertOk("mcp_initialize", async () => {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "local-smoke", version: "1.0.0" },
      },
    }),
  });
  if (!response.ok) throw new Error(`initialize status ${response.status}`);
  const payload = await response.json();
  if (payload.jsonrpc !== "2.0" || !payload.result) throw new Error("initialize payload mismatch");
});

await assertOk("mcp_tools_list", async () => {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
  });
  if (!response.ok) throw new Error(`tools/list status ${response.status}`);
  const payload = await response.json();
  const tools = payload.result?.tools;
  if (!Array.isArray(tools) || tools.length !== 1) {
    throw new Error(`tools/list must expose exactly one local tool, received ${tools?.length ?? "none"}`);
  }
  if (tools[0]?.name !== "gpt55_gateway_directory") {
    throw new Error(`unexpected public tool: ${tools[0]?.name || "missing"}`);
  }
});

await assertOk("mcp_rejects_arbitrary_tool", async () => {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "chat_completion", arguments: {} },
    }),
  });
  if (!response.ok) throw new Error(`arbitrary tools/call status ${response.status}`);
  const payload = await response.json();
  if (payload.error?.code !== -32602 || !String(payload.error?.message || "").includes("Unknown local tool")) {
    throw new Error("arbitrary tools/call was not rejected by the local allowlist");
  }
});

await assertOk("mcp_rejects_oversized_body", async () => {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "gpt55_gateway_directory", arguments: { padding: "x".repeat(70_000) } },
    }),
  });
  if (response.status !== 413) throw new Error(`oversized body status ${response.status}, expected 413`);
});

stopServer();
