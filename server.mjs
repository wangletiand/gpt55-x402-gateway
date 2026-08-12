import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_SERVICE_ORIGIN = "https://gpt55.558686.xyz";
const CANONICAL_SERVICE_HUB = `${PUBLIC_SERVICE_ORIGIN}/x402/service`;
const PUBLIC_REPOSITORY = Object.freeze({
  url: "https://github.com/wangletiand/gpt55-x402-gateway.git",
  webUrl: "https://github.com/wangletiand/gpt55-x402-gateway",
});
const KEY_PACK_DELIVERY_TRIAL = Object.freeze({
  routeId: "api-codex-key-pack-1",
  label: "Start the $0.12 delivery trial",
  method: "GET",
  price: "$0.12",
  amountAtomic: "120000",
  quotaUsd: 1,
  paidUrl: "https://x402-key.558686.xyz/v1/paid/api-codex-key-pack-1",
  quoteUrl: "https://x402-key.558686.xyz/x402/quote/api-codex-key-pack-1",
  paymentActivation: "https://x402-key.558686.xyz/x402/route/api-codex-key-pack-1/payment-activation.json",
  firstPaymentClient: "https://x402-key.558686.xyz/x402/route/api-codex-key-pack-1/first-payment-client.mjs",
  purpose: "Validate a buyer-owned Base USDC payment and one-time API key delivery before the commercial purchase.",
  commercialPackRouteId: "api-codex-key-pack-100",
  commercialPackPrice: "$11.1112",
  commercialUpgrade: Object.freeze({
    routeId: "api-codex-key-pack-100",
    price: "$11.1112",
    amountAtomic: "11111200",
    quotaUsd: 100,
    paidUrl: "https://x402-key.558686.xyz/v1/paid/api-codex-key-pack-100",
    quoteUrl: "https://x402-key.558686.xyz/x402/quote/api-codex-key-pack-100",
    paymentActivation: "https://x402-key.558686.xyz/x402/route/api-codex-key-pack-100/payment-activation.json",
    firstPaymentClient: "https://x402-key.558686.xyz/x402/route/api-codex-key-pack-100/first-payment-client.mjs",
    previousPurchaseAppliedToUpgrade: false,
  }),
  trialPaymentCreditsCommercialPack: false,
  nonCreditPolicy: "The $0.12 trial does not reduce the commercial pack price.",
});
const KEY_PACK_UPGRADE_OFFER = Object.freeze({
  routeId: "api-codex-key-pack-100",
  method: "GET",
  paidUrl: "https://x402-key.558686.xyz/v1/paid/api-codex-key-pack-100",
  checkoutUrl: "https://x402-key.558686.xyz/x402/checkout",
  price: "$11.1112",
  amountAtomic: "11111200",
  quotaUsd: 100,
  deliveryTrial: KEY_PACK_DELIVERY_TRIAL,
});
const STANDARD_CHAT_ALTERNATIVE = Object.freeze({
  id: "standard-chat-demand-first",
  routeId: "standard-chat",
  title: "GPT-5.6 Luna Standard one-request result",
  method: "POST",
  paidUrl: `${PUBLIC_SERVICE_ORIGIN}/v1/chat/completions/standard`,
  checkoutUrl: `${CANONICAL_SERVICE_HUB}?checkout=standard-chat`,
  price: "$0.00293",
  amountAtomic: "2930",
  browserCheckout: Object.freeze({
    available: true,
    url: `${CANONICAL_SERVICE_HUB}?checkout=standard-chat`,
    bundleUrl: `${PUBLIC_SERVICE_ORIGIN}/x402/browser-wallet-payment.js`,
    privateKeySentToService: false,
  }),
  agentFallback: Object.freeze({
    routeId: "standard",
    firstPaymentClient: `${PUBLIC_SERVICE_ORIGIN}/x402/first-payment-client.mjs`,
    quoteOnlyCommand: "ROUTE_ID=standard MAX_USDC=0.00293 node first-payment-client.mjs",
    privateKeySentToService: false,
  }),
  nextPurchase: KEY_PACK_UPGRADE_OFFER,
});
const PRIMARY_COMMERCIAL_OFFER = Object.freeze({
  id: "evm-wallet-balance-demand-first",
  routeId: "evm-wallet-balance",
  title: "EVM Wallet Balance Snapshot",
  method: "GET",
  paidUrl: `${PUBLIC_SERVICE_ORIGIN}/v1/tools/evm-wallet-balance`,
  quoteOnlyUrl: `${PUBLIC_SERVICE_ORIGIN}/v1/tools/evm-wallet-balance?address=0x1111111111111111111111111111111111111111&network=base`,
  checkoutUrl: `${CANONICAL_SERVICE_HUB}?checkout=evm-wallet-balance`,
  price: "$0.001",
  amountAtomic: "1000",
  browserCheckout: Object.freeze({
    available: true,
    url: `${CANONICAL_SERVICE_HUB}?checkout=evm-wallet-balance`,
    bundleUrl: `${PUBLIC_SERVICE_ORIGIN}/x402/browser-wallet-payment.js`,
    privateKeySentToService: false,
  }),
  agentFallback: Object.freeze({
    routeId: "evm-wallet-balance",
    firstPaymentClient: `${PUBLIC_SERVICE_ORIGIN}/x402/first-payment-client.mjs`,
    quoteOnlyCommand: "ROUTE_ID=evm-wallet-balance EVM_ADDRESS=0x1111111111111111111111111111111111111111 EVM_NETWORK=base MAX_USDC=0.001 node first-payment-client.mjs",
    privateKeySentToService: false,
  }),
  standardChatAlternative: STANDARD_CHAT_ALTERNATIVE,
  nextPurchase: KEY_PACK_UPGRADE_OFFER,
});
const REMOTE_BASE_URL = process.env.REMOTE_BASE_URL || "https://gpt55.558686.xyz";
const CANONICAL_MCP_URL = `${REMOTE_BASE_URL}/mcp`;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const MAX_REMOTE_JSON_BYTES = 512 * 1024;
const REMOTE_FETCH_TIMEOUT_MS = 5_000;

