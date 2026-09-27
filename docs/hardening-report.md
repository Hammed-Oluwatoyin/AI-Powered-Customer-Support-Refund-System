# Hardening Report (Phase 9)

Checks run against the full Docker stack through nginx (`http://localhost:3000`), plus the
automated unit and e2e suites. Two problems were found and fixed; everything else passed.

## Fresh clone, no cache

| Check | Result |
|-------|--------|
| `git clone` from GitHub, no `.env` present | OK |
| `docker-compose build --no-cache` | OK, 246 s |
| `docker-compose up` | OK in 22 s: Postgres healthy, `migrate` exited 0 (migration + seed), backend and frontend healthy |
| Backend with `LLM_PROVIDER=mock` and no API key | OK: logs "Using the deterministic mock LLM provider" |
| All 15 scenarios through the chat UI (headless Edge) | OK, each with the expected badge and amount, plus Kemi's order follow-up |
| Admin dashboard: key handling, trace a request, resolve an escalation | OK |

## Edge cases

| Case | Result |
|------|--------|
| Empty / whitespace-only message | 400, standard error shape |
| 1001-character message / exactly 1000 | 400 / 201 |
| **Oversized body (300 KB)** | **Was 500. Fixed: now 413** (see below) |
| Non-JSON content type, malformed JSON | 400 |
| NUL character in the message | Stripped, 201 (Postgres cannot store NUL) |
| Emoji, Cyrillic, CJK and right-to-left text | Stored and returned intact; decided normally |
| Duplicate request, one after the other | Approved, then denied (P4) |
| 5 identical requests at the same moment | Exactly one approved; items refunded once |
| Another customer's order ID (in the message or the `orderId` field) | Escalated (P7); the reply reveals nothing about the order |
| HTML / script in the message | Stored as text, never echoed in the reply; React escapes it in the dashboard |
| SQL-looking input | Email rejected by validation; message handled as plain text (Prisma parameterises queries) |
| **Injection hidden with zero-width characters, full-width letters or line breaks** | **Was missed by the heuristics. Fixed: now escalated** (see below) |
| Injection with a fake `</customer_message>` tag | Escalated; the tag is also escaped in the prompt |
| Rate limit with a spoofed `X-Forwarded-For` on every request | 30 accepted, then 429: nginx appends the real client IP and only that hop is trusted |
| Admin API without the header, or with the key in the URL | 401 |
| Response headers | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`; no `X-Powered-By` or nginx version |
| `npm audit` | Frontend 0; backend production dependencies 0. The 4 findings in the full backend tree are in the Prisma CLI's dev tooling, which is not in the runtime image |

## Anthropic provider with an invalid key

Started with `LLM_PROVIDER=anthropic` and a fake `ANTHROPIC_API_KEY`:

- Every request was **escalated, never approved**, in under a second (a 401 is not retried).
- Both AI calls failed (extraction and reply), each recorded as an `ERROR` audit event with
  `provider_error: Anthropic API error 401`; the rules fired were `AI_EXTRACTION_FAILED`
  and `AI_REPLY_FAILED`, and the customer got the safe template reply.
- An unknown email still got the generic not-found reply without any AI call.
- The backend stayed healthy, and the key never appears in the logs.
- `LLM_PROVIDER=anthropic` with no key at all refuses to start, with a clear config error.

## Fixes

### 1. Oversized bodies returned 500 instead of 413

Express's body parser raises its own errors (with `status: 413`), not Nest `HttpException`s,
so the exception filter treated them as unexpected. The filter now keeps the status and safe
message of any 4xx error from the middleware layer. The JSON body limit was also lowered from
100 KB to 16 KB: a valid request is a few KB at most, so anything larger is refused before
it reaches the app. Covered by a unit test on the filter and an e2e test.

### 2. Simple obfuscation got past the injection heuristics

`Ig​nore your rules`, full-width `Ｉｇｎｏｒｅ your rules` and a phrase split across lines
did not match. Messages are now normalised before scanning: NFKC (full-width and other
compatibility characters become plain ones), invisible format characters (zero-width,
soft hyphen, bidi controls) removed, and runs of spaces collapsed; the phrase patterns may
now span line breaks. While adding the regression tests, a false positive was also fixed:
"please ignore the dent on the box, the instructions were fine" no longer matches, because
the gap in the pattern stops at commas.

**Known limitation:** look-alike letters from other alphabets (a Cyrillic "о" in "ignоre")
are not caught by the heuristics. That is what the model's own `injectionSuspected` flag is
for; in mock mode only the heuristics run.
