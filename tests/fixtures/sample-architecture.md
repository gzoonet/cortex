# Architecture Decision: Payment Processing

## Decision

We chose **Stripe** as the payment processor for BookFlow based on its Connect platform capabilities for marketplace payments.

### Requirements

- Must support marketplace split payments
- PCI compliance required
- Must handle subscription billing
- International currency support needed

### Alternatives Considered

1. **Square** — Better for in-person, but weak marketplace support
2. **PayPal Commerce** — Higher fees, less developer-friendly
3. **Adyen** — Enterprise-focused, overkill for our scale

### Constraints

- Monthly processing volume under $500K initially
- Need to support both US and EU merchants
- Must integrate with React Native mobile app

## Action Items

- [ ] Set up Stripe Connect account for marketplace
- [ ] Implement webhook handler for payment events
- [ ] Add subscription billing for premium tier
- [ ] Review PCI compliance checklist

## Risk

If Stripe raises fees above 3.5%, we may need to evaluate alternatives.
The current rate is 2.9% + $0.30 per transaction.
