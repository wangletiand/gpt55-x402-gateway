import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import net from 'node:net';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const canonicalHub = 'https://gpt55.558686.xyz/x402/service';
const repositoryUrl = 'https://github.com/wangletiand/gpt55-x402-gateway';
const repositoryGitUrl = `${repositoryUrl}.git`;
const standardPaidUrl = 'https://gpt55.558686.xyz/v1/chat/completions/standard';
const primaryPaidUrl = standardPaidUrl;
const walletPaidUrl = 'https://gpt55.558686.xyz/v1/tools/evm-wallet-balance';
const keyPackPaidUrl = 'https://x402-key.558686.xyz/v1/paid/api-codex-key-pack-100';

test('wrapper serves the current minimal catalog when the upstream is unavailable', async () => {
  const port = await reservePort();
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      REMOTE_BASE_URL: 'http://127.0.0.1:1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  try {
    await waitForHealth(port, child);
    const [guide, pricing] = await Promise.all([
      fetchJson(`http://127.0.0.1:${port}/buyer-guide.json`),
      fetchJson(`http://127.0.0.1:${port}/pricing.json`),
    ]);

    assertCanonicalEntry(guide);
    assert.equal(guide.primaryCommercialOffer.routeId, 'standard-chat');
    assert.equal(guide.primaryCommercialOffer.paidUrl, primaryPaidUrl);
    assert.equal(guide.primaryCommercialOffer.price, '$0.00293');
    assert.equal(guide.primaryCommercialOffer.amountAtomic, '2930');
    assert.equal(guide.quickstart.recommendedFirstRouteId, 'standard-chat');
    assert.equal(guide.quickstart.spendCapUsd, 0.00293);
    assert.equal(guide.standardChatAlternative.routeId, 'standard-chat');
    assert.equal(guide.standardChatAlternative.paidUrl, standardPaidUrl);
    assert.equal(guide.keyPackUpgradeOffer.routeId, 'api-codex-key-pack-100');

    assertCanonicalEntry(pricing);
    assert.deepEqual(
      pricing.endpoints.map(({ id, path, price, amountAtomic }) => ({ id, path, price, amountAtomic })),
      [
        { id: 'main-model-standard', path: '/v1/chat/completions/standard', price: '$0.00293', amountAtomic: '2930' },
        { id: 'evm-wallet-balance', path: '/v1/tools/evm-wallet-balance', price: '$0.001', amountAtomic: '1000' },
        { id: 'api-codex-key-pack-100', path: '/v1/paid/api-codex-key-pack-100', price: '$11.1112', amountAtomic: '11111200' },
        { id: 'x402-ping', path: '/v1/x402-ping', price: '$0.002', amountAtomic: '2000' },
        { id: 'gpt-5.5', path: '/v1/chat/completions/gpt-5.5', price: '$0.019999', amountAtomic: '19999' },
      ],
    );
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }

  assert.equal(stderr, '');
});

