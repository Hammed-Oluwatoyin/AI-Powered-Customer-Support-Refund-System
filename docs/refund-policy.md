# Refund Policy

This is the source of truth for how refund requests are decided. The numbers are
mirrored in [`backend/src/config/policy.constants.ts`](../backend/src/config/policy.constants.ts)
and the rules are implemented by the pure `RulesEngineService` in
[`backend/src/policy/rules-engine.service.ts`](../backend/src/policy/rules-engine.service.ts).

The AI never decides. It extracts what the customer is asking for and writes the
reply. The decision always comes from these rules, applied to order data read from
the database, never to amounts, dates or items the customer claims.

## Rules

| Rule | Name | Policy | Outcome |
|------|------|--------|---------|
| **P1** | Refund window | Requests must be made within 30 days of delivery. | Denied |
| **P2** | Final sale | Items marked final sale are never refundable. | Denied, or excluded (see partial refunds) |
| **P3** | Human review threshold | Any refund whose eligible amount exceeds $500 is escalated. | Escalated |
| **P4** | One refund per item | Items already refunded cannot be refunded again. | Denied, or excluded (see partial refunds) |
| **P5** | Delivery required | Orders not yet delivered cannot be refunded for damage or a wrong item. Claims that conflict with the order status (e.g. "damaged" on an undelivered order, "not received" on a delivered one) are escalated. | Escalated |
| **P6** | Qualifying reasons | `damaged`, `wrong_item`, `not_as_described` and `changed_mind` are eligible within the window. | Approved |
| **P7** | Ownership | The order must belong to the requesting customer's email. Mismatches are escalated as suspicious. | Escalated |
| **P8** | Suspicious activity | Customers with 3 or more refunds in the last 60 days are escalated. Suspected prompt injection is escalated. | Escalated |
| **P9** | Low confidence | If AI extraction confidence is below 0.6, escalate. | Escalated |

**Partial refunds:** in mixed orders, final-sale items (P2) and already-refunded items
(P4) are excluded and only the remaining items are refunded. The request is denied only
when nothing refundable is left.

## Evaluation order

Rules are checked in this fixed order. The first rule that denies or escalates decides
the outcome; P4 and P2 may also just exclude items and let evaluation continue.

1. **P7** Ownership
2. **AI failure.** If extraction failed (error, timeout or invalid output), escalate.
3. **P8** Suspected prompt injection
4. **P4** Already refunded (exclude, or deny if nothing remains)
5. **P2** Final sale (exclude, or deny if nothing remains)
6. **P1** Refund window
7. **P5** Delivery status conflicts
8. **P8** Refund frequency
9. **P9** Low confidence
10. **P3** Amount threshold
11. **P6** Qualifying reason: approve, otherwise escalate

## Clarifications

These resolve cases the rules above leave open. The guiding principle: when the
policy does not clearly cover a case, a human decides.

- **Boundaries.** Exactly 30 days after delivery is inside the window. Exactly $500.00
  is not escalated; $500.01 is. A confidence of exactly 0.6 is accepted. Exactly 3
  recent refunds escalates.
- **What counts toward P3.** The threshold applies to the eligible amount after P4/P2
  exclusions, not to the order total.
- **What counts toward P8.** Approved refund requests (by the policy or by an admin)
  for the same email in the 60 days before the request.
- **P1 applies only to delivered orders**, because the window is measured from delivery.
  Refunds on orders that are still processing or shipped are always escalated under P5,
  whatever the reason: item-condition claims conflict with the status, and anything else
  (a cancellation, a lost parcel) needs a person.
- **AI failure is checked right after P7.** Otherwise a failed extraction could still be
  denied by a later rule, and any AI failure must end in escalation.
- **Reasons outside P6** (`not_received` on a delivered order, `other`) are escalated,
  never denied.
- **Bad data** (a delivered order without a delivery date, an order with no items) is
  escalated.
- **Emails** are compared case-insensitively.

## Handled before the policy runs

Some requests cannot be evaluated yet, so they never reach the rules:

- **No matching account or order.** The customer gets a generic "we couldn't locate an
  account or order with those details" reply that does not reveal whether the email
  exists.
- **No order specified and several eligible orders.** The customer is asked which order
  they mean (status `NEEDS_INFO`). If they have exactly one eligible order, it is used.

## Who sees what

- **Customers** see only a polite reply and, when approved, the refund amount. Rule names
  and internal reasons are never shown to them.
- **Staff** see the rules that fired, the reasons, the amount at stake and the full audit
  trail in the admin dashboard, and can approve or deny escalated and `NEEDS_INFO`
  requests.
