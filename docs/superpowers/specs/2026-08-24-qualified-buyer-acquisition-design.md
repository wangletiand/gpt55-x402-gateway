# Qualified Buyer Acquisition Design

**Goal:** Increase qualified discovery and first-purchase intent for the GPT55 x402 product without changing payment semantics or counting non-buyer traffic as revenue.

## Evidence

- The production 24-hour funnel has thousands of quote requests but zero buyer-intent quotes, payment headers, verify events, settles, or external deliveries.
- External search results for `x402 GPT API` are dominated by competing pages; the maintained GPT55 repository is not consistently returned for the exact buyer problem.
- Existing assets are accurate but distribute the buyer across a service hub, a canary, a model checkout, and a separate wallet utility. A search visitor needs one problem statement, one runnable example, and one canonical purchase path.

## Design

1. Add one static, indexable guide for the exact intent `x402 GPT API` and `OpenAI-compatible GPT API with Base USDC`. It will explain the product boundary, show the unauthenticated quote request, show the buyer-owned payment retry contract, and link to the canonical production checkout.
2. Add a small FAQ with factual answers about price, network, keys, settlement, and delivery. FAQ text will not claim usage, reviews, rankings, or revenue.
3. Add `llms.txt`, `robots.txt`, and `sitemap.xml` to the GitHub Pages mirror. These files expose only owned public URLs and preserve the production domain as the canonical payment surface.
4. Update README and the Pages index with the same canonical facts and direct guide link. Existing product and directory URLs remain unchanged.

## Non-goals

- No price, payTo, route, settlement middleware, or wallet configuration changes.
- No paid directory placement, backlink purchase, account creation, duplicate submission, or fabricated social proof.
- No self-payment. Revenue remains defined only by a non-self payer with verify, settle, on-chain settlement, and successful delivery.

## Verification

- Static tests assert canonical facts and cross-link convergence.
- GitHub Pages build succeeds and public guide/robots/sitemap/llms URLs return 200.
- Production service hub and guide remain 200 and contain the same route, amount, network, asset, and checkout URL.
- A fresh production funnel summary still reports external revenue separately from probes; only a real non-self settlement can change that metric.
