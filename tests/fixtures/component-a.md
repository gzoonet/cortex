# Authentication Architecture

## Decision: JWT Tokens for Auth

We decided to use JWT (JSON Web Tokens) for authentication in the BookFlow platform.
JWTs allow stateless authentication which simplifies horizontal scaling.
The token expiry is set to 15 minutes with refresh tokens valid for 7 days.