test('wrapper replaces stale Key Pack primaries in successful remote catalogs', async () => {
  const staleKeyPackPrimary = {
    routeId: 'api-codex-key-pack-100',
    method: 'GET',
    paidUrl: keyPackPaidUrl,
    checkoutUrl: 'https://x402-key.558686.xyz/x402/checkout',
    price: '$11.1112',
    amountAtomic: '11111200',
  };
  const remoteCatalog = {
    service: 'Remote catalog sentinel',
    repository: {
      url: 'https://github.com/legacy-owner/legacy-repository.git',
      webUrl: 'https://github.com/legacy-owner/legacy-repository',
    },
    canonicalUrl: 'https://legacy.invalid/catalog',
    startUrl: 'https://legacy.invalid/start',
    applyUrl: 'https://legacy.invalid/apply',
    buyUrl: 'https://legacy.invalid/buy',
    startApplyBuyUrl: 'https://legacy.invalid/checkout',
    currency: 'USD',
    endpoints: [{ id: 'remote-sentinel', path: '/remote-sentinel', price: '$1.23' }],
    primaryCommercialOffer: { ...staleKeyPackPrimary },
    demandFirstOffer: { ...staleKeyPackPrimary },
    firstPurchase: { ...staleKeyPackPrimary },
    recommendedFirstPurchase: { ...staleKeyPackPrimary },
    buyerPaths: [
      { ...staleKeyPackPrimary, id: 'api-codex-key-pack-100' },
      { id: 'remote-standard', routeId: 'standard-chat', paidUrl: 'https://legacy.invalid/standard' },
      { id: 'remote-secondary', routeId: 'remote-secondary', paidUrl: 'https://legacy.invalid/secondary' },
    ],
    primaryRouteId: staleKeyPackPrimary.routeId,
    primaryPaidUrl: staleKeyPackPrimary.paidUrl,
    keyPackUpgradeOffer: {
      ...staleKeyPackPrimary,
      remoteExtension: 'preserved-upgrade-extension',
      deliveryTrial: { remoteTrialExtension: 'preserved-trial-extension' },
    },
  };
  const remote = createServer((req, res) => {
    const found = req.url === '/pricing.json' || req.url === '/buyer-guide.json';
    const body = JSON.stringify(remoteCatalog);
    res.writeHead(found ? 200 : 404, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
  });
  remote.listen(0, '127.0.0.1');
  await once(remote, 'listening');

  const port = await reservePort();
  const remotePort = remote.address().port;
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      REMOTE_BASE_URL: `http://127.0.0.1:${remotePort}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  try {
    await waitForHealth(port, child);
    for (const pathname of ['/buyer-guide.json', '/pricing.json']) {
      const catalog = await fetchJson(`http://127.0.0.1:${port}${pathname}`);
      assertCanonicalEntry(catalog);
      assert.equal(catalog.startUrl, canonicalHub);
      assert.equal(catalog.applyUrl, canonicalHub);
      assert.equal(catalog.buyUrl, canonicalHub);
      assert.equal(catalog.service, remoteCatalog.service);
      assert.deepEqual(catalog.endpoints, remoteCatalog.endpoints);
      assert.equal(catalog.primaryCommercialOffer.routeId, 'standard-chat');
      assert.equal(catalog.firstPurchase.routeId, 'standard-chat');
      assert.equal(catalog.recommendedFirstPurchase.routeId, 'standard-chat');
      assert.equal(catalog.buyerPaths[0].routeId, 'standard-chat');
      assert.equal(catalog.buyerPaths[0].paidUrl, standardPaidUrl);
      assert.equal(catalog.buyerPaths[1].routeId, 'evm-wallet-balance');
      assert.equal(catalog.buyerPaths[1].paidUrl, walletPaidUrl);
      assert.equal(catalog.buyerPaths.filter(({ routeId }) => routeId === 'evm-wallet-balance').length, 1);
      assert.equal(catalog.buyerPaths.filter(({ routeId }) => routeId === 'standard-chat').length, 1);
      assert.equal(catalog.buyerPaths.find(({ routeId }) => routeId === 'remote-secondary')?.paidUrl, 'https://legacy.invalid/secondary');
      assert.equal(catalog.primaryRouteId, 'standard-chat');
      assert.equal(catalog.primaryPaidUrl, primaryPaidUrl);
      assert.equal(catalog.standardChatAlternative.routeId, 'standard-chat');
      assert.equal(catalog.standardChatAlternative.paidUrl, standardPaidUrl);
      assert.equal(catalog.keyPackUpgradeOffer.routeId, 'api-codex-key-pack-100');
      assert.equal(catalog.keyPackUpgradeOffer.remoteExtension, 'preserved-upgrade-extension');
      assert.equal(catalog.keyPackUpgradeOffer.deliveryTrial.remoteTrialExtension, 'preserved-trial-extension');
    }
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2_000))]);
    remote.close();
    await once(remote, 'close');
  }

  assert.equal(stderr, '');
});

test('checked-in discovery metadata routes canonical buyer actions through the hub', async () => {
  const [serverJson, packageJson] = await Promise.all([
    readJson('server.json'),
    readJson('package.json'),
  ]);

  assert.equal(serverJson.repository.url, repositoryGitUrl);
  assert.equal(serverJson.repository.webUrl, repositoryUrl);
  assert.equal(serverJson.websiteUrl, canonicalHub);
  for (const field of ['canonicalUrl', 'startUrl', 'applyUrl', 'buyUrl', 'startApplyBuyUrl']) {
    assert.equal(serverJson[field], canonicalHub, `${field} must use the canonical hub`);
  }
  for (const mode of Object.values(serverJson.purchaseModes)) {
    assert.equal(mode.recommendedFirstUrl, canonicalHub);
  }
  for (const buyerPath of serverJson.buyerPaths) {
    assert.equal(buyerPath.startApplyBuyUrl, canonicalHub);
  }
  assert.equal(
    serverJson.buyerPaths.find(({ id }) => id === 'api-codex-key-pack-100').paidUrl,
    keyPackPaidUrl,
  );
  assert.deepEqual(findUnsafePrivateKeyCommands(serverJson), []);
  assert.equal(packageJson.homepage, canonicalHub);
});

function assertCanonicalEntry(value) {
  assert.equal(value.repository.url, repositoryGitUrl);
  assert.equal(value.repository.webUrl, repositoryUrl);
  assert.equal(value.canonicalUrl, canonicalHub);
  assert.equal(value.startApplyBuyUrl, canonicalHub);
}

function findUnsafePrivateKeyCommands(value, path = 'root', matches = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findUnsafePrivateKeyCommands(item, `${path}[${index}]`, matches));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      findUnsafePrivateKeyCommands(item, `${path}.${key}`, matches);
    }
  } else if (
    typeof value === 'string'
    && /(?:EVM_PRIVATE_KEY|PRIVATE_KEY)\s*=/.test(value)
  ) {
    matches.push(path);
  }
  return matches;
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
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
