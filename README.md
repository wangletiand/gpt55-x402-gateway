# GPT-5.6 Luna x402 API | GPT55 Gateway

GPT55 provides an OpenAI-compatible **GPT-5.6 Luna Standard** result over
x402 for **$0.00293 USDC on Base**. Buyers can pay one request from a browser
wallet without handing over a private key, or use the quote-first agent
fallback client when a wallet UI is unavailable. The $11.1112 Key Pack remains
the upgrade for repeated calls.

In search terms, this is a **GPT-5.6 Luna API Base USDC** product and an
**OpenAI-compatible x402 chat** endpoint: one `POST` request, one live quote,
and one response. The canonical buyer path is the service hub below.

The EVM Wallet Balance Snapshot remains available as a separate utility
alternative; it is not the model product.

Canonical service entry:

- Service hub: <https://gpt55.558686.xyz/x402/service>
- Machine-readable catalog: <https://gpt55.558686.xyz/x402/service.json>
- Main model route: `POST https://gpt55.558686.xyz/v1/chat/completions/standard`
- Browser checkout: <https://gpt55.558686.xyz/x402/service?checkout=standard-chat>
- Wallet alternative: <https://gpt55.558686.xyz/x402/service?checkout=evm-wallet-balance>
- Key Pack upgrade: <https://x402-key.558686.xyz/x402/checkout>
- MCP endpoint: <https://gpt55.558686.xyz/mcp>

For the exact browser-wallet, Base MCP, agent fallback, receipt, and directory
verification sequence, see [docs/demand-first-checkout.md](docs/demand-first-checkout.md).

## Agent Fallback

The buyer client is quote-only by default. Its local policies pin the exact URL,
HTTP method, amount, Base network, canonical Base USDC contract, and merchant
address for both Wallet and Standard. Remote catalogs are discovery metadata only.
The client does not sign or pay unless the operator explicitly sets
`PAY_REAL_X402=1` and provides a wallet key in the operator-controlled process.

Never paste a private key, seed phrase, payment header, API key, or exchange
credential into a website, chat, issue, log, or remote service.

## Quote-Only Check

```bash
git clone https://github.com/wangletiand/gpt55-x402-gateway.git
cd gpt55-x402-gateway
npm install
ROUTE_ID=standard MAX_USDC=0.00293 npm run first-payment:quote
```

The command remains quote-only unless real payment is explicitly enabled.
Generated evidence files and `.env` files are ignored by Git.

The live quote is authoritative immediately before any payment. For an
OpenAI-compatible request, send the same JSON body to
`/v1/chat/completions/standard` after the x402 client returns a valid paid
retry. The public service hub includes the browser-wallet flow and a link to
the agent fallback client.

## Local MCP Wrapper

```bash
npm install
npm test
npm start
```

The wrapper exposes one local read-only directory tool. It does not proxy MCP
tool calls, custody funds, store wallet keys, or execute payments.

## Repository Scope

This public repository intentionally contains only the maintained runtime
wrapper, buyer safety client, tests, and concise documentation. Operational
logs, payment evidence, wallet files, credentials, internal channel ledgers,
and bulk submission automation are excluded.

## Support and Security

For security reports, follow [SECURITY.md](SECURITY.md). Do not include secrets
or wallet material in a report.

Licensed under the MIT License.
