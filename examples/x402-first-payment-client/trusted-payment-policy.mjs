const BASE_USDC_DECIMALS = 6;
const BASE_USDC_ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const MERCHANT = '0x1f0130669ca6fd02e025a984cc038f139df19a2f';
const WALLET_BALANCE_ROUTE_ID = 'evm-wallet-balance';
const WALLET_BALANCE_ORIGIN = 'https://gpt55.558686.xyz';
const WALLET_BALANCE_PATH = '/v1/tools/evm-wallet-balance';
const WALLET_LOOKUP_NETWORKS = new Set(['base', 'ethereum']);

export const TRUSTED_ROUTE_POLICIES = Object.freeze({
  'main-model-standard': Object.freeze({
    id: 'main-model-standard',
    paidUrl: 'https://gpt55.558686.xyz/v1/chat/completions/standard',
    method: 'POST',
    scheme: 'exact',
    network: 'eip155:8453',
    asset: BASE_USDC_ASSET,
    payTo: MERCHANT,
    amountAtomic: '2930',
  }),
});

export function getTrustedRoutePolicy(routeId, inputs = {}) {
  if (routeId === WALLET_BALANCE_ROUTE_ID) {
    return walletBalancePolicy(inputs);
  }
  const policy = TRUSTED_ROUTE_POLICIES[routeId];
  if (!policy) {
    const supported = [WALLET_BALANCE_ROUTE_ID, ...Object.keys(TRUSTED_ROUTE_POLICIES)];
    throw new Error(`Unsupported ROUTE_ID=${routeId}. Supported routes: ${supported.join(', ')}`);
  }
  return policy;
}

function walletBalancePolicy({ evmAddress, evmNetwork } = {}) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(evmAddress || ''))) {
    throw new Error('EVM_ADDRESS must be a public 0x-prefixed 20-byte EVM address.');
  }
  if (!WALLET_LOOKUP_NETWORKS.has(evmNetwork)) {
    throw new Error('EVM_NETWORK must be base or ethereum.');
  }
  const paidUrl = new URL(WALLET_BALANCE_PATH, WALLET_BALANCE_ORIGIN);
  paidUrl.searchParams.set('address', evmAddress);
  paidUrl.searchParams.set('network', evmNetwork);
  return Object.freeze({
    id: WALLET_BALANCE_ROUTE_ID,
    paidUrl: paidUrl.href,
    method: 'GET',
    scheme: 'exact',
    network: 'eip155:8453',
    asset: BASE_USDC_ASSET,
    payTo: MERCHANT,
    amountAtomic: '1000',
  });
}

export function assertValidSpendCap(maxUsdc) {
  if (!Number.isFinite(maxUsdc) || maxUsdc <= 0) {
    throw new Error('MAX_USDC must be a finite positive number.');
  }
  return maxUsdc;
}

export function evaluateTrustedQuote(quote, policy, maxUsdc) {
  assertValidSpendCap(maxUsdc);
  const quotedAmountUsd = atomicUsdcToNumber(quote?.amountAtomic);
  const checks = {
    statusIs402: quote?.status === 402,
    requestedUrlMatches: exactUrlMatches(quote?.requestedUrl, policy.paidUrl),
    quotedResourceUrlMatches: exactUrlMatches(quote?.quotedResourceUrl, policy.paidUrl),
    requestedMethodMatches: String(quote?.requestedMethod || '').toUpperCase() === policy.method,
    schemeMatches: quote?.scheme === policy.scheme,
    networkMatches: quote?.network === policy.network,
    assetMatches: sameAddress(quote?.asset, policy.asset),
    payToMatches: sameAddress(quote?.payTo, policy.payTo),
    amountMatches: String(quote?.amountAtomic || '') === policy.amountAtomic,
    withinSpendCap: Number.isFinite(quotedAmountUsd) && quotedAmountUsd <= maxUsdc,
  };
  return {
    safeToPay: Object.values(checks).every(Boolean),
    checks,
    maxUsdc,
    quotedAmountUsd,
    expected: { ...policy },
  };
}

export function selectTrustedRequirement(x402Version, paymentRequirements, policy, maxUsdc) {
  assertValidSpendCap(maxUsdc);
  if (x402Version !== 2 || !Array.isArray(paymentRequirements)) {
    throw new Error('No trusted exact Base USDC payment requirement matched local policy.');
  }
  const selected = paymentRequirements.find((requirement) => {
    const amountUsd = atomicUsdcToNumber(requirement?.amount);
    return requirement?.scheme === policy.scheme
      && requirement?.network === policy.network
      && sameAddress(requirement?.asset, policy.asset)
      && sameAddress(requirement?.payTo, policy.payTo)
      && String(requirement?.amount || '') === policy.amountAtomic
      && Number.isFinite(amountUsd)
      && amountUsd <= maxUsdc;
  });
  if (!selected) {
    throw new Error('No trusted exact Base USDC payment requirement matched local policy.');
  }
  return selected;
}

export function createTrustedX402Client({
  x402Client,
  registerExactEvmScheme,
  signer,
  policy,
  maxUsdc,
}) {
  const client = new x402Client((version, requirements) => (
    selectTrustedRequirement(version, requirements, policy, maxUsdc)
  ));
  registerExactEvmScheme(client, {
    signer,
    networks: [policy.network],
  });
  return client;
}

export function assertSettledPayment(paid, policy) {
  const receiptId = paid?.headers?.['x-x402-receipt-id'];
  const receiptUrl = paid?.headers?.['x-x402-receipt-url'];
  const paymentResponse = paid?.paymentResponse;
  const checks = {
    httpSucceeded: Number.isInteger(paid?.status) && paid.status >= 200 && paid.status < 300,
    sdkSettlementSucceeded: paymentResponse?.success === true,
    transactionPresent: /^0x[0-9a-fA-F]{64}$/.test(String(paymentResponse?.transaction || '')),
    settlementNetworkMatches: paymentResponse?.network === policy.network,
    receiptIdPresent: typeof receiptId === 'string' && receiptId.trim().length > 0,
    receiptUrlTrusted: trustedReceiptUrl(receiptUrl, policy),
  };
  if (!Object.values(checks).every(Boolean)) {
    const error = new Error(`Payment was not settled: ${JSON.stringify(checks)}`);
    error.checks = checks;
    throw error;
  }
  return {
    paymentAttempted: true,
    paymentAuthorized: true,
    settled: true,
    checks,
    receiptId,
    receiptUrl,
    transaction: paymentResponse.transaction,
  };
}

function atomicUsdcToNumber(value) {
  if (!/^\d+$/.test(String(value || ''))) return NaN;
  return Number(value) / (10 ** BASE_USDC_DECIMALS);
}

function exactUrlMatches(actual, expected) {
  try {
    return new URL(actual).href === new URL(expected).href;
  } catch {
    return false;
  }
}

function sameAddress(actual, expected) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(actual || ''))
    && String(actual).toLowerCase() === String(expected).toLowerCase();
}

function trustedReceiptUrl(value, policy) {
  try {
    const receipt = new URL(value);
    const service = new URL(policy.paidUrl);
    return receipt.protocol === 'https:'
      && receipt.origin === service.origin
      && receipt.pathname.startsWith('/x402/receipts/');
  } catch {
    return false;
  }
}
