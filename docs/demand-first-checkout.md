# Demand-First Wallet Checkout

The low-friction first purchase is one EVM Wallet Balance Snapshot for a public
Base or Ethereum address. It reads public chain state and never needs a buyer
private key:

| Field | Live contract |
| --- | --- |
| Checkout | <https://gpt55.558686.xyz/x402/service?checkout=evm-wallet-balance> |
| Paid request | `GET https://gpt55.558686.xyz/v1/tools/evm-wallet-balance` |
| Public inputs | `EVM_ADDRESS` and `EVM_NETWORK=base` or `ethereum` |
| Price | `$0.001` (`1000` atomic USDC) |
| Network and asset | Base `eip155:8453`, canonical USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Recipient | `0x1f0130669ca6fd02e025a984cc038f139df19a2f` |
| Delivery | Address, network, native balance, USDC balance, readiness fields, and receipt headers |

The live HTTP `402 Payment Required` response is authoritative immediately
before payment. Directory metadata is discovery only; a buyer must verify the
amount, network, asset, recipient, method, and complete resource URL in that
response.

## Browser Wallet

Open the Wallet checkout in a browser with an injected Base wallet and choose
**Pay with browser wallet**. The wallet signs the exact USDC authorization in
the browser. A private key never leaves the buyer's wallet or runtime. The
checkout retries the same request, returns HTTP 200, and exposes the receipt
only after a successful settlement.

## Base MCP

Base MCP buyers can use its x402 flow with a tight cap. The first call reads
the live quote; the second completes the approved request:

```text
initiate_x402_request(
  url="https://gpt55.558686.xyz/v1/tools/evm-wallet-balance?address=0x1111111111111111111111111111111111111111&network=base",
  method="GET",
  maxPayment="0.001"
)
complete_x402_request(requestId="<requestId from the first call>")
```

The buyer should approve only a quote at or below the cap and should require a
successful `PAYMENT-RESPONSE` (or `X-PAYMENT-RESPONSE`) plus the service
receipt before treating the result as delivered.

## Agent Fallback

The repository client is quote-only until the buyer explicitly opts into a
buyer-owned payment runtime:

```bash
npm install @x402/fetch @x402/core @x402/evm viem
EVM_ADDRESS=0x1111111111111111111111111111111111111111 EVM_NETWORK=base MAX_USDC=0.001 npm run first-payment:quote
```

The quote response uses `PAYMENT-REQUIRED`. A payment-capable client signs
locally, retries the **same request** with `PAYMENT-SIGNATURE` (or
`X-PAYMENT`), and accepts delivery only after HTTP 200, a successful settlement
response, and `x-x402-receipt-id` plus `x-x402-receipt-url`.

## Standard Alternative

GPT-5.6 Luna Standard remains available for buyers who need a model result:

| Field | Live contract |
| --- | --- |
| Checkout | <https://gpt55.558686.xyz/x402/service?checkout=standard-chat> |
| Paid request | `POST https://gpt55.558686.xyz/v1/chat/completions/standard` |
| Price | `$0.00293` (`2930` atomic USDC) |

Quote it without payment using:

```bash
ROUTE_ID=main-model-standard MAX_USDC=0.003 npm run first-payment:quote
```

## Directory State

The Standard endpoint retains its existing 402 Index registration for URL and
directory continuity:

- Service card: <https://402index.io/service/915a39de-ce9a-4294-be23-21f15c3dca99>
- Registered alias: <https://gpt55.558686.xyz/v1/chat/completions/standard?listing=demand-first-standard-00293>
- Canonical service hub: <https://gpt55.558686.xyz/x402/service>

402 Index's Bazaar v2 record uses live x402 v2 fields (`accepts[].amount` and
the top-level/resource description). Wallet discovery is also published by the
live service and current CDP/Agentic.Market metadata. Older directory cards may
still show stale copy, so buyers must re-fetch the selected endpoint before
paying.

This document describes the public buyer contract only. It contains no wallet
seed, private key, payment header, or credential.
