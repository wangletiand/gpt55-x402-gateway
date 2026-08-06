# x402 First Payment Client

This buyer-owned client quotes the GPT55 main model route and can optionally
perform one Base USDC x402 payment. It never sends a private key to the service.

## Quote-Only

From the repository root:

```bash
npm install
ROUTE_ID=main-model-standard MAX_USDC=0.003 npm run first-payment:quote
```

Quote-only is the default. A successful check reports:

- `paymentAttempted: false`
- `paymentAuthorized: false`
- `settled: false`
- `decision.safeToPay: true` only when every locally pinned field matches

The only supported payment policy is:

- URL: `https://gpt55.558686.xyz/v1/chat/completions/standard`
- Method: `POST`
- Scheme: `exact`
- Network: `eip155:8453`
- Asset: canonical Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Merchant: `0x1f0130669ca6fd02e025a984cc038f139df19a2f`
- Amount: `2930` atomic USDC (`$0.00293`)

Remote catalogs are discovery metadata only and cannot change this policy.
The client rejects non-finite or non-positive `MAX_USDC` values.

## Real Payment

Real payment is explicit and must run in a buyer-controlled environment:

```bash
PAY_REAL_X402=1 ROUTE_ID=main-model-standard MAX_USDC=0.003 EVM_PRIVATE_KEY=$EVM_PRIVATE_KEY npm run first-payment:quote
```

The process reports success only when all of these are present:

- a successful HTTP response;
- a successful SDK settlement response with a Base transaction hash;
- `x-x402-receipt-id` and a trusted `x-x402-receipt-url` from the service.

HTTP `402`, HTTP `500`, a missing or failed SDK settlement response, or missing
service receipt headers produce `ok: false` evidence and a nonzero exit code.

Evidence defaults to `last-run.evidence.json` and is ignored by Git. Disable
evidence writes for automation with:

```bash
EVIDENCE_FILE=0 npm run first-payment:quote
```

Quote-only and owner-funded self-tests are not external revenue.
