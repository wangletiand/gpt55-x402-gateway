# Wallet-Primary Public Contract Design

## Context

The production gateway and current CDP/Agentic.Market metadata recommend the
`$0.001` EVM Wallet Balance Snapshot, while this public repository still
publishes the `$0.00293` Standard chat route as the only first purchase. Recent
24-hour telemetry shows 35 Wallet quotes from 15 visitors and 744 Standard
quotes from 78 visitors, but neither route has an independent payment header,
settlement, receipt, or delivery. Neither demand hypothesis is proven.

## Options Considered

1. Keep Standard as the only primary. This preserves the repository unchanged
   but leaves it inconsistent with production and public directory metadata.
2. Replace Standard everywhere with Wallet. This removes the inconsistency but
   discards the route with the larger observed quote audience.
3. Make Wallet the low-friction primary and retain Standard as an explicit
   alternative. This matches production without hiding the stronger traffic
   signal, so this is the selected design.

## Public Contract

The primary offer is `GET /v1/tools/evm-wallet-balance` for `1000` atomic Base
USDC. It accepts one public EVM address and a supported network query value;
the buyer private key never leaves the buyer-owned wallet or runtime. The
Standard route remains a first-class alternative at
`POST /v1/chat/completions/standard` for `2930` atomic Base USDC. Key Pack 100
remains the repeat-use upgrade.

The checked-in `server.json`, wrapper fallback documents, README, Pages entry,
and buyer execution guide expose the same ordering and exact contract fields.
Remote catalogs may contribute additional buyer paths, but normalization puts
Wallet first, Standard second, removes duplicates of both, and preserves every
unrelated remote path.

## Buyer Client

The quote-first client supports two local trusted policies. Wallet is the
default policy and builds its request URL from a validated public EVM address
and `base` or `ethereum` network. Standard remains selectable with
`ROUTE_ID=main-model-standard`. Quote validation pins HTTPS origin, pathname,
query, HTTP method, exact Base USDC asset, merchant, network, and amount before
payment. Both routes require HTTP success, a successful settlement response,
and matching service receipt fields before delivery is accepted.

## Operational Boundary

The GitHub repository remains a minimal buyer-facing release. Internal channel
ledgers and production recorders stay in the deployment source tree and are
not restored to GitHub. Existing public URLs, payTo, prices, and the Standard
route remain compatible. No canary payment is required for this release.

## Verification

Tests must first fail against the current Standard-only contract, then cover
checked-in metadata, wrapper fallback normalization, both trusted payment
policies, URL/query validation, documentation safety, and the existing smoke
suite. Production acceptance separately verifies the 12 operational files by
SHA256 and reruns strict revenue attribution. The Goal remains active until an
independent non-test payer produces settlement success, HTTP 200, and a matching
receipt.
