# API Design Notes

## REST Endpoints

The BookFlow API follows RESTful conventions with JSON:API response format.

### Authentication

All endpoints require JWT bearer tokens. Tokens expire after 24 hours.
Refresh tokens are valid for 30 days.

### Rate Limiting

- Standard users: 100 requests/minute
- Premium users: 500 requests/minute
- API keys: 1000 requests/minute

## Pattern: Repository Pattern

We use the Repository Pattern to abstract data access.
Each domain entity has a corresponding repository interface.

This pattern was chosen over Active Record because:
1. Better testability with dependency injection
2. Cleaner separation of concerns
3. Easier to swap data stores later

## Component: BookingService

The BookingService orchestrates the booking flow:
1. Validate availability
2. Calculate pricing
3. Create hold
4. Process payment via Stripe
5. Confirm booking

It depends on `AvailabilityService`, `PricingEngine`, and `PaymentGateway`.
