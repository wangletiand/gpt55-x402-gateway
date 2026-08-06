import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePaymentRequiredHeader } from '@x402/core/http';

import {
  asPaymentTransportError,
  isSettlementOutcomeUnknown,
  readBoundedResponseBody,
} from './http-safety.mjs';
import {
  assertSettledPayment,
  assertValidSpendCap,
  createTrustedX402Client,
  evaluateTrustedQuote,
  getTrustedRoutePolicy,
} from './trusted-payment-policy.mjs';

const routeId = process.env.ROUTE_ID || 'main-model-standard';
const maxUsdc = assertValidSpendCap(Number(process.env.MAX_USDC || '0.003'));
const payReal = process.env.PAY_REAL_X402 === '1';
const privateKey = process.env.EVM_PRIVATE_KEY || '';
const evidenceFile = process.env.EVIDENCE_FILE || path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'last-run.evidence.json',
);
const fetchRetryAttempts = parseNonNegativeInteger(process.env.X402_FETCH_RETRIES || '4', 1);
const fetchRetryBaseMs = parseNonNegativeInteger(process.env.X402_FETCH_RETRY_BASE_MS || '500', 0);
const fetchTimeoutMs = parseNonNegativeInteger(process.env.X402_FETCH_TIMEOUT_MS || '15000', 1);
const paymentTimeoutMs = parseNonNegativeInteger(process.env.X402_PAYMENT_TIMEOUT_MS || '60000', 1);
const maxPaidResponseBytes = 1024 * 1024;
const transientFetchStatuses = new Set([408, 429, 500, 502, 503, 504]);

const context = {
  generatedAt: new Date().toISOString(),
  routeId,
  maxUsdc,
  mode: payReal ? 'real-payment' : 'quote-only',
  paymentAttempted: false,
  paymentAuthorized: false,
  settled: false,
  settlementUnknown: false,
};

try {
  await run();
} catch (error) {
  context.settlementUnknown = isSettlementOutcomeUnknown(context);
  await finish({
    ok: false,
    ...context,
    error: String(error?.message || error),
    settlementChecks: error?.checks || null,
    retryGuidance: context.settlementUnknown
      ? 'Do not retry until the receipt endpoint and payer transaction history have been checked.'
      : null,
    evidenceFile,
  });
  process.exitCode = 1;
}

async function run() {
  const policy = getTrustedRoutePolicy(routeId);
  context.paidUrl = policy.paidUrl;
  context.buyerPolicy = buyerPolicySummary(policy);

  const quote = await fetchQuote(policy);
  context.quote = quote;
  const decision = evaluateTrustedQuote(quote, policy, maxUsdc);
  context.decision = decision;
  context.buyerPaymentReadiness = buildBuyerPaymentReadiness(decision);

  if (!payReal) {
    await finish({
      ok: true,
      ...context,
      paymentSent: false,
      evidenceFile,
      nextAction: decision.safeToPay
        ? 'Review the pinned local policy before explicitly enabling real payment in a buyer-controlled environment.'
        : 'Do not pay. The live quote does not match the pinned local policy.',
    });
    return;
  }

  if (!privateKey) {
    throw new Error('PAY_REAL_X402=1 requires EVM_PRIVATE_KEY from a buyer-owned wallet.');
  }
  if (!decision.safeToPay) {
    throw new Error(`Refusing to pay because quote checks failed: ${JSON.stringify(decision.checks)}`);
  }

  const paid = await payWithBuyerWallet(policy);
  context.paymentAuthorized = true;
  context.paid = paid;
  const settlement = assertSettledPayment(paid, policy);
  context.settled = settlement.settled;
  context.settlement = settlement;

  await finish({
    ok: true,
    ...context,
    paymentSent: true,
    evidenceFile,
  });
}

async function payWithBuyerWallet(policy) {
  let x402Client;
  let wrapFetchWithPayment;
  let x402HTTPClient;
  let registerExactEvmScheme;
  let privateKeyToAccount;
  try {
    [{ x402Client, wrapFetchWithPayment, x402HTTPClient }, { registerExactEvmScheme }, { privateKeyToAccount }] = await Promise.all([
      import('@x402/fetch'),
      import('@x402/evm/exact/client'),
      import('viem/accounts'),
    ]);
  } catch (error) {
    throw new Error(`Real payment mode needs dependencies installed first. Run npm install. Original error: ${error.message}`);
  }

  const account = privateKeyToAccount(privateKey);
  const protocolClient = createTrustedX402Client({
    x402Client,
    registerExactEvmScheme,
    signer: account,
    policy,
    maxUsdc,
  });

  const paymentTrackingFetch = async (input, init) => {
    const outgoingRequest = new Request(input, { ...init, redirect: 'error' });
    if (outgoingRequest.headers.has('payment-signature') || outgoingRequest.headers.has('x-payment')) {
      context.paymentAttempted = true;
    }
    const response = await fetch(outgoingRequest);
    return assertNoHttpRedirect(response, `${policy.method} ${policy.paidUrl}`);
  };
  const x402Fetch = wrapFetchWithPayment(paymentTrackingFetch, protocolClient);
  const request = paidRequest(policy);
  let response;
  try {
    response = await x402Fetch(request.url, {
      ...request.options,
      signal: AbortSignal.timeout(paymentTimeoutMs),
    });
  } catch (error) {
    throw asPaymentTransportError(error);
  }
  const headers = Object.fromEntries(response.headers.entries());
  const httpClient = new x402HTTPClient(protocolClient);
  const paymentResponse = readPaymentResponse(httpClient, response.headers);
  const text = await readBoundedResponseBody(response, maxPaidResponseBytes);
  return {
    status: response.status,
    headers,
    paymentResponse,
    json: parseJson(text),
    text: parseJson(text) ? undefined : text.slice(0, 2000),
  };
}

