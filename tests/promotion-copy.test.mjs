import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

test('public README leads with the current GPT-5.6 Luna purchase', async () => {
  const readme = await fs.readFile(new URL('../README.md', import.meta.url), 'utf8');
  const firstSection = readme.slice(0, readme.indexOf('## Agent Fallback'));

  assert.match(firstSection, /^# GPT-5\.6 Luna x402 API \| GPT55 Gateway/m);
  for (const [label, pattern] of [
    ['OpenAI-compatible', /OpenAI-compatible/i],
    ['GPT-5.6 Luna Standard', /GPT-5\.6 Luna Standard/i],
    ['$0.00293 USDC on Base', /\$0\.00293 USDC on Base/i],
    ['browser wallet', /browser\s+wallet/i],
    ['agent fallback', /agent\s+fallback/i],
  ]) {
    assert.match(firstSection, pattern, `README must expose ${label}`);
  }
  assert.match(readme, /ROUTE_ID=standard MAX_USDC=0\.00293/);
  assert.doesNotMatch(firstSection, /primary paid route is/i, 'Wallet Balance must not remain the lead product');
});

test('GitHub Pages exposes the canonical service hub to search agents', async () => {
  const html = await fs.readFile(new URL('../docs/index.html', import.meta.url), 'utf8');

  assert.match(html, /<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/gpt55\.558686\.xyz\/x402\/service">/i);
  assert.match(html, /<meta property="og:url" content="https:\/\/gpt55\.558686\.xyz\/x402\/service">/i);
  assert.match(html, /<meta name="twitter:card" content="summary">/i);
  assert.match(html, /<script type="application\/ld\+json">[\s\S]*GPT-5\.6 Luna Standard[\s\S]*0\.00293[\s\S]*standard-chat[\s\S]*<\/script>/i);
});