class PayloadTooLargeError extends Error {}

function jsonResponse(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function textResponse(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

async function remoteJson(path, fallback) {
  try {
    const response = await fetch(`${REMOTE_BASE_URL}${path}`, {
      headers: { accept: "application/json", "user-agent": "gpt55-x402-gateway-glama-wrapper/1.0" },
      signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS),
    });
    if (response.ok) return JSON.parse(await readResponseBody(response, MAX_REMOTE_JSON_BYTES));
  } catch {
    // Directory crawlers should still get usable public discovery metadata if
    // the remote gateway is briefly unavailable from the wrapper environment.
  }
  return fallback;
}

async function readResponseBody(response, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > maxBytes) throw new PayloadTooLargeError("Remote JSON response exceeded the allowed size.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function readBody(req) {
  const contentLength = req.headers["content-length"];
  if (contentLength !== undefined) {
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared) || declared < 0) {
      return Promise.reject(new Error("Invalid Content-Length header."));
    }
    if (declared > MAX_REQUEST_BODY_BYTES) {
      req.resume();
      return Promise.reject(new PayloadTooLargeError("Request body exceeded 64 KiB."));
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let rejected = false;
    req.on("data", (chunk) => {
      if (rejected) return;
      total += chunk.byteLength;
      if (total > MAX_REQUEST_BODY_BYTES) {
        rejected = true;
        chunks.length = 0;
        reject(new PayloadTooLargeError("Request body exceeded 64 KiB."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (error) => {
      if (!rejected) reject(error);
    });
  });
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function localInitialize(id) {
  return rpcResult(id, {
    protocolVersion: "2025-06-18",
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: "gpt55-x402-gateway",
      title: "GPT55 GPT-5.6 Luna Standard x402 Gateway",
      version: "1.0.0",
    },
    instructions:
      "This container is a local read-only directory for the public GPT55 x402 gateway. It exposes one metadata tool and never proxies tool execution or payment requests.",
  });
}

function localToolsList(id) {
  return rpcResult(id, {
    tools: [
      {
        name: "gpt55_gateway_directory",
        title: "GPT55 GPT-5.6 Luna Standard x402 Directory",
        description:
          "Returns public endpoint, pricing, x402 discovery, and buyer-guide links for the GPT-5.6 Luna Standard x402 gateway.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
  });
}

function localToolCall(id, params = {}) {
  const name = params.name;
  if (name !== "gpt55_gateway_directory") {
    return rpcError(id, -32602, `Unknown local tool: ${name || ""}`);
  }
  return rpcResult(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            service: REMOTE_BASE_URL,
            mcp: CANONICAL_MCP_URL,
            serverJson: `${REMOTE_BASE_URL}/server.json`,
            x402: `${REMOTE_BASE_URL}/.well-known/x402`,
            pricing: `${REMOTE_BASE_URL}/pricing.json`,
            buyerGuide: `${REMOTE_BASE_URL}/buyer-guide.json`,
            payment: "Base USDC x402; no private keys or wallet signing are handled by this container.",
          },
          null,
          2,
        ),
      },
    ],
  });
}

