# Auth System Notes

## JSON Web Tokens Decision

The team decided on JWT-based authentication for BookFlow.
Using JSON Web Tokens means authentication is stateless and sessions
don't need to be stored server-side, which simplifies our infrastructure.
Short-lived access tokens (15min) with rotating refresh tokens (7 days).
