# Qualified Buyer Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Publish a focused, truthful x402 GPT API buyer guide and machine-readable discovery files that increase qualified search discovery without changing payment behavior.

**Architecture:** The GitHub Pages mirror is a static acquisition layer. It links to the production service hub for all live quotes and payments, while README, HTML, and machine-readable files share one canonical fact set. Production payment and revenue code remain untouched.

**Tech Stack:** Markdown, static HTML, XML, robots directives, plain text, Node.js tests, GitHub Pages.

## Global Constraints

- Canonical product: GPT-5.6 Luna Standard, `$0.00293`, `2930` atomic USDC, Base `eip155:8453`.
- Payment surface: `https://gpt55.558686.xyz/x402/service` and `/v1/chat/completions/standard`.
- Payment must remain buyer-owned; no private keys or payment headers in public files.
- Self-payments, probes, monitors, and crawlers never count as external revenue.
- Do not duplicate-submit or pay for directory placement.

### Task 1: Add Focused Buyer Guide

**Files:**
- Create: `docs/x402-gpt-api-guide.html`
- Modify: `docs/index.html`

- [ ] Add a static guide with title/description targeting `x402 GPT API`, `OpenAI-compatible GPT API`, `Base USDC`, and `pay per call`.
- [ ] Include exact quote-only curl, exact paid route, browser checkout link, and quote-first client link.
- [ ] Add factual FAQ JSON-LD and visible FAQ for price, keys, network, and delivery.
- [ ] Link the guide from the Pages index and link back to the production hub.

### Task 2: Add Machine-Readable Discovery Files

**Files:**
- Create: `docs/llms.txt`
- Create: `docs/robots.txt`
- Create: `docs/sitemap.xml`

- [ ] List only owned public URLs and the canonical production hub.
- [ ] Allow crawlers for the guide and index; do not make claims about ranking or revenue.
- [ ] Include stable `lastmod` dates and no duplicate or tracking URLs in the sitemap.

### Task 3: Align Repository Copy and Tests

**Files:**
- Modify: `README.md`
- Create: `tests/acquisition-assets.test.mjs`
- Modify: `package.json`

- [ ] Add the guide and machine-file links to README without changing existing product URLs.
- [ ] Test that canonical price, route, network, asset, hub, and guide links converge across README, index, guide, and llms file.
- [ ] Add the test to `npm test`.

### Task 4: Publish and Verify

**Files:**
- Modify: none beyond Tasks 1-3

- [ ] Run the focused test and full public repository test suite.
- [ ] Commit and push the public repository to `main`.
- [ ] Verify the GitHub Pages build and read back the new public URLs with GET only.
- [ ] Run production public-asset checks and a fresh `funnel:summary`; report external revenue only if a non-self settlement is present.
