# Security Policy

## Reporting

Report security issues privately by email to `ops@400860.xyz`. Do not open a
public issue containing credentials, private keys, seed phrases, payment
headers, API keys, personal data, or unredacted payment evidence.

Include only the minimum reproduction information required: affected route,
request method, sanitized response status, and a description of the impact.
Redact wallet signatures and all secret values.

## Wallet Boundary

The service never needs a buyer's private key. Any optional real-payment mode
in this repository runs locally in the buyer-controlled Node.js process. The
default mode is quote-only and does not sign or broadcast a transaction.

## Supported Surface

Security updates apply to the default branch of this repository and the live
service at `https://gpt55.558686.xyz`.
