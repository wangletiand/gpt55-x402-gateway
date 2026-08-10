# Demand-First Standard Checkout

This is the shortest supported path from discovery to one useful result. The
first purchase is one OpenAI-compatible GPT-5.6 Luna Standard response, not a
quota commitment:

| Field | Live contract |
| --- | --- |
| Checkout | <https://gpt55.558686.xyz/x402/service?checkout=standard-chat> |
| Paid request | `POST https://gpt55.558686.xyz/v1/chat/completions/standard` |
| Price | `$0.00293` (`2930` atomic USDC) |
| Network and asset | Base `eip155:8453`, canonical USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Recipient | `0x1f0130669ca6fd02e025a984cc038f139df19a2f` |
| Delivery | JSON `id`, `model`, `choices`, `usage`, and receipt headers |

The live HTTP `402 Payment Required` response is authoritative immediately
before payment. Directory metadata is discovery only; a buyer must verify the
amount, network, asset, recipient, method, and resource URL in that response.

## Browser Wallet

Open the checkout URL in a browser with an injected Base wallet and choose
**Pay with browser wallet**. The wallet signs the exact USDC authorization in
the browser. A private key never leaves the buyer's wallet or runtime. The
checkout retries the same `POST` request and exposes the receipt after a
successful settlement.

## Base MCP

Base MCP buyers can use its x402 flow with a tight cap. The first call reads
the live quote; the second completes the approved request:

```text
initiate_x402_request(
  url="https://gpt55.558686.xyz/v1/chat/completions/standard",
  method="POST",
  maxPayment="0.003",
  body={"model":"gpt-5.6-sol","messages":[{"role":"user","content":"Say hello in one sentence."}]}
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
ROUTE_ID=main-model-standard MAX_USDC=0.003 npm run first-payment:quote
```

The quote response uses `PAYMENT-REQUIRED`. A payment-capable client signs
locally, retries the **same request** with `PAYMENT-SIGNATURE` (or
`X-PAYMENT`), and accepts delivery only after HTTP 200, a successful settlement
response, and `x-x402-receipt-id` plus `x-x402-receipt-url`.

## Directory State

The canonical endpoint is also self-registered on 402 Index:

- Service card: <https://402index.io/service/915a39de-ce9a-4294-be23-21f15c3dca99>
- Registered alias: <https://gpt55.558686.xyz/v1/chat/completions/standard?listing=demand-first-standard-00293>
- Canonical service hub: <https://gpt55.558686.xyz/x402/service>

402 Index's Bazaar v2 record uses the live x402 v2 fields (`accepts[].amount`
and the top-level/resource description). Older cards may still show v1 field
names or stale URL-derived copy, so buyers and directory operators must
re-fetch the canonical endpoint before paying. x402Scout is not treated as a
current source while its public registration path returns HTTP 503.

This document describes the public buyer contract only. It contains no wallet
seed, private key, payment header, or credential.
