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
const primaryPaidUrl = 'https://x402-key.558686.xyz/v1/paid/api-codex-key-pack-100';

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
    assert.equal(guide.primaryCommercialOffer.routeId, 'api-codex-key-pack-100');
    assert.equal(guide.primaryCommercialOffer.paidUrl, primaryPaidUrl);
    assert.equal(guide.primaryCommercialOffer.price, '$11.1112');
    assert.equal(guide.primaryCommercialOffer.amountAtomic, '11111200');

    assertCanonicalEntry(pricing);
    assert.deepEqual(
      pricing.endpoints.map(({ id, path, price, amountAtomic }) => ({ id, path, price, amountAtomic })),
      [
        { id: 'api-codex-key-pack-100', path: '/v1/paid/api-codex-key-pack-100', price: '$11.1112', amountAtomic: '11111200' },
        { id: 'x402-ping', path: '/v1/x402-ping', price: '$0.002', amountAtomic: '2000' },
        { id: 'main-model-standard', path: '/v1/chat/completions/standard', price: '$0.00293', amountAtomic: '2930' },
        { id: 'gpt-5.5', path: '/v1/chat/completions/gpt-5.5', price: '$0.019999', amountAtomic: '19999' },
      ],
    );
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }

  assert.equal(stderr, '');
});

test('wrapper normalizes repository and buyer CTAs in successful remote pricing', async () => {
  const remotePricing = {
    service: 'Remote pricing sentinel',
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
  };
  const remote = createServer((req, res) => {
    const body = JSON.stringify(remotePricing);
    res.writeHead(req.url === '/pricing.json' ? 200 : 404, {
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
    const pricing = await fetchJson(`http://127.0.0.1:${port}/pricing.json`);
    assertCanonicalEntry(pricing);
    assert.equal(pricing.startUrl, canonicalHub);
    assert.equal(pricing.applyUrl, canonicalHub);
    assert.equal(pricing.buyUrl, canonicalHub);
    assert.equal(pricing.service, remotePricing.service);
    assert.deepEqual(pricing.endpoints, remotePricing.endpoints);
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
    primaryPaidUrl,
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
