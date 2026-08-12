# Wallet-Primary Standard-Alternative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the minimal public buyer repository with the live Wallet-first offer while preserving Standard chat as a supported alternative.

**Architecture:** One shared Wallet primary offer and one Standard alternative feed checked-in metadata and wrapper fallback normalization. The quote-first client uses local route policies and builds the Wallet query URL only from validated public inputs.

**Tech Stack:** Node.js 20+, native `node:test`, JSON discovery documents, Markdown/HTML documentation.

## Global Constraints

- Keep `https://gpt55.558686.xyz/x402/service` as the canonical start/apply/buy URL.
- Keep payTo `0x1f0130669ca6fd02e025a984cc038f139df19a2f` and canonical Base USDC unchanged.
- Keep Wallet at `$0.001`, Standard at `$0.00293`, and Key Pack 100 at `$11.1112`.
- Never publish a private key, seed, payment header, credential, production log, or internal channel ledger.
- Do not make a canary payment for this release.

---

### Task 1: Public Offer Convergence

**Files:**
- Modify: `tests/public-offer-convergence.test.mjs`
- Modify: `tests/fallback-catalog.test.mjs`
- Modify: `server.mjs`
- Modify: `server.json`
- Modify: `scripts/update-public-primary-metadata.mjs`

**Interfaces:**
- Produces: `primaryCommercialOffer` for Wallet and `standardChatAlternative` for Standard in every public catalog.

- [ ] **Step 1: Write failing assertions** for Wallet route, method, price, amount, checkout, and Standard alternative preservation.
- [ ] **Step 2: Run `node --test tests/public-offer-convergence.test.mjs tests/fallback-catalog.test.mjs`** and confirm failure on the current `standard-chat` primary.
- [ ] **Step 3: Add the two offer constants and normalize buyer paths** in Wallet, Standard, unrelated-remote order without duplicate primary routes.
- [ ] **Step 4: Run the two tests** and confirm all assertions pass.

### Task 2: Trusted Wallet Quote Client

**Files:**
- Modify: `tests/trusted-payment-policy.test.mjs`
- Modify: `examples/x402-first-payment-client/trusted-payment-policy.mjs`
- Modify: `examples/x402-first-payment-client/first-payment-client.mjs`
- Modify: `examples/x402-first-payment-client/.env.example`
- Modify: `examples/x402-first-payment-client/README.md`

**Interfaces:**
- Produces: `getTrustedRoutePolicy(routeId, inputs)` for Wallet and Standard, with exact URL/query matching.

- [ ] **Step 1: Add failing tests** requiring a Wallet policy, valid address/network URL construction, invalid input rejection, and continued Standard support.
- [ ] **Step 2: Run `node --test tests/trusted-payment-policy.test.mjs`** and confirm failure because the Wallet policy is absent.
- [ ] **Step 3: Implement the minimal validated policy builder** and make Wallet the default client route without changing settlement validation.
- [ ] **Step 4: Rerun the policy test** and confirm the full suite passes.

### Task 3: Human and Machine Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/index.html`
- Modify: `docs/demand-first-checkout.md`
- Modify: `scripts/test-demand-first-discovery-guide.mjs`

**Interfaces:**
- Produces: one consistent Wallet-first, Standard-alternative buyer contract with no secrets.

- [ ] **Step 1: Change the guide test first** to require both products and exact public contract values.
- [ ] **Step 2: Run `node scripts/test-demand-first-discovery-guide.mjs`** and confirm it fails on the Standard-only guide.
- [ ] **Step 3: Update README, Pages, and the execution guide** with Wallet browser/Base MCP/agent commands plus the Standard alternative.
- [ ] **Step 4: Rerun the guide test and publication safety test** and confirm both pass.

### Task 4: Release and Production Operations Sync

**Files:**
- GitHub: only the minimal public repository changes above.
- Production: the 12 previously verified operational registry, ledger, recorder, generator, and test files.

**Interfaces:**
- Consumes: clean public commit and source-tree SHA256 manifest.
- Produces: fast-forward GitHub `main`, matching production target hashes, and post-sync revenue/public readbacks.

- [ ] **Step 1: Run `npm test`** from the isolated public worktree.
- [ ] **Step 2: Commit and push `HEAD:main` without force**, then read back GitHub `main` and raw machine assets.
- [ ] **Step 3: Create a timestamped production backup** containing every existing target plus a manifest of missing targets.
- [ ] **Step 4: Copy the 12 source-tree files to production**, run the recorder, regenerate the ledger, and execute the related tests without restarting the gateway.
- [ ] **Step 5: Compare source and production SHA256 values**, run `npm run revenue:now --silent`, and read back CDP/Agentic.Market metadata.
- [ ] **Step 6: Keep the persistent Goal active** unless a distinct non-test payer has settlement success, HTTP 200 delivery, and a matching receipt.
