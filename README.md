# Usage Metering & Billing System

A backend API for tracking tenant usage, enforcing subscription quotas, calculating billing, managing invoices, and integrating with Stripe for payment-related operations.

The system is built with Node.js, Express, and PostgreSQL.

---

## 1. Overview

The Usage Metering & Billing System is designed to manage:

- Tenants
- Plans
- Subscriptions
- Usage events
- Usage quotas
- Billing calculations
- Invoices
- Stripe customers
- Stripe subscriptions
- Stripe webhook processing
- Webhook idempotency

The application follows a layered architecture:

    Client
      ↓
    Routes
      ↓
    Validation
      ↓
    Services
      ↓
    PostgreSQL

### Architecture Responsibilities

**Routes**

Routes are responsible for handling HTTP requests and responses.

**Validation**

Validation is responsible for validating incoming request data using Express Validator.

**Services**

Services contain application business logic and database operations.

**PostgreSQL**

PostgreSQL is responsible for persistent data storage and enforcing database constraints.

---

## 2. Tech Stack

- Node.js
- Express
- PostgreSQL
- pg
- Express Validator
- dotenv
- Stripe SDK
- Jest
- Supertest
- Nodemon

---

## 3. Project Structure

    usage-metering-billing/
    │
    ├── src/
    │   ├── config/
    │   │   └── stripe.js
    │   │
    │   ├── db/
    │   │   └── database.js
    │   │
    │   ├── routes/
    │   │   ├── billing-routes.js
    │   │   ├── invoice-routes.js
    │   │   ├── stripe-webhook-routes.js
    │   │   ├── subscription-routes.js
    │   │   ├── tenant-routes.js
    │   │   └── usage-routes.js
    │   │
    │   ├── services/
    │   │   ├── billing-service.js
    │   │   ├── invoice-service.js
    │   │   ├── stripe-customer-service.js
    │   │   ├── stripe-subscription-service.js
    │   │   ├── stripe-webhook-service.js
    │   │   ├── subscription-service.js
    │   │   ├── subscription-validation.js
    │   │   └── usage-service.js
    │   │
    │   └── app.js
    │
    ├── tests/
    │   ├── billing.test.js
    │   ├── health.test.js
    │   ├── invoice.test.js
    │   ├── stripe-webhook.test.js
    │   └── usage.test.js
    │
    ├── DESIGN.md
    ├── package.json
    ├── package-lock.json
    └── .env

---

## 4. Core Concepts

### Tenants

A tenant represents a customer or organization using the system.

Each tenant can have:

- An ID
- A name
- An email
- A subscription
- Usage records
- Billing information

The relationship is:

    Tenant
      ↓
    Subscription
      ↓
    Plan

Tenants are the main owners of usage and billing data.

### Plans

Plans define the limits and pricing available to tenants.

Current plans include:

#### Free

- 1,000 API calls
- 100,000 AI tokens
- $0 monthly price

#### Pro

- 50,000 API calls
- 5,000,000 AI tokens
- $20 monthly price

Development overage pricing:

- API calls: $0.01 per additional API call
- AI tokens: $0.00001 per additional AI token

These values are development pricing and can be changed as the billing model evolves.

### Subscriptions

A subscription connects a tenant to a plan.

    Tenants
       ↓
    Subscriptions
       ↓
    Plans

A subscription contains information such as:

- tenant_id
- plan_id
- status
- stripe_customer_id
- stripe_subscription_id
- created_at
- updated_at

The subscription service supports:

- Creating subscriptions
- Retrieving active subscriptions
- Changing subscriptions
- Retrieving the associated plan
- Retrieving quota information
- Retrieving pricing information

### Usage Events

Usage events record resource consumption by tenants.

Supported usage types:

    api_call
    ai_tokens

Each usage event contains:

- tenant_id
- type
- quantity
- idempotency_key
- metadata
- created_at

The database enforces uniqueness on:

    (tenant_id, idempotency_key)

This prevents the same usage request from being recorded more than once.

---

## 5. Usage Metering

Usage is recorded through:

    POST /usage