function localBuyerGuide() {
  return {
    schemaVersion: "2026-08-06",
    title: "GPT55 GPT-5.6 Luna Standard x402 Buyer Guide",
    repository: { ...PUBLIC_REPOSITORY },
    canonicalUrl: CANONICAL_SERVICE_HUB,
    startUrl: CANONICAL_SERVICE_HUB,
    applyUrl: CANONICAL_SERVICE_HUB,
    buyUrl: CANONICAL_SERVICE_HUB,
    startApplyBuyUrl: CANONICAL_SERVICE_HUB,
    service: {
      name: "GPT55 GPT-5.6 Luna Standard x402 API Gateway",
      baseUrl: PUBLIC_SERVICE_ORIGIN,
      openaiCompatible: true,
      accountRequired: false,
      subscriptionRequired: false,
    },
    payment: {
      protocol: "x402",
      network: "eip155:8453",
      asset: { symbol: "USDC", chain: "Base", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      payTo: "0x1f0130669ca6fd02e025a984cc038f139df19a2f",
      schemes: ["exact"],
      exact: { description: "Pay the fixed quoted amount for the selected endpoint." },
      upto: { enabled: false, description: "Disabled on the public production gateway; live 402 quotes advertise exact x402 only." },
    },
    primaryCommercialOffer: { ...PRIMARY_COMMERCIAL_OFFER },
    demandFirstOffer: { ...PRIMARY_COMMERCIAL_OFFER },
    firstPurchase: { ...PRIMARY_COMMERCIAL_OFFER },
    recommendedFirstPurchase: { ...PRIMARY_COMMERCIAL_OFFER },
    standardChatAlternative: { ...STANDARD_CHAT_ALTERNATIVE },
    nextPurchase: { ...KEY_PACK_UPGRADE_OFFER },
    keyPackUpgradeOffer: { ...KEY_PACK_UPGRADE_OFFER },
    quickstart: {
      lowestCostProofUrl: `${PUBLIC_SERVICE_ORIGIN}/v1/x402-ping`,
      recommendedFirstRouteId: PRIMARY_COMMERCIAL_OFFER.routeId,
      recommendedFirstPaidUrl: PRIMARY_COMMERCIAL_OFFER.paidUrl,
    spendCapUsd: 0.003,
    },
    livePrices: {
      pricing: `${PUBLIC_SERVICE_ORIGIN}/pricing.json`,
      x402Discovery: `${PUBLIC_SERVICE_ORIGIN}/.well-known/x402`,
      rule: "Fetch the target endpoint without payment and use the HTTP 402 payment-required header as the authoritative amount immediately before paying.",
    },
  };
}

function normalizeBuyerGuideForWrapper(guide) {
  const normalized = structuredClone(guide || localBuyerGuide());
  normalized.payment = normalized.payment || {};
  normalized.payment.schemes = ["exact"];
  normalized.payment.exact = normalized.payment.exact || {
    description: "Pay the fixed quoted amount for the selected endpoint.",
  };
  normalized.payment.upto = {
    ...(normalized.payment.upto || {}),
    enabled: false,
    description: "Disabled in the public directory wrapper; fetch the live 402 quote and pay the exact amount.",
  };
  normalized.livePrices = normalized.livePrices || {};
  normalized.livePrices.rule = "Fetch the target endpoint without payment and use the HTTP 402 payment-required header as the authoritative exact amount immediately before paying.";
  normalized.repository = { ...PUBLIC_REPOSITORY };
  normalized.canonicalUrl = CANONICAL_SERVICE_HUB;
  normalized.startUrl = CANONICAL_SERVICE_HUB;
  normalized.applyUrl = CANONICAL_SERVICE_HUB;
  normalized.buyUrl = CANONICAL_SERVICE_HUB;
  normalized.startApplyBuyUrl = CANONICAL_SERVICE_HUB;
  normalized.primaryCommercialOffer = { ...PRIMARY_COMMERCIAL_OFFER };
  normalized.demandFirstOffer = { ...PRIMARY_COMMERCIAL_OFFER };
  normalized.firstPurchase = { ...PRIMARY_COMMERCIAL_OFFER };
  normalized.recommendedFirstPurchase = { ...PRIMARY_COMMERCIAL_OFFER };
  normalized.standardChatAlternative = { ...STANDARD_CHAT_ALTERNATIVE };
  normalized.nextPurchase = normalizeKeyPackUpgrade(normalized.nextPurchase);
  normalized.keyPackUpgradeOffer = normalizeKeyPackUpgrade(normalized.keyPackUpgradeOffer);
  normalized.buyerPaths = normalizePrimaryBuyerPaths(normalized.buyerPaths);
  normalized.primaryRouteId = PRIMARY_COMMERCIAL_OFFER.routeId;
  normalized.primaryPaidUrl = PRIMARY_COMMERCIAL_OFFER.paidUrl;
  return normalized;
}

function normalizePrimaryBuyerPaths(buyerPaths) {
  const preserved = Array.isArray(buyerPaths)
    ? buyerPaths.filter((path) => (
      path?.routeId !== PRIMARY_COMMERCIAL_OFFER.routeId
      && path?.routeId !== STANDARD_CHAT_ALTERNATIVE.routeId
    ))
    : [];
  return [{ ...PRIMARY_COMMERCIAL_OFFER }, { ...STANDARD_CHAT_ALTERNATIVE }, ...preserved];
}

function normalizeKeyPackUpgrade(offer) {
  const current = offer && typeof offer === "object" && !Array.isArray(offer) ? offer : {};
  const currentTrial = current.deliveryTrial && typeof current.deliveryTrial === "object"
    ? current.deliveryTrial
    : {};
  return {
    ...current,
    ...KEY_PACK_UPGRADE_OFFER,
    deliveryTrial: { ...currentTrial, ...KEY_PACK_DELIVERY_TRIAL },
  };
}

function localPricing() {
  return {
    service: "GPT55 GPT-5.6 Luna Standard x402 API Gateway",
    repository: { ...PUBLIC_REPOSITORY },
    canonicalUrl: CANONICAL_SERVICE_HUB,
    startUrl: CANONICAL_SERVICE_HUB,
    applyUrl: CANONICAL_SERVICE_HUB,
    buyUrl: CANONICAL_SERVICE_HUB,
    startApplyBuyUrl: CANONICAL_SERVICE_HUB,
    currency: "USD",
    settlement: {
      protocol: "x402",
      network: "eip155:8453",
      assetSymbol: "USDC",
      payTo: "0x1f0130669ca6fd02e025a984cc038f139df19a2f",
      schemes: ["exact"],
    },
    primaryCommercialOffer: { ...PRIMARY_COMMERCIAL_OFFER },
    demandFirstOffer: { ...PRIMARY_COMMERCIAL_OFFER },
    firstPurchase: { ...PRIMARY_COMMERCIAL_OFFER },
    recommendedFirstPurchase: { ...PRIMARY_COMMERCIAL_OFFER },
    standardChatAlternative: { ...STANDARD_CHAT_ALTERNATIVE },
    nextPurchase: { ...KEY_PACK_UPGRADE_OFFER },
    keyPackUpgradeOffer: { ...KEY_PACK_UPGRADE_OFFER },
    endpoints: [
      { id: "evm-wallet-balance", method: "GET", path: "/v1/tools/evm-wallet-balance", url: PRIMARY_COMMERCIAL_OFFER.paidUrl, price: PRIMARY_COMMERCIAL_OFFER.price, amountAtomic: PRIMARY_COMMERCIAL_OFFER.amountAtomic },
      { id: "main-model-standard", method: "POST", path: "/v1/chat/completions/standard", url: STANDARD_CHAT_ALTERNATIVE.paidUrl, price: STANDARD_CHAT_ALTERNATIVE.price, amountAtomic: STANDARD_CHAT_ALTERNATIVE.amountAtomic },
      { id: "api-codex-key-pack-100", method: "GET", path: "/v1/paid/api-codex-key-pack-100", url: KEY_PACK_UPGRADE_OFFER.paidUrl, price: KEY_PACK_UPGRADE_OFFER.price, amountAtomic: KEY_PACK_UPGRADE_OFFER.amountAtomic },
      { id: "x402-ping", method: "GET or POST", path: "/v1/x402-ping", url: `${PUBLIC_SERVICE_ORIGIN}/v1/x402-ping`, price: "$0.002", amountAtomic: "2000" },
      { id: "gpt-5.5", method: "POST", path: "/v1/chat/completions/gpt-5.5", url: `${PUBLIC_SERVICE_ORIGIN}/v1/chat/completions/gpt-5.5`, price: "$0.019999", amountAtomic: "19999" },
    ],
  };
}

function normalizePricingForWrapper(pricing) {
  const normalized = structuredClone(
    pricing && typeof pricing === "object" && !Array.isArray(pricing) ? pricing : localPricing(),
  );
  normalized.repository = { ...PUBLIC_REPOSITORY };
  normalized.canonicalUrl = CANONICAL_SERVICE_HUB;
  normalized.startUrl = CANONICAL_SERVICE_HUB;
  normalized.applyUrl = CANONICAL_SERVICE_HUB;
  normalized.buyUrl = CANONICAL_SERVICE_HUB;
  normalized.startApplyBuyUrl = CANONICAL_SERVICE_HUB;
  normalized.primaryCommercialOffer = { ...PRIMARY_COMMERCIAL_OFFER };
  normalized.demandFirstOffer = { ...PRIMARY_COMMERCIAL_OFFER };
  normalized.firstPurchase = { ...PRIMARY_COMMERCIAL_OFFER };
  normalized.recommendedFirstPurchase = { ...PRIMARY_COMMERCIAL_OFFER };
  normalized.standardChatAlternative = { ...STANDARD_CHAT_ALTERNATIVE };
  normalized.nextPurchase = normalizeKeyPackUpgrade(normalized.nextPurchase);
  normalized.keyPackUpgradeOffer = normalizeKeyPackUpgrade(normalized.keyPackUpgradeOffer);
  normalized.buyerPaths = normalizePrimaryBuyerPaths(normalized.buyerPaths);
  normalized.primaryRouteId = PRIMARY_COMMERCIAL_OFFER.routeId;
  normalized.primaryPaidUrl = PRIMARY_COMMERCIAL_OFFER.paidUrl;
  return normalized;
}

function localRpc(payload) {
  const id = payload?.id ?? null;
  switch (payload?.method) {
    case "initialize":
      return localInitialize(id);
    case "notifications/initialized":
      return null;
    case "tools/list":
      return localToolsList(id);
    case "tools/call":
      return localToolCall(id, payload.params || {});
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: [] });
    default:
      return rpcError(id, -32601, `Method not handled by local wrapper: ${payload?.method || ""}`);
  }
}

