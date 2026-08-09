import fs from 'node:fs/promises';

const path = new URL('../server.json', import.meta.url);
const document = JSON.parse(await fs.readFile(path, 'utf8'));
const hub = 'https://gpt55.558686.xyz/x402/service';
const paidUrl = 'https://gpt55.558686.xyz/v1/chat/completions/standard';
const keyPackUpgradeOffer = document.keyPackUpgradeOffer || document.primaryCommercialOffer;
const nextPurchase = {
  routeId: 'api-codex-key-pack-100',
  title: 'API Key + URL Pack with $100 quota',
  paidUrl: 'https://x402-key.558686.xyz/v1/paid/api-codex-key-pack-100',
  checkoutUrl: 'https://x402-key.558686.xyz/x402/checkout',
  price: '$11.1112',
  amountAtomic: '11111200',
  reason: 'Upgrade after the one-request result proves the buyer needs repeated model calls.',
};
const standardOffer = {
  id: 'standard-chat-demand-first',
  routeId: 'standard-chat',
  title: 'GPT-5.6 Luna Standard one-request result',
  label: 'GPT-5.6 Luna Standard one-request result',
  buyerJob: 'Get one immediate OpenAI-compatible answer before committing to a quota pack or larger workflow.',
  page: `${hub}?checkout=standard-chat`,
  json: 'https://gpt55.558686.xyz/x402/service.json',
  checkoutUrl: `${hub}?checkout=standard-chat`,
  paidUrl,
  quoteUrl: paidUrl,
  quoteOnlyUrl: paidUrl,
  quoteEndpoint: paidUrl,
  quoteEndpointMode: 'live-402',
  method: 'POST',
  price: '$0.00293',
  priceUsd: 0.00293,
  amountAtomic: '2930',
  network: 'eip155:8453',
  asset: 'USDC',
  assetAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payTo: '0x1f0130669ca6fd02e025a984cc038f139df19a2f',
  expectedResult: ['id', 'model', 'choices', 'usage', 'x-x402-receipt-id', 'x-x402-receipt-url'],
  browserCheckout: {
    available: true,
    provider: 'EIP-1193 injected wallet',
    type: 'eip3009-transfer-with-authorization',
    url: `${hub}?checkout=standard-chat`,
    bundleUrl: 'https://gpt55.558686.xyz/x402/browser-wallet-payment.js',
    paidUrl,
    method: 'POST',
    amountAtomic: '2930',
    privateKeySentToService: false,
    buttonLabel: 'Pay with browser wallet',
  },
  agentFallback: {
    routeId: 'standard',
    firstPaymentClient: 'https://gpt55.558686.xyz/x402/first-payment-client.mjs',
    quoteOnlyCommand: 'ROUTE_ID=standard MAX_USDC=0.00293 node first-payment-client.mjs',
    installCommand: 'npm install @x402/fetch @x402/core @x402/evm viem',
    sameRequestRetry: true,
    privateKeySentToService: false,
  },
  nextPurchase,
  startApplyBuyUrl: hub,
};

document.version = '2026.08.10-demand-first-primary';
document.buyerPaths = [
  standardOffer,
  ...(document.buyerPaths || []).filter((item) => item?.routeId !== standardOffer.routeId && item?.id !== standardOffer.id),
];
document.primaryCommercialOffer = standardOffer;
document.demandFirstOffer = standardOffer;
document.firstPurchase = standardOffer;
document.recommendedFirstPurchase = standardOffer;
document.nextPurchase = nextPurchase;
document.keyPackUpgradeOffer = keyPackUpgradeOffer;
document.primaryPaidUrl = paidUrl;
document.primaryRouteId = standardOffer.routeId;

await fs.writeFile(path, `${JSON.stringify(document)}\n`);
