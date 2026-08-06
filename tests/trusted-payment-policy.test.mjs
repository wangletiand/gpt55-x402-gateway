import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { encodePaymentRequiredHeader } from '@x402/core/http';
import { x402Client } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';

import * as trustedPaymentPolicy from '../examples/x402-first-payment-client/trusted-payment-policy.mjs';
import * as httpSafety from '../examples/x402-first-payment-client/http-safety.mjs';
import {
  TRUSTED_ROUTE_POLICIES,
  assertSettledPayment,
  assertValidSpendCap,
  evaluateTrustedQuote,
  selectTrustedRequirement,
} from '../examples/x402-first-payment-client/trusted-payment-policy.mjs';
import {
  PaymentTransportError,
  asPaymentTransportError,
  isIndeterminatePaymentError,
  readBoundedResponseBody,
} from '../examples/x402-first-payment-client/http-safety.mjs';

const policy = TRUSTED_ROUTE_POLICIES['main-model-standard'];

function validQuote(overrides = {}) {
  return {
    status: 402,
    requestedUrl: policy.paidUrl,
    quotedResourceUrl: policy.paidUrl,
    requestedMethod: policy.method,
    scheme: policy.scheme,
    network: policy.network,
    asset: policy.asset,
    payTo: policy.payTo,
    amountAtomic: policy.amountAtomic,
    amountUsd: Number(policy.amountAtomic) / 1_000_000,
    ...overrides,
  };
}

function validPaymentRequired(requirementOverrides = {}) {
  return {
    x402Version: 2,
    resource: { url: policy.paidUrl },
    accepts: [{
      scheme: policy.scheme,
      network: policy.network,
      asset: policy.asset,
      payTo: policy.payTo,
      amount: policy.amountAtomic,
      maxTimeoutSeconds: 60,
      extra: { name: 'USD Coin', version: '2' },
      ...requirementOverrides,
    }],
  };
}

function stagedPaymentFetch(secondStageSource) {
  const quoteHeader = encodePaymentRequiredHeader(validPaymentRequired());
  return `
    let requestCount = 0;
    globalThis.fetch = async (input, init) => {
      requestCount += 1;
      const request = new Request(input, init);
      const hasPaymentHeader = request.headers.has('payment-signature') || request.headers.has('x-payment');
      if (requestCount === 1) {
        return new Response('', {
          status: 402,
          headers: { 'payment-required': ${JSON.stringify(quoteHeader)} },
        });
      }
      ${secondStageSource}
    };
  `;
}

function withFailingSigner(preloadSource) {
  const signerModule = `
    export function privateKeyToAccount() {
      return {
        address: '0x0000000000000000000000000000000000000001',
        async signTypedData() {
          throw new Error('Simulated signer failure.');
        },
      };
    }
  `;
  const signerModuleUrl = `data:text/javascript,${encodeURIComponent(signerModule)}`;
  const loaderModule = `
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'viem/accounts') {
        return { url: ${JSON.stringify(signerModuleUrl)}, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `;
  const loaderModuleUrl = `data:text/javascript,${encodeURIComponent(loaderModule)}`;
  return `
    import { register } from 'node:module';
    register(${JSON.stringify(loaderModuleUrl)}, import.meta.url);
    ${preloadSource}
  `;
}

function runFirstPaymentClient(preloadSource) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      `data:text/javascript,${encodeURIComponent(preloadSource)}`,
      fileURLToPath(new URL('../examples/x402-first-payment-client/first-payment-client.mjs', import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      env: {
        ...process.env,
        PAY_REAL_X402: '1',
        EVM_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
        EVIDENCE_FILE: '0',
        X402_FETCH_RETRIES: '1',
      },
    },
  );
}

