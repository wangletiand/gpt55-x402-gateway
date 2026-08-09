import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const hub = 'https://gpt55.558686.xyz/x402/service';
const expected = {
  routeId: 'standard-chat',
  method: 'POST',
  paidUrl: 'https://gpt55.558686.xyz/v1/chat/completions/standard',
  price: '$0.00293',
  amountAtomic: '2930',
};

test('checked-in public artifacts converge on the Standard first purchase', async () => {
  const [serverJson, readme, page] = await Promise.all([
    readJson('server.json'),
    fs.readFile(new URL('../README.md', import.meta.url), 'utf8'),
    fs.readFile(new URL('../docs/index.html', import.meta.url), 'utf8'),
  ]);

  assertPrimary(serverJson.primaryCommercialOffer, 'server primary');
  assertPrimary(serverJson.firstPurchase, 'server first');
  assertPrimary(serverJson.recommendedFirstPurchase, 'server recommended');
  assertPrimary(serverJson.buyerPaths?.[0], 'server buyerPaths[0]');
  assert.equal(serverJson.primaryRouteId, expected.routeId);
  assert.equal(serverJson.primaryPaidUrl, expected.paidUrl);
  assert.equal(serverJson.nextPurchase?.routeId, 'api-codex-key-pack-100');
  assert.equal(serverJson.keyPackUpgradeOffer?.routeId, 'api-codex-key-pack-100');
  assertKeyPackUpgrade(serverJson.keyPackUpgradeOffer, 'server Key Pack upgrade');

  for (const [label, content] of [['README', readme], ['Pages', page]]) {
    assert.match(content, /GPT-5\.6 Luna Standard/i, `${label} product`);
    assert.match(content, /\$0\.00293/, `${label} price`);
    assert.match(content, /\/v1\/chat\/completions\/standard/, `${label} paid route`);
    assert.match(content, /browser wallet/i, `${label} browser checkout`);
    assert.match(content, /Key Pack[^\n<]*upgrade|upgrade[^\n<]*Key Pack/i, `${label} Key Pack upgrade`);
    assert.match(content, new RegExp(hub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} canonical hub`);
  }
});

test('wrapper fallback metadata converges on the Standard first purchase', async () => {
  const port = await reservePort();
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), REMOTE_BASE_URL: 'http://127.0.0.1:1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  try {
    await waitForHealth(port, child);
    for (const pathname of ['/buyer-guide.json', '/pricing.json']) {
      const document = await fetchJson(`http://127.0.0.1:${port}${pathname}`);
      assertPrimary(document.primaryCommercialOffer, `${pathname} primary`);
      assertPrimary(document.firstPurchase, `${pathname} first`);
      assertPrimary(document.recommendedFirstPurchase, `${pathname} recommended`);
      assert.equal(document.nextPurchase?.routeId, 'api-codex-key-pack-100');
      assert.equal(document.keyPackUpgradeOffer?.routeId, 'api-codex-key-pack-100');
      assertKeyPackUpgrade(document.keyPackUpgradeOffer, `${pathname} Key Pack upgrade`);
    }
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
  assert.equal(stderr, '');
});

function assertPrimary(offer, label) {
  assert.ok(offer, `${label} exists`);
  for (const [field, value] of Object.entries(expected)) assert.equal(offer[field], value, `${label}.${field}`);
  assert.equal(offer.browserCheckout?.available, true, `${label} browser checkout`);
  assert.match(offer.agentFallback?.firstPaymentClient || '', /\/x402\/first-payment-client\.mjs$/, `${label} agent fallback`);
}

function assertKeyPackUpgrade(offer, label) {
  assert.ok(offer, `${label} exists`);
  assert.equal(offer.routeId, 'api-codex-key-pack-100', `${label}.routeId`);
  assert.equal(offer.paidUrl, 'https://x402-key.558686.xyz/v1/paid/api-codex-key-pack-100', `${label}.paidUrl`);
  assert.equal(offer.checkoutUrl, 'https://x402-key.558686.xyz/x402/checkout', `${label}.checkoutUrl`);
  assert.equal(offer.price, '$11.1112', `${label}.price`);
  assert.equal(offer.amountAtomic, '11111200', `${label}.amountAtomic`);
  assert.equal(offer.deliveryTrial?.routeId, 'api-codex-key-pack-1', `${label}.deliveryTrial.routeId`);
  assert.equal(offer.deliveryTrial?.paidUrl, 'https://x402-key.558686.xyz/v1/paid/api-codex-key-pack-1', `${label}.deliveryTrial.paidUrl`);
  assert.equal(offer.deliveryTrial?.quoteUrl, 'https://x402-key.558686.xyz/x402/quote/api-codex-key-pack-1', `${label}.deliveryTrial.quoteUrl`);
  assert.equal(offer.deliveryTrial?.paymentActivation, 'https://x402-key.558686.xyz/x402/route/api-codex-key-pack-1/payment-activation.json', `${label}.deliveryTrial.paymentActivation`);
  assert.equal(offer.deliveryTrial?.firstPaymentClient, 'https://x402-key.558686.xyz/x402/route/api-codex-key-pack-1/first-payment-client.mjs', `${label}.deliveryTrial.firstPaymentClient`);
  assert.equal(offer.deliveryTrial?.price, '$0.12', `${label}.deliveryTrial.price`);
  assert.equal(offer.deliveryTrial?.amountAtomic, '120000', `${label}.deliveryTrial.amountAtomic`);
  assert.equal(offer.deliveryTrial?.trialPaymentCreditsCommercialPack, false, `${label}.deliveryTrial.trialPaymentCreditsCommercialPack`);
  assert.match(offer.deliveryTrial?.nonCreditPolicy || '', /does not reduce/, `${label}.deliveryTrial.nonCreditPolicy`);
  assert.equal(offer.deliveryTrial?.commercialUpgrade?.routeId, 'api-codex-key-pack-100', `${label}.deliveryTrial.commercialUpgrade.routeId`);
  assert.equal(offer.deliveryTrial?.commercialUpgrade?.amountAtomic, '11111200', `${label}.deliveryTrial.commercialUpgrade.amountAtomic`);
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `${url} status`);
  return response.json();
}

async function reservePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

async function waitForHealth(port, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, 'wrapper exited before becoming healthy');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // Retry until the child binds its listener.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail('wrapper did not become healthy');
}