function readPaymentResponse(httpClient, headers) {
  try {
    return httpClient.getPaymentSettleResponse((name) => headers.get(name));
  } catch {
    return null;
  }
}

async function fetchQuote(policy) {
  const request = paidRequest(policy);
  const response = await fetchWithRetry(request.url, {
    ...request.options,
    headers: { ...request.options.headers, accept: 'application/json' },
  }, { label: `${policy.method} ${policy.paidUrl}` });
  const header = response.headers.get('payment-required') || response.headers.get('x-payment-required');
  const text = await response.text();
  const decoded = decodePaymentRequired(header) || parseJson(text) || {};
  const accepts = Array.isArray(decoded.accepts) ? decoded.accepts : [];
  const candidate = accepts.find((item) => item?.scheme === policy.scheme && item?.network === policy.network)
    || accepts[0]
    || decoded;
  const amountAtomic = String(candidate?.amount || candidate?.maxAmountRequired || '');
  return {
    status: response.status,
    requestedUrl: request.url,
    quotedResourceUrl: decoded?.resource?.url || null,
    requestedMethod: request.options.method,
    amountAtomic,
    amountUsd: /^\d+$/.test(amountAtomic) ? Number(amountAtomic) / 1_000_000 : null,
    scheme: candidate?.scheme || null,
    network: candidate?.network || null,
    asset: candidate?.asset || null,
    payTo: candidate?.payTo || candidate?.pay_to || null,
  };
}

function paidRequest(policy) {
  return {
    url: policy.paidUrl,
    options: {
      method: policy.method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        messages: [{ role: 'user', content: 'Reply with one concise sentence confirming the x402 request completed.' }],
        max_tokens: 32,
      }),
    },
  };
}

async function fetchWithRetry(input, init, { label } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= fetchRetryAttempts; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
      assertNoHttpRedirect(response, label || String(input));
      if (!transientFetchStatuses.has(response.status) || attempt === fetchRetryAttempts) return response;
      lastError = new Error(`${label || input} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === fetchRetryAttempts) throw error;
    }
    const delayMs = fetchRetryBaseMs * attempt;
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw lastError;
}

function assertNoHttpRedirect(response, label) {
  if (response.redirected || (response.status >= 300 && response.status <= 399)) {
    throw new Error(`Refusing HTTP ${response.status} redirect for ${label}.`);
  }
  return response;
}

function buyerPolicySummary(policy) {
  return {
    source: 'local-hardcoded-policy',
    quoteBeforePay: true,
    noPaymentByDefault: !payReal,
    maxUsdc,
    expectedAmountAtomic: policy.amountAtomic,
    expectedNetwork: policy.network,
    expectedAsset: policy.asset,
    expectedPayTo: policy.payTo,
    expectedMethod: policy.method,
    expectedUrl: policy.paidUrl,
    paymentOptInRequired: 'PAY_REAL_X402=1',
    walletSource: 'buyer-owned EVM_PRIVATE_KEY only; never send private keys to the API',
  };
}

function buildBuyerPaymentReadiness(decision) {
  const missingForRealPayment = [];
  if (!payReal) missingForRealPayment.push('PAY_REAL_X402=1');
  if (!privateKey) missingForRealPayment.push('EVM_PRIVATE_KEY');
  if (!decision.safeToPay) missingForRealPayment.push('decision.safeToPay=true');
  return {
    readyForRealPayment: payReal && Boolean(privateKey) && decision.safeToPay,
    quoteSafeToPay: decision.safeToPay,
    realPaymentOptInPresent: payReal,
    buyerWalletPresent: Boolean(privateKey),
    privateKeySentToService: false,
    missingForRealPayment,
    quoteOnlyCommand: 'ROUTE_ID=main-model-standard MAX_USDC=0.003 npm run first-payment:quote',
    realPaymentCommand: 'PAY_REAL_X402=1 ROUTE_ID=main-model-standard MAX_USDC=0.003 EVM_PRIVATE_KEY=$EVM_PRIVATE_KEY npm run first-payment:quote',
  };
}

function decodePaymentRequired(value) {
  if (!value) return null;
  try {
    return decodePaymentRequiredHeader(value);
  } catch {
    return parseJson(value);
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseNonNegativeInteger(value, minimum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`Expected an integer >= ${minimum}, received ${value}.`);
  }
  return parsed;
}

async function finish(result) {
  await writeEvidence(result);
  console.log(JSON.stringify(result, null, 2));
}

async function writeEvidence(result) {
  if (process.env.EVIDENCE_FILE === '0') return;
  await fs.promises.mkdir(path.dirname(evidenceFile), { recursive: true });
  await fs.promises.writeFile(`${evidenceFile}.tmp`, `${JSON.stringify(result, null, 2)}\n`);
  await fs.promises.rename(`${evidenceFile}.tmp`, evidenceFile);
}