The request flow is:

    POST /usage
          ↓
    Express Validator
          ↓
    Usage Route
          ↓
    Usage Service
          ↓
    PostgreSQL

When usage is recorded, the service:

1. Begins a PostgreSQL transaction.
2. Finds the tenant's active subscription.
3. Locks the subscription row.
4. Determines the tenant's plan.
5. Determines the applicable quota.
6. Calculates current usage.
7. Checks whether the requested usage exceeds the quota.
8. Records the usage event.
9. Commits the transaction.

If an error occurs, the transaction is rolled back.

---

## 6. Quota Enforcement

The system currently treats plan quotas as hard limits.

The service compares:

    current usage + requested quantity

against:

    plan quota

If the request would exceed the quota, it is rejected.

The response includes:

- Current usage
- Quota
- Remaining quota
- Requested quantity

Example:

    Quota: 1,000 API calls
    Current usage: 1,000
    Requested: 1

The request is rejected because no quota remains.

The subscription row is locked during the transaction to improve consistency when multiple usage requests are processed concurrently for the same tenant.

---

## 7. Usage Aggregation

Current usage is calculated from the `usage_events` table.

For API calls:

    SUM(quantity)
    WHERE tenant_id = X
    AND type = 'api_call'

For AI tokens:

    SUM(quantity)
    WHERE tenant_id = X
    AND type = 'ai_tokens'

This allows the billing service to determine:

- Current usage
- Remaining quota
- Usage percentage
- Overage quantity
- Billing amount

---

## 8. Idempotency

Usage requests use an idempotency key.

The database enforces:

    UNIQUE (tenant_id, idempotency_key)

The usage service uses:

    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING

This protects the system against duplicate requests caused by:

- Network retries
- Client retries
- Duplicate API requests
- Request timeouts

If a usage request has already been recorded, the API returns:

    {
      "duplicate": true
    }

No additional usage event is created.

---

## 9. Validation

Express Validator is used for request validation.

Usage validation checks:

- `tenant_id` must be a positive integer
- `type` is required
- `type` must not exceed 50 characters
- `quantity` must be at least 1
- `idempotency_key` is required
- `idempotency_key` must not exceed 255 characters
- `metadata` must be an object when provided

Typical HTTP responses:

| Situation | Status |
|---|---:|
| Invalid request | 400 |
| Tenant not found | 404 |
| No active subscription | 404 |
| Unsupported usage type | 400 |
| Quota exceeded | 403 |
| Unexpected server/database error | 500 |

---

## 10. Billing

The billing service calculates the tenant's current billing information.

Billing information includes:

- Tenant
- Subscription
- Plan
- Monthly price
- API usage
- AI token usage
- API quota
- AI token quota
- Remaining quota
- Usage percentages
- Overage quantities
- Overage prices
- Overage costs
- Total billing amount

Billing summary endpoint:

    GET /billing/:tenantId

### Billing Calculation

The current calculation is:

    Total =
    Monthly Price
    + API Overage Cost
    + AI Token Overage Cost

API overage:

    max(API Usage - API Quota, 0)

API overage cost:

    API Overage × API Overage Price

AI token overage:

    max(AI Token Usage - AI Token Quota, 0)

AI token overage cost:

    AI Token Overage × AI Token Overage Price

### Important Billing Note

The current usage service treats quotas as hard limits.

Therefore, normal usage recording rejects usage beyond the quota.

The billing service already contains overage calculations, but overage charges cannot currently be reached through normal usage recording while hard quota enforcement is active.

A future architectural decision can change the system to either:

1. Keep quotas as hard limits, or
2. Treat quotas as included usage and allow additional usage to generate overage charges.

---

## 11. Invoices

The system contains invoice functionality for storing and retrieving billing invoices.

Invoices are associated with:

- Tenant
- Subscription
- Stripe invoice ID
- Invoice status
- Amount due
- Amount paid
- Currency
- Billing period start
- Billing period end

Stripe invoice events can update local invoice records.

---

## 12. Stripe Integration

Stripe has been integrated into the application architecture.

