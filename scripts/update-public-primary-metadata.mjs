import fs from 'node:fs/promises';

const path = new URL('../server.json', import.meta.url);
const document = JSON.parse(await fs.readFile(path, 'utf8'));
const hub = 'https://gpt55.558686.xyz/x402/service';
const walletPaidUrl = 'https://gpt55.558686.xyz/v1/tools/evm-wallet-balance';
const standardPaidUrl = 'https://gpt55.558686.xyz/v1/chat/completions/standard';
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
  paidUrl: standardPaidUrl,
  quoteUrl: standardPaidUrl,
  quoteOnlyUrl: standardPaidUrl,
  quoteEndpoint: standardPaidUrl,
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
    paidUrl: standardPaidUrl,
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
const walletOffer = {
  id: 'evm-wallet-balance-demand-first',
  routeId: 'evm-wallet-balance',
  title: 'EVM Wallet Balance Snapshot',
  label: 'EVM Wallet Balance Snapshot',
  buyerJob: 'Read native and USDC balances for one public EVM address before committing to a larger workflow.',
  page: `${hub}?checkout=evm-wallet-balance`,
  json: 'https://gpt55.558686.xyz/x402/service.json',
  checkoutUrl: `${hub}?checkout=evm-wallet-balance`,
  paidUrl: walletPaidUrl,
  quoteUrl: walletPaidUrl,
  quoteOnlyUrl: `${walletPaidUrl}?address=0x1111111111111111111111111111111111111111&network=base`,
  quoteEndpoint: walletPaidUrl,
  quoteEndpointMode: 'live-402',
  method: 'GET',
  price: '$0.001',
  priceUsd: 0.001,
  amountAtomic: '1000',
  network: 'eip155:8453',
  asset: 'USDC',
  assetAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payTo: '0x1f0130669ca6fd02e025a984cc038f139df19a2f',
  expectedResult: ['address', 'network', 'nativeBalance', 'usdcBalance', 'x-x402-receipt-id', 'x-x402-receipt-url'],
  browserCheckout: {
    available: true,
    provider: 'EIP-1193 injected wallet',
    type: 'eip3009-transfer-with-authorization',
    url: `${hub}?checkout=evm-wallet-balance`,
    bundleUrl: 'https://gpt55.558686.xyz/x402/browser-wallet-payment.js',
    paidUrl: walletPaidUrl,
    method: 'GET',
    amountAtomic: '1000',
    privateKeySentToService: false,
    buttonLabel: 'Pay with browser wallet',
  },
  agentFallback: {
    routeId: 'evm-wallet-balance',
    firstPaymentClient: 'https://gpt55.558686.xyz/x402/first-payment-client.mjs',
    quoteOnlyCommand: 'ROUTE_ID=evm-wallet-balance EVM_ADDRESS=0x1111111111111111111111111111111111111111 EVM_NETWORK=base MAX_USDC=0.001 node first-payment-client.mjs',
    installCommand: 'npm install @x402/fetch @x402/core @x402/evm viem',
    sameRequestRetry: true,
    privateKeySentToService: false,
  },
  standardChatAlternative: standardOffer,
  nextPurchase,
  startApplyBuyUrl: hub,
};

document.version = '2026.08.13-wallet-primary-standard-alternative';
document.buyerPaths = [
  walletOffer,
  standardOffer,
  ...(document.buyerPaths || []).filter((item) => (
    item?.routeId !== walletOffer.routeId
    && item?.id !== walletOffer.id
    && item?.routeId !== standardOffer.routeId
    && item?.id !== standardOffer.id
  )),
];
document.primaryCommercialOffer = walletOffer;
document.demandFirstOffer = walletOffer;
document.firstPurchase = walletOffer;
document.recommendedFirstPurchase = walletOffer;
document.standardChatAlternative = standardOffer;
document.nextPurchase = nextPurchase;
document.keyPackUpgradeOffer = keyPackUpgradeOffer;
document.primaryPaidUrl = walletPaidUrl;
document.primaryRouteId = walletOffer.routeId;

await fs.writeFile(path, `${JSON.stringify(document)}\n`);
