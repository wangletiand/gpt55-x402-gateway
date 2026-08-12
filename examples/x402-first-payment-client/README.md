# x402 First Payment Client

This buyer-owned client quotes either the `$0.001` EVM Wallet Balance Snapshot
or the `$0.00293` GPT-5.6 Luna Standard route and can optionally perform one
Base USDC x402 payment. It never sends a private key to the service.

## Quote-Only

From the repository root:

```bash
npm install
EVM_ADDRESS=0x1111111111111111111111111111111111111111 EVM_NETWORK=base MAX_USDC=0.001 npm run first-payment:quote
```

To quote Standard chat instead:

```bash
ROUTE_ID=main-model-standard MAX_USDC=0.003 npm run first-payment:quote
```

Quote-only is the default. A successful check reports:

- `paymentAttempted: false`
- `paymentAuthorized: false`
- `settled: false`
- `decision.safeToPay: true` only when every locally pinned field matches

The default Wallet policy is:

- URL: `https://gpt55.558686.xyz/v1/tools/evm-wallet-balance?address=<EVM_ADDRESS>&network=<EVM_NETWORK>`
- Inputs: a public 20-byte EVM address and `base` or `ethereum`
- Method: `GET`
- Amount: `1000` atomic USDC (`$0.001`)

The retained Standard policy is:

- URL: `https://gpt55.558686.xyz/v1/chat/completions/standard`
- Method: `POST`
- Scheme: `exact`
- Network: `eip155:8453`
- Asset: canonical Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Merchant: `0x1f0130669ca6fd02e025a984cc038f139df19a2f`
- Amount: `2930` atomic USDC (`$0.00293`)

Remote catalogs are discovery metadata only and cannot change this policy.
The client rejects invalid Wallet addresses, unsupported lookup networks, and
non-finite or non-positive `MAX_USDC` values. Both policies pin scheme, Base
settlement network, canonical Base USDC, merchant, amount, method, and the full
request URL before payment.

## Real Payment

Real payment is explicit and must run in a buyer-controlled environment:

```bash
PAY_REAL_X402=1 EVM_ADDRESS=0x1111111111111111111111111111111111111111 EVM_NETWORK=base MAX_USDC=0.001 EVM_PRIVATE_KEY=$EVM_PRIVATE_KEY npm run first-payment:quote
```

For Standard, add `ROUTE_ID=main-model-standard` and use `MAX_USDC=0.003`.

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