Stripe is treated as an external payment provider.

The expected relationship is:

    Tenant
       ↓
    Local Subscription
       ↓
    Stripe Customer
       ↓
    Stripe Subscription
       ↓
    Stripe Invoice
       ↓
    Payment

The local PostgreSQL database remains responsible for application-specific:

- Tenants
- Subscriptions
- Usage
- Quotas
- Billing information
- Invoices
- Webhook event tracking

Stripe is responsible for payment-related operations.

---

## 13. Stripe Configuration

Stripe configuration is loaded from environment variables.

Expected variables:

    STRIPE_SECRET_KEY=
    STRIPE_WEBHOOK_SECRET=
    STRIPE_PRO_PRICE_ID=

The application safely handles Stripe being unavailable or unconfigured.

If Stripe is not configured, Stripe-dependent endpoints return:

    503 Service Unavailable

with an appropriate error message.

Stripe test credentials should be used during development.

Stripe integration has been implemented and tested through mocked automated tests.

A real Stripe account and live Stripe credentials are not required for the automated test suite.

### Nigeria Availability Note

Stripe account availability depends on the country supported by Stripe for business onboarding.

Because Stripe does not currently provide standard direct merchant account onboarding for businesses based in Nigeria, live Stripe payment processing cannot be treated as a currently available production payment option for a Nigeria-based business without an eligible supported-country setup.

The application therefore keeps Stripe integration isolated from the core usage metering and billing logic.

The Stripe integration can still be developed and tested using mocked Stripe API interactions.

If a supported payment provider is selected for production in Nigeria, it can be integrated without changing the core tenant, usage, quota, and billing architecture.

---

## 14. Stripe Customer Management

A Stripe customer can be created for a tenant using:

    POST /subscriptions/:tenantId/stripe-customer

The service:

1. Checks that Stripe is configured.
2. Finds the tenant.
3. Finds the tenant's subscription.
4. Checks whether a Stripe customer already exists.
5. Creates the customer in Stripe if necessary.
6. Stores the Stripe customer ID locally.

Stripe customer metadata contains:

    tenant_id

If the tenant already has a Stripe customer, the API returns:

    {
      "duplicate": true
    }

---

## 15. Stripe Subscription Management

A Stripe subscription can be created using:

    POST /subscriptions/:tenantId/stripe-subscription

The service:

1. Checks Stripe configuration.
2. Checks the Stripe Pro price configuration.
3. Finds the tenant's local subscription.
4. Checks that a Stripe customer exists.
5. Creates the Stripe subscription.
6. Stores the Stripe subscription ID locally.

If a Stripe subscription already exists, the request returns the existing subscription instead of creating another one.

---

## 16. Stripe Webhooks

Stripe webhook processing is implemented through:

    POST /webhooks/stripe

The webhook route uses:

    express.raw({ type: "application/json" })

This is required so that Stripe's webhook signature can be verified against the raw request body.

The route verifies:

- Stripe configuration
- Webhook secret
- Stripe signature

Invalid signatures return:

    400 Bad Request

Successful processing returns:

    200 OK

Processing failures return:

    500 Internal Server Error

---

## 17. Supported Stripe Webhook Events

The webhook service handles subscription events including:

    customer.subscription.created
    customer.subscription.updated
    customer.subscription.deleted
    customer.subscription.paused
    customer.subscription.resumed

Invoice events include:

    invoice.created
    invoice.finalized
    invoice.paid
    invoice.payment_failed
    invoice.payment_action_required
    invoice.voided
    invoice.marked_uncollectible

Checkout events include:

    checkout.session.completed

Payment intent events include:

    payment_intent.succeeded
    payment_intent.payment_failed

Unknown Stripe events are safely ignored and logged.

---

## 18. Webhook Idempotency

Stripe may send the same webhook event more than once.

The system prevents duplicate processing using the:

    webhook_events

table.

Before processing an event, the system checks:

    stripe_event_id

If the event already exists, it returns:

    {
      "duplicate": true
    }

Otherwise, the event is processed and stored locally.

The event is recorded only after successful processing.

