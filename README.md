# GPT55 x402 Gateway

Start with one **$0.001 USDC EVM Wallet Balance Snapshot** for a public Base or
Ethereum address. The primary paid route is
`GET https://gpt55.558686.xyz/v1/tools/evm-wallet-balance`.

GPT-5.6 Luna Standard remains available as the model alternative at
`POST https://gpt55.558686.xyz/v1/chat/completions/standard` for **$0.00293
USDC**. The $11.1112 Key Pack remains the upgrade for repeated calls.

Open the service hub and use **Pay with browser wallet** from an injected Base
wallet. The wallet signs only the exact live USDC authorization; no private key
is sent to the service. The quote-first buyer client in this repository remains
the agent fallback.

Canonical service entry:

- Service hub: <https://gpt55.558686.xyz/x402/service>
- Machine-readable catalog: <https://gpt55.558686.xyz/x402/service.json>
- Wallet route: `GET https://gpt55.558686.xyz/v1/tools/evm-wallet-balance`
- Wallet checkout: <https://gpt55.558686.xyz/x402/service?checkout=evm-wallet-balance>
- Standard alternative: <https://gpt55.558686.xyz/x402/service?checkout=standard-chat>
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
EVM_ADDRESS=0x1111111111111111111111111111111111111111 EVM_NETWORK=base MAX_USDC=0.001 npm run first-payment:quote
```

Standard remains selectable with
`ROUTE_ID=main-model-standard MAX_USDC=0.003 npm run first-payment:quote`.

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
