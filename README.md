# GPT55 x402 Gateway

This repository contains a small, read-only MCP directory wrapper and a
quote-first buyer client for the public GPT55 x402 service.

Canonical service entry:

- Service hub: <https://gpt55.558686.xyz/x402/service>
- Machine-readable catalog: <https://gpt55.558686.xyz/x402/service.json>
- Main model route: `POST https://gpt55.558686.xyz/v1/chat/completions/standard`
- MCP endpoint: <https://gpt55.558686.xyz/mcp>

## Safety Model

The buyer client is quote-only by default. Its local policy pins the exact URL,
HTTP method, amount, Base network, canonical Base USDC contract, and merchant
address for the main model route. Remote catalogs are discovery metadata only.
The client does not sign or pay unless the operator explicitly sets
`PAY_REAL_X402=1` and provides a wallet key in the operator-controlled process.

Never paste a private key, seed phrase, payment header, API key, or exchange
credential into a website, chat, issue, log, or remote service.

## Quote-Only Check

```bash
git clone https://github.com/wangletiand/gpt55-x402-gateway.git
cd gpt55-x402-gateway
npm install
ROUTE_ID=main-model-standard MAX_USDC=0.003 npm run first-payment:quote
```

The command remains quote-only unless real payment is explicitly enabled.
Generated evidence files and `.env` files are ignored by Git.

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