The webhook processing flow is:

    Stripe
      ↓
    Webhook Endpoint
      ↓
    Verify Signature
      ↓
    Check Existing Event
      ↓
    Process Event
      ↓
    Store Event ID
      ↓
    COMMIT

If processing fails:

    ROLLBACK

This provides transactional webhook processing.

---

## 19. Stripe Invoice Synchronization

Stripe invoice events are synchronized with the local database.

The webhook service searches for the local subscription using:

    stripe_customer_id

or:

    stripe_subscription_id

The invoice is then stored or updated in the local `invoices` table.

Invoice records use the Stripe invoice ID as the unique identifier.

This allows repeated Stripe invoice events to update the same local invoice instead of creating duplicate invoices.

---

## 20. Transactions and Data Consistency

Usage recording uses PostgreSQL transactions.

The flow is:

    BEGIN
      ↓
    Check Subscription
      ↓
    Lock Subscription
      ↓
    Calculate Usage
      ↓
    Check Quota
      ↓
    Insert Usage Event
      ↓
    COMMIT

If an error occurs:

    ROLLBACK

Webhook processing also uses transactions:

    BEGIN
      ↓
    Check Event
      ↓
    Process Stripe Event
      ↓
    Store Event
      ↓
    COMMIT

If processing fails:

    ROLLBACK

This ensures that related database operations remain consistent.

---

## 21. API Endpoints

### Health Check

    GET /health

Checks whether the API is running.

### Tenants

    POST /tenants

Creates a new tenant.

### Subscriptions

Create a subscription:

    POST /subscriptions

Get a tenant's active subscription:

    GET /subscriptions/:tenantId

Change a tenant's subscription:

    PATCH /subscriptions/:tenantId

### Stripe Customer

Create a Stripe customer for a tenant:

    POST /subscriptions/:tenantId/stripe-customer

### Stripe Subscription

Create a Stripe subscription for a tenant:

    POST /subscriptions/:tenantId/stripe-subscription

### Usage

Record tenant usage:

    POST /usage

### Billing

Get billing summary:

    GET /billing/:tenantId

### Invoices

Invoice functionality is available through the invoice routes.

### Stripe Webhook

Receive Stripe webhook events:

    POST /webhooks/stripe

---

## 22. Example Usage Request

    {
      "tenant_id": 1,
      "type": "api_call",
      "quantity": 10,
      "idempotency_key": "request-001",
      "metadata": {
        "endpoint": "/api/users"
      }
    }

Example AI token usage:

    {
      "tenant_id": 1,
      "type": "ai_tokens",
      "quantity": 500,
      "idempotency_key": "ai-request-001",
      "metadata": {
        "model": "example-model"
      }
    }

---

## 23. Development

Install dependencies:

    npm install

Create the environment file:

    touch .env

Configure the required database environment variables and optional Stripe variables.

Start the development server:

    npm run dev

Run the test suite:

    npm test

---

## 24. Testing

The project uses Jest and Supertest.

Current test suites include:

    tests/health.test.js
    tests/usage.test.js
    tests/billing.test.js
    tests/invoice.test.js
    tests/stripe-webhook.test.js

The automated test suite covers:

- Health endpoint
- Usage recording
- Usage validation
- Unsupported usage types
- Quantity validation
- Missing idempotency keys
- Usage idempotency
- Subscription validation
- Quota enforcement
- Billing calculations
- Billing summaries
- Invoice functionality
- Stripe webhook signature validation
- Stripe webhook processing
- Stripe webhook duplicate detection
- Stripe webhook processing failures

Current test result:

    Test Suites: 5 passed, 5 total
    Tests:       24 passed, 24 total

The Stripe tests use mocks and therefore do not require a live Stripe account.

---

## 25. Database Tables

The main database tables are:

    tenants
    plans
    subscriptions
    usage_events
    webhook_events
    invoices

Relationships:

    tenants
       │
       └── subscriptions
              │
              └── plans

    tenants
       │
       └── usage_events

    subscriptions
       │
       └── invoices

    webhook_events
       │
       └── Stripe event tracking