function assertPrePaymentFailure(result, errorPattern) {
  assert.equal(result.status, 1, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.match(evidence.error, errorPattern);
  assert.equal(evidence.paymentAttempted, false);
  assert.equal(evidence.settlementUnknown, false);
  assert.equal(evidence.retryGuidance, null);
}

test('main model policy pins the complete Base USDC payment identity', () => {
  assert.deepEqual(policy, {
    id: 'main-model-standard',
    paidUrl: 'https://gpt55.558686.xyz/v1/chat/completions/standard',
    method: 'POST',
    scheme: 'exact',
    network: 'eip155:8453',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0x1f0130669ca6fd02e025a984cc038f139df19a2f',
    amountAtomic: '2930',
  });
});

test('quote validation accepts only an exact match to the local policy', () => {
  const decision = evaluateTrustedQuote(validQuote(), policy, 0.003);
  assert.equal(decision.safeToPay, true);
  assert.equal(Object.values(decision.checks).every(Boolean), true);
});

for (const [name, overrides] of [
  ['requested origin and path', { requestedUrl: 'https://example.invalid/v1/chat/completions/standard' }],
  ['quoted resource origin and path', { quotedResourceUrl: 'https://example.invalid/v1/chat/completions/standard' }],
  ['method', { requestedMethod: 'GET' }],
  ['scheme', { scheme: 'upto' }],
  ['network', { network: 'eip155:1' }],
  ['asset', { asset: '0x1111111111111111111111111111111111111111' }],
  ['merchant', { payTo: '0x2222222222222222222222222222222222222222' }],
  ['amount', { amountAtomic: '1', amountUsd: 0.000001 }],
]) {
  test(`quote validation rejects wrong ${name}`, () => {
    assert.equal(evaluateTrustedQuote(validQuote(overrides), policy, 0.003).safeToPay, false);
  });
}

test('bounded response reader accepts a response within the configured limit', async () => {
  assert.equal(await readBoundedResponseBody(new Response('hello'), 5), 'hello');
});

test('bounded response reader rejects a response that exceeds the configured limit', async () => {
  await assert.rejects(
    () => readBoundedResponseBody(new Response('too large'), 5),
    /response exceeded 5 bytes/i,
  );
});

test('fetch transport failures are marked as indeterminate payment errors', () => {
  const wrapped = asPaymentTransportError(new TypeError('fetch failed'));
  assert.equal(wrapped instanceof PaymentTransportError, true);
  assert.equal(isIndeterminatePaymentError(wrapped), true);
});

test('local policy validation errors are not marked as indeterminate payments', () => {
  const error = new Error('No trusted requirement matched.');
  assert.equal(asPaymentTransportError(error), error);
  assert.equal(isIndeterminatePaymentError(error), false);
});

test('any unconfirmed failure after a payment attempt is treated as settlement-unknown', () => {
  assert.equal(
    typeof httpSafety.isSettlementOutcomeUnknown,
    'function',
    'post-attempt settlement classifier must be exported',
  );
  assert.equal(httpSafety.isSettlementOutcomeUnknown({ paymentAttempted: true, settled: false }), true);
  assert.equal(httpSafety.isSettlementOutcomeUnknown({ paymentAttempted: false, settled: false }), false);
  assert.equal(httpSafety.isSettlementOutcomeUnknown({ paymentAttempted: true, settled: true }), false);
});

test('invalid private key fails before a payment attempt starts', () => {
  const quote = {
    resource: { url: policy.paidUrl },
    accepts: [{
      scheme: policy.scheme,
      network: policy.network,
      asset: policy.asset,
      payTo: policy.payTo,
      amount: policy.amountAtomic,
    }],
  };
  const preloadSource = `globalThis.fetch = async () => new Response(${JSON.stringify(JSON.stringify(quote))}, { status: 402, headers: { 'content-type': 'application/json' } });`;
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      `data:text/javascript,${encodeURIComponent(preloadSource)}`,
      fileURLToPath(new URL('../examples/x402-first-payment-client/first-payment-client.mjs', import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      env: {
        ...process.env,
        PAY_REAL_X402: '1',
        EVM_PRIVATE_KEY: 'invalid-local-private-key',
        EVIDENCE_FILE: '0',
        X402_FETCH_RETRIES: '1',
      },
    },
  );

  assert.equal(result.status, 1, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.paymentAttempted, false);
  assert.equal(evidence.settlementUnknown, false);
  assert.equal(evidence.retryGuidance, null);
});

test('second 402 parsing failure remains a pre-payment failure', () => {
  const result = runFirstPaymentClient(stagedPaymentFetch(`
    if (requestCount === 2) {
      if (hasPaymentHeader) throw new Error('Unexpected payment header before 402 parsing.');
      return new Response('', {
        status: 402,
        headers: { 'payment-required': 'not-a-valid-payment-required-header' },
      });
    }
    throw new Error('Unexpected extra fetch.');
  `));

  assertPrePaymentFailure(result, /Failed to parse payment requirements/i);
});

test('SDK selector rejection remains a pre-payment failure', () => {
  const untrustedHeader = encodePaymentRequiredHeader(validPaymentRequired({
    asset: '0x1111111111111111111111111111111111111111',
  }));
  const result = runFirstPaymentClient(stagedPaymentFetch(`
    if (requestCount === 2) {
      if (hasPaymentHeader) throw new Error('Unexpected payment header before selector validation.');
      return new Response('', {
        status: 402,
        headers: { 'payment-required': ${JSON.stringify(untrustedHeader)} },
      });
    }
    throw new Error('Unexpected extra fetch.');
  `));

  assertPrePaymentFailure(result, /trusted exact Base USDC payment requirement/i);
});

test('payment payload signing failure remains a pre-payment failure', () => {
  const paymentHeader = encodePaymentRequiredHeader(validPaymentRequired());
  const result = runFirstPaymentClient(withFailingSigner(stagedPaymentFetch(`
    if (requestCount === 2) {
      if (hasPaymentHeader) throw new Error('Unexpected payment header before signing.');
      return new Response('', {
        status: 402,
        headers: { 'payment-required': ${JSON.stringify(paymentHeader)} },
      });
    }
    throw new Error('Unexpected extra fetch.');
  `)));

  assertPrePaymentFailure(result, /Simulated signer failure/i);
});

test('network failure while sending a payment header marks settlement unknown', () => {
  const paymentHeader = encodePaymentRequiredHeader(validPaymentRequired());
  const result = runFirstPaymentClient(stagedPaymentFetch(`
    if (requestCount === 2) {
      if (hasPaymentHeader) throw new Error('Unexpected payment header on the unpaid request.');
      return new Response('', {
        status: 402,
        headers: { 'payment-required': ${JSON.stringify(paymentHeader)} },
      });
    }
    if (requestCount === 3) {
      if (!hasPaymentHeader) throw new Error('Expected PAYMENT-SIGNATURE or X-PAYMENT.');
      throw new TypeError('Simulated paid request network failure.');
    }
    throw new Error('Unexpected extra fetch.');
  `));

  assert.equal(result.status, 1, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.match(evidence.error, /Payment transport failed; settlement status is unknown/i);
  assert.equal(evidence.paymentAttempted, true);
  assert.equal(evidence.settlementUnknown, true);
  assert.match(evidence.retryGuidance, /Do not retry/i);
});

for (const status of [301, 302, 303, 307, 308]) {
  test(`quote fetch refuses HTTP ${status} redirects before payment`, () => {
    const result = runFirstPaymentClient(`
      globalThis.fetch = async () => new Response('', {
        status: ${status},
        headers: { location: 'https://redirect-target.invalid/collect' },
      });
    `);

    assertPrePaymentFailure(result, new RegExp(`refusing HTTP ${status} redirect`, 'i'));
  });

  test(`paid fetch refuses HTTP ${status} redirects without following them`, () => {
    const paymentHeader = encodePaymentRequiredHeader(validPaymentRequired());
    const result = runFirstPaymentClient(stagedPaymentFetch(`
      if (requestCount === 2) {
        if (hasPaymentHeader) throw new Error('Unexpected payment header on the unpaid request.');
        return new Response('', {
          status: 402,
          headers: { 'payment-required': ${JSON.stringify(paymentHeader)} },
        });
      }
      if (requestCount === 3) {
        if (!hasPaymentHeader) throw new Error('Expected PAYMENT-SIGNATURE or X-PAYMENT.');
        if (request.redirect !== 'error') {
          throw new Error('Paid request did not disable redirect following.');
        }
        return new Response('', {
          status: ${status},
          headers: { location: 'https://redirect-target.invalid/collect' },
        });
      }
      throw new Error('Unexpected extra fetch.');
    `));

    assert.equal(result.status, 1, result.stderr);
    const evidence = JSON.parse(result.stdout);
    assert.match(evidence.error, new RegExp(`refusing HTTP ${status} redirect`, 'i'));
    assert.equal(evidence.paymentAttempted, true);
    assert.equal(evidence.settlementUnknown, true);
    assert.match(evidence.retryGuidance, /Do not retry/i);
  });
}

for (const value of [Infinity, -Infinity, NaN, 0, -1]) {
  test(`spend cap rejects ${String(value)}`, () => {
    assert.throws(() => assertValidSpendCap(value), /finite positive number/i);
  });
}

test('SDK selector returns only the locally trusted requirement', () => {
  const selected = selectTrustedRequirement(2, [{
    scheme: policy.scheme,
    network: policy.network,
    asset: policy.asset,
    payTo: policy.payTo,
    amount: policy.amountAtomic,
  }], policy, 0.003);
  assert.equal(selected.asset, policy.asset);
});

test('SDK selector rejects a wrong asset even when all other fields match', () => {
  const wrongAsset = {
    scheme: policy.scheme,
    network: policy.network,
    asset: '0x1111111111111111111111111111111111111111',
    payTo: policy.payTo,
    amount: policy.amountAtomic,
  };
  assert.throws(
    () => selectTrustedRequirement(2, [wrongAsset], policy, 0.003),
    /trusted exact Base USDC payment requirement/i,
  );
});

test('production SDK wiring ignores an untrusted same-network requirement placed first', () => {
  assert.equal(
    typeof trustedPaymentPolicy.createTrustedX402Client,
    'function',
    'trusted SDK client factory must be exported',
  );
  const client = trustedPaymentPolicy.createTrustedX402Client({
    x402Client,
    registerExactEvmScheme,
    signer: { address: '0x0000000000000000000000000000000000000001' },
    policy,
    maxUsdc: 0.003,
  });
  const trusted = {
    scheme: policy.scheme,
    network: policy.network,
    asset: policy.asset,
    payTo: policy.payTo,
    amount: policy.amountAtomic,
  };
  const untrusted = {
    ...trusted,
    asset: '0x1111111111111111111111111111111111111111',
  };

  assert.equal(client.selectPaymentRequirements(2, [untrusted, trusted]), trusted);
  assert.throws(
    () => client.selectPaymentRequirements(2, [untrusted]),
    /trusted exact Base USDC payment requirement/i,
  );
});

function settledResponse(overrides = {}) {
  return {
    status: 200,
    headers: {
      'x-x402-receipt-id': 'receipt-test-1',
      'x-x402-receipt-url': 'https://gpt55.558686.xyz/x402/receipts/receipt-test-1',
    },
    paymentResponse: {
      success: true,
      transaction: `0x${'a'.repeat(64)}`,
      network: policy.network,
    },
    ...overrides,
  };
}

test('settlement validation accepts a successful HTTP response with SDK and service receipts', () => {
  assert.equal(assertSettledPayment(settledResponse(), policy).settled, true);
});

for (const [name, response] of [
  ['HTTP 402', settledResponse({ status: 402 })],
  ['HTTP 500', settledResponse({ status: 500 })],
  ['missing SDK settlement response', settledResponse({ paymentResponse: null })],
  ['failed SDK settlement response', settledResponse({ paymentResponse: { success: false } })],
  ['missing service receipt id', settledResponse({ headers: { 'x-x402-receipt-url': 'https://gpt55.558686.xyz/x402/receipts/test' } })],
  ['missing service receipt URL', settledResponse({ headers: { 'x-x402-receipt-id': 'receipt-test-1' } })],
]) {
  test(`settlement validation rejects ${name}`, () => {
    assert.throws(() => assertSettledPayment(response, policy), /not settled/i);
  });
}
