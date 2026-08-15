import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const guide = await fs.readFile(new URL('./docs/demand-first-checkout.md', root), 'utf8');
const server = JSON.parse(await fs.readFile(new URL('./server.json', root), 'utf8'));
const offer = server.walletBalanceAlternative;
const standard = server.primaryCommercialOffer;

assert.equal(offer.routeId, 'evm-wallet-balance');
assert.equal(offer.method, 'GET');
assert.equal(offer.price, '$0.001');
assert.equal(offer.amountAtomic, '1000');
assert.equal(offer.network, 'eip155:8453');
assert.equal(offer.assetAddress, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
assert.equal(offer.payTo, '0x1f0130669ca6fd02e025a984cc038f139df19a2f');
assert.equal(offer.checkoutUrl, 'https://gpt55.558686.xyz/x402/service?checkout=evm-wallet-balance');
assert.equal(standard.routeId, 'standard-chat');
assert.equal(standard.method, 'POST');
assert.equal(standard.price, '$0.00293');
assert.equal(standard.amountAtomic, '2930');

for (const phrase of [
  'EVM Wallet Balance Snapshot',
  'https://gpt55.558686.xyz/x402/service?checkout=evm-wallet-balance',
  'https://gpt55.558686.xyz/v1/tools/evm-wallet-balance',
  'EVM_ADDRESS',
  'EVM_NETWORK',
  '$0.001',
  'Standard alternative',
  'https://gpt55.558686.xyz/x402/service?checkout=standard-chat',
  'https://gpt55.558686.xyz/v1/chat/completions/standard',
  'PAYMENT-REQUIRED',
  'PAYMENT-SIGNATURE',
  'same request',
  'PAYMENT-RESPONSE',
  'initiate_x402_request',
  'maxPayment',
  'private key never leaves',
  '402index.io',
  '915a39de-ce9a-4294-be23-21f15c3dca99',
  'Bazaar v2',
]) {
  assert.match(guide, new RegExp(escapeRegExp(phrase), 'i'), `guide must contain ${phrase}`);
}

assert.doesNotMatch(guide, /X402_PAYER_PRIVATE_KEY|0x[a-f0-9]{64}/i, 'guide must not contain wallet secrets');
console.log('demand-first discovery guide contract ok');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