---

## 26. Error Handling

The API uses consistent HTTP status codes.

### 400 Bad Request

Used for:

- Invalid request data
- Invalid IDs
- Unsupported usage types
- Invalid Stripe webhook signatures

### 403 Forbidden

Used when usage exceeds the tenant's quota.

### 404 Not Found

Used when tenants, subscriptions, plans, or other required resources cannot be found.

### 409 Conflict

Used for database uniqueness conflicts such as attempting to create a conflicting active subscription.

### 500 Internal Server Error

Used for unexpected application or database failures.

### 503 Service Unavailable

Used when Stripe-dependent functionality is requested without Stripe configuration.

---

## 27. Environment Variables

Example:

    DATABASE_URL=postgresql://username:password@localhost:5432/database_name

    STRIPE_SECRET_KEY=
    STRIPE_WEBHOOK_SECRET=
    STRIPE_PRO_PRICE_ID=

The `.env` file must not be committed to Git.

Stripe credentials must never be hard-coded into the source code or committed to the repository.

---

## 28. Security Considerations

The application follows several security principles:

- Environment variables are used for secrets.
- `.env` is excluded from Git.
- Stripe webhook signatures are verified.
- Raw webhook request bodies are used for signature verification.
- Database transactions protect critical operations.
- Subscription rows are locked during quota checks.
- Idempotency prevents duplicate usage events.
- Stripe webhook IDs prevent duplicate event processing.
- Database constraints enforce important relationships and uniqueness rules.

---

## 29. Current Implementation Status

Implemented:

- PostgreSQL database connection
- Tenant management
- Plan management
- Subscription management
- Subscription API
- Usage events
- Usage recording
- Usage aggregation
- Usage validation
- Usage idempotency
- PostgreSQL transactions
- Subscription row locking
- Quota enforcement
- Billing calculation
- Billing summary API
- Invoice functionality
- Stripe configuration
- Stripe customer creation
- Stripe subscription creation
- Stripe webhook endpoint
- Stripe webhook signature verification
- Stripe webhook processing
- Stripe webhook idempotency
- Stripe invoice synchronization
- Automated tests

Automated testing currently passes:

    5 test suites passed
    24 tests passed

---

## 30. Design Principles

### Data Integrity

Important relationships and uniqueness rules are enforced by PostgreSQL.

### Transactional Consistency

Critical operations use PostgreSQL transactions.

### Idempotency

Client retries and repeated Stripe webhook events must not create duplicate records.

### Separation of Responsibilities

Routes handle HTTP concerns.

Validation handles request validation.

Services handle business logic.

PostgreSQL handles persistent storage and database constraints.

Stripe handles external payment operations.

### Extensibility

The system supports multiple usage types and can be extended with additional resource types.

### External Payment Isolation

Stripe is treated as an external payment provider rather than the source of truth for internal usage metering.

Local usage and billing data remain under the application's control.

---

## 31. Future Improvements

Potential future improvements include:

- Automated billing periods
- More advanced usage period management
- Improved overage billing model
- Additional payment provider integration
- Production payment configuration
- Production deployment
- API documentation
- OpenAPI/Swagger documentation
- Authentication and authorization
- Rate limiting
- More comprehensive integration tests
- Improved production logging
- Monitoring and observability
- Automated invoice generation
- Billing history
- Usage reporting and analytics

---

## 32. Project Status

The project currently provides a working backend foundation for a multi-tenant usage metering and billing system.

The core system supports:

    Tenant
      ↓
    Plan
      ↓
    Subscription
      ↓
    Usage
      ↓
    Quota Enforcement
      ↓
    Billing
      ↓
    Invoice
      ↓
    Stripe Integration
      ↓
    Webhook Processing

The automated test suite currently passes all implemented tests.

    5 Test Suites Passed
    24 Tests Passed

The system is structured so that the core usage metering, quota enforcement, billing, and invoice functionality remains independent of any specific external payment provider.

This allows Stripe or another suitable payment provider to be used as the external payment layer without changing the core usage and billing architecture.