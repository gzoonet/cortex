# Requirements: User Authentication

## Requirement: Multi-factor Authentication

All user accounts must support optional MFA via TOTP (authenticator app).
SMS-based MFA is explicitly excluded due to SIM-swapping risks.

### Implementation Notes

- Use `speakeasy` library for TOTP generation/verification
- QR codes via `qrcode` library
- Recovery codes: 10 single-use codes generated at setup

## Requirement: Session Management

Sessions expire after 24 hours of inactivity.
Active sessions have a hard limit of 7 days.

### Decision: JWT vs Session Tokens

We chose JWT for API authentication because:
1. Stateless — no session store needed
2. Works across microservices without shared state
3. Mobile app friendly

Trade-off: Cannot revoke individual tokens. Mitigation: short expiry + refresh token rotation.

## Constraint: Password Policy

- Minimum 12 characters
- Must include uppercase, lowercase, and number
- No password reuse for last 5 passwords
- Account lockout after 5 failed attempts (15 minute cooldown)
