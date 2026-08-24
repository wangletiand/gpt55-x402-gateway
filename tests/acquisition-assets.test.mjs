import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const hub = 'https://gpt55.558686.xyz/x402/service';
const guide = 'x402-gpt-api-guide.html';
const facts = [
  /x402 GPT API/i,
  /OpenAI-compatible/i,
  /GPT-5\.6 Luna Standard/i,
  /\$0\.00293/i,
  /2930/i,
  /eip155:8453/i,
  /Base USDC/i,
  /\/v1\/chat\/completions\/standard/,
  /browser wallet/i,
  /quote-first/i,
];

test('owned acquisition assets expose one truthful buyer path', async () => {
  const [readme, index, guideHtml, llms, robots, sitemap] = await Promise.all([
    read('README.md'),
    read('docs/index.html'),
    read(`docs/${guide}`),
    read('docs/llms.txt'),
    read('docs/robots.txt'),
    read('docs/sitemap.xml'),
  ]);

  for (const [label, content] of [['README', readme], ['Pages index', index], ['Guide', guideHtml], ['llms', llms]]) {
    for (const pattern of facts) assert.match(content, pattern, `${label} must contain ${pattern}`);
    assert.match(content, new RegExp(hub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} canonical hub`);
    assert.doesNotMatch(content, /private key\s*[:=]\s*0x[0-9a-f]{64}/i, `${label} must not expose a private key`);
  }
  assert.match(readme, new RegExp(guide));
  assert.match(index, new RegExp(guide));
  assert.match(robots, /Sitemap:\s*https:\/\/wangletiand\.github\.io\/gpt55-x402-gateway\/sitemap\.xml/i);
  assert.match(robots, /Allow:\s*\/gpt55-x402-gateway\/x402-gpt-api-guide\.html/i);
  assert.match(sitemap, /<loc>https:\/\/wangletiand\.github\.io\/gpt55-x402-gateway\/x402-gpt-api-guide\.html<\/loc>/i);
  assert.match(sitemap, /<loc>https:\/\/gpt55\.558686\.xyz\/x402\/service<\/loc>/i);
});

async function read(path) {
  return fs.readFile(new URL(path, root), 'utf8');
}