async function handleMcp(req, res) {
  if (req.method === "GET") {
    return jsonResponse(res, 200, {
      name: "gpt55-x402-gateway",
      canonical_mcp_url: CANONICAL_MCP_URL,
      mode: "local-read-only-directory",
      note: "POST JSON-RPC requests here for local directory introspection. This wrapper does not proxy remote tools or payments.",
    });
  }
  if (req.method !== "POST") {
    return jsonResponse(res, 405, { error: "method_not_allowed" }, { allow: "GET, POST" });
  }
  try {
    const body = await readBody(req);
    const payload = JSON.parse(body || "{}");
    if (Array.isArray(payload)) {
      const results = payload.map(localRpc).filter(Boolean);
      return jsonResponse(res, 200, results);
    }
    const result = localRpc(payload);
    if (result === null) {
      res.writeHead(202, { "cache-control": "no-store" });
      return res.end();
    }
    return jsonResponse(res, 200, result);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return jsonResponse(res, 413, { error: "payload_too_large", maxBytes: MAX_REQUEST_BODY_BYTES });
    }
    return jsonResponse(res, 400, rpcError(null, -32700, "Invalid JSON"));
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/" || url.pathname === "/health") {
      return jsonResponse(res, 200, { status: "ok", mcp: "/mcp", canonicalMcp: CANONICAL_MCP_URL });
    }
    if (url.pathname === "/server.json") {
      return jsonResponse(res, 200, await readJsonFile("./server.json"));
    }
    if (url.pathname === "/buyer-guide.json") {
      return jsonResponse(res, 200, normalizeBuyerGuideForWrapper(await remoteJson("/buyer-guide.json", localBuyerGuide())));
    }
    if (url.pathname === "/pricing.json") {
      return jsonResponse(res, 200, normalizePricingForWrapper(await remoteJson("/pricing.json", localPricing())));
    }
    if (url.pathname === "/mcp" || url.pathname === "/mcp/sse") {
      return handleMcp(req, res);
    }
    return jsonResponse(res, 404, { error: "not_found" });
  } catch (error) {
    return jsonResponse(res, 500, { error: "internal_error", message: String(error?.message || error) });
  }
});

server.requestTimeout = 10_000;
server.headersTimeout = 5_000;
server.keepAliveTimeout = 5_000;
server.timeout = 15_000;

server.listen(PORT, HOST, () => {
  console.log(`gpt55-x402-gateway wrapper listening on http://${HOST}:${PORT}`);
});
