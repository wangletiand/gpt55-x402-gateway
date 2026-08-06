import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = publicationCandidates();
const relativeFiles = files.map((file) => path.relative(root, file).replaceAll('\\', '/'));
const oldOwner = ['go', '165'].join('');
const oldOwnerVariants = [
  `github.com/${oldOwner}`,
  `raw.githubusercontent.com/${oldOwner}`,
  `api.github.com/users/${oldOwner}`,
  `api.github.com/repos/${oldOwner}`,
  `${oldOwner}.github.io`,
  `git@github.com:${oldOwner}`,
];
const secretPatterns = [
  { name: 'GitHub token-like value', pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { name: 'private key block', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'EVM private key assignment', pattern: /["']?\s*\b(?:evm[_-]?)?private[_-]?key\b\s*["']?\s*[=:]\s*["']?\s*(?:0x)?[0-9a-f]{64}\b/i },
  { name: 'inline EVM private key placeholder', pattern: /["']?\s*\b(?:evm[_-]?)?private[_-]?key\b\s*["']?\s*[=:]\s*["']?\s*(?:0x)?\.\.\.(?!\.)/i },
  { name: 'AWS access key-like value', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: 'npm authentication token', pattern: /\/\/(?:registry\.)?npmjs\.org\/:_authToken\s*=\s*[^\s$<{][^\s]*/i },
  { name: 'seed phrase assignment', pattern: /(?:mnemonic|seed[_-]?phrase)\s*[=:]\s*["'][^"']{20,}["']/i },
];

const evmPrivateKeyPattern = secretPatterns.find(({ name }) => name === 'EVM private key assignment').pattern;
const evmPlaceholderPattern = secretPatterns.find(({ name }) => name === 'inline EVM private key placeholder').pattern;
const sampleEvmPrivateKey = `0x${'ab'.repeat(32)}`;
const sampleEvmPrivateKeyWithoutPrefix = 'cd'.repeat(32);
const sampleEvmPlaceholder = ['0x', '...'].join('');
assert.equal(evmPrivateKeyPattern.test(`{ "evm_private_key" : "${sampleEvmPrivateKey}" }`), true, 'JSON EVM private keys must be rejected');
assert.equal(evmPrivateKeyPattern.test(`{ "privateKey" : "${sampleEvmPrivateKey}" }`), true, 'camelCase JSON EVM private keys must be rejected');
assert.equal(evmPrivateKeyPattern.test(`{ "private_key" : "${sampleEvmPrivateKeyWithoutPrefix}" }`), true, 'unprefixed JSON EVM private keys must be rejected');
assert.equal(evmPrivateKeyPattern.test(`PRIVATE-KEY=${sampleEvmPrivateKeyWithoutPrefix}`), true, 'hyphenated unprefixed EVM private keys must be rejected');
assert.equal(evmPlaceholderPattern.test(`{ "evm_private_key" : "${sampleEvmPlaceholder}" }`), true, 'JSON EVM private key placeholders must be rejected');
assert.equal(evmPrivateKeyPattern.test('{ "EVM_PRIVATE_KEY": "${EVM_PRIVATE_KEY}" }'), false, 'environment references must remain allowed');
assert.equal(evmPlaceholderPattern.test('{ "EVM_PRIVATE_KEY": "<redacted>" }'), false, 'redacted examples must remain allowed');
assert.equal(evmPrivateKeyPattern.test(`PUBLIC_PRIVATE_KEY=${sampleEvmPrivateKey}`), false, 'public-key variables must remain allowed');
assert.equal(evmPrivateKeyPattern.test(`{ "privateKeyHash": "${sampleEvmPrivateKey}" }`), false, 'private-key hash fields must remain allowed');

assert.equal(
  relativeFiles.includes('examples/x402-first-payment-client/.env.example'),
  true,
  '.env.example must be included in the publication scan',
);
assert.equal(isSensitiveFilename('.env'), true, '.env must be rejected');
assert.equal(isSensitiveFilename('production.env'), true, '*.env must be rejected');
assert.equal(isSensitiveFilename('credentials.json'), true, 'credentials.* must be rejected');
assert.equal(isSensitiveFilename('wallet.seed.json'), true, 'wallet/seed files must be rejected');
assert.equal(isSensitiveFilename('deploy.pem'), true, '*.pem must be rejected');
assert.equal(isSensitiveFilename('.npmrc'), true, '.npmrc must be rejected');
assert.equal(isSensitiveFilename('run.evidence.json'), true, '*.evidence.json must be rejected');
assert.equal(isSensitiveFilename('examples/client/.env.example'), false, '.env.example is a scanned template, not a secret file');

const hyphenatedSensitiveFiles = [
  'credentials-prod.json',
  'secret-prod.json',
  'secrets-backup.json',
  'wallet-prod.json',
  'seed-backup.json',
];
const ignoredSensitiveFiles = new Set(execFileSync(
  'git',
  ['check-ignore', '--no-index', '--stdin'],
  { cwd: root, input: `${hyphenatedSensitiveFiles.join('\n')}\n` },
).toString('utf8').trim().split(/\r?\n/));
assert.deepEqual(ignoredSensitiveFiles, new Set(hyphenatedSensitiveFiles), 'Git ignore must cover hyphenated sensitive files');

const dockerIgnoreLines = new Set(fs.readFileSync(path.join(root, '.dockerignore'), 'utf8').split(/\r?\n/));
for (const pattern of ['credentials-*', 'secret-*', 'secrets-*', 'wallet-*', 'seed-*']) {
  assert.equal(dockerIgnoreLines.has(pattern), true, `.dockerignore must include ${pattern}`);
}

for (const [index, file] of files.entries()) {
  const relative = relativeFiles[index];
  assert.equal(isSensitiveFilename(relative), false, `sensitive filename must not be published: ${relative}`);
  const content = fs.readFileSync(file).toString('utf8');
  for (const variant of oldOwnerVariants) {
    assert.equal(content.toLowerCase().includes(variant.toLowerCase()), false, `old owner URL remains in ${relative}`);
  }
  for (const { name, pattern } of secretPatterns) {
    assert.equal(pattern.test(content), false, `${name} found in ${relative}`);
  }
}

assert.equal(fs.existsSync(path.join(root, 'README.md')), true, 'README.md is required');
assert.equal(fs.existsSync(path.join(root, 'SECURITY.md')), true, 'SECURITY.md is required');
assert.equal(fs.existsSync(path.join(root, 'docs', 'index.html')), true, 'Pages index is required');

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.private, true, 'package must remain non-publishable to npm');
assert.equal(packageJson.repository.url, 'https://github.com/wangletiand/gpt55-x402-gateway.git');

console.log(`publication_safety=ok files=${files.length}`);

function publicationCandidates() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--deduplicate', '-z'],
    { cwd: root },
  );
  return output.toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((file) => path.join(root, file));
}

function isSensitiveFilename(file) {
  const normalized = file.replaceAll('\\', '/').toLowerCase();
  const basename = path.posix.basename(normalized);
  if (basename === '.npmrc' || basename.endsWith('.env')) return true;
  if (basename.startsWith('.env.') && !basename.endsWith('.example')) return true;
  if (/^(?:credentials|secrets?)(?:[._-].*)?$/.test(basename)) return true;
  if (/^(?:wallet|seed)(?:[._-].*)?$/.test(basename) || /\.seed(?:[._-].*)?$/.test(basename)) return true;
  if (/\.(?:pem|key|p12|pfx|jks|keystore|log|bak)$/.test(basename)) return true;
  if (/\.evidence\.json$/.test(basename)) return true;
  if (/^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/.test(basename)) return true;
  return false;
}
