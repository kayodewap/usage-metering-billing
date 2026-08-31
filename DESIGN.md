# Usage Metering & Billing System — Design

## 1. Overview

This project is a usage metering and billing system for tracking tenant usage, enforcing plan quotas, calculating billing information, and integrating Stripe for subscription and payment synchronization.

The system is designed around:

- Tenants
- Plans
- Subscriptions
- Usage events
- Billing
- Invoices
- Stripe integration
- Stripe webhook processing

The application uses Node.js, Express, and PostgreSQL.

---

## 2. Architecture

The application follows a layered architecture:

Client

↓

Routes

↓

Validation

↓

Services

↓

PostgreSQL / Stripe

### Routes

Routes are responsible for handling HTTP requests and responses.

### Validation

Validation is responsible for validating incoming request data using Express Validator.

### Services

Services contain application business logic and database operations.

The services include:

- Subscription management
- Usage metering
- Billing calculation
- Invoice retrieval
- Stripe customer management
- Stripe subscription management
- Stripe webhook processing

### PostgreSQL

PostgreSQL is responsible for persistent data storage, relationships, uniqueness constraints, transactions, and data consistency.

### Stripe

Stripe is used as the external payment provider for:

- Stripe customers
- Stripe subscriptions
- Subscription status
- Stripe invoices
- Payment events

The local database maintains the application's internal representation of tenant, subscription, usage, billing, and invoice information.

---

## 3. Database

The database is PostgreSQL.

Current tables include:

- tenants
- plans
- subscriptions
- usage_events
- webhook_events
- invoices

### Tenants

A tenant represents a customer using the system.

A tenant contains identifying information such as:

- id
- name
- email
- created_at

### Plans

Plans define the usage limits and pricing available to a tenant.

Current plans include:

- Free — 1,000 API calls and 100,000 AI tokens
- Pro — 50,000 API calls and 5,000,000 AI tokens

Plans contain:

- name
- api_call_quota
- ai_token_quota
- monthly_price
- api_call_overage_price
- ai_token_overage_price
- created_at

Current development pricing:

- Free — $0 monthly
- Pro — $20 monthly
- Pro API overage — $0.01 per additional API call
- Pro AI token overage — $0.00001 per additional AI token

These prices are development values and can be changed as the billing model evolves.

### Subscriptions

A subscription connects a tenant to a plan.

The relationship is:

tenants

↓

subscriptions

↓

plans

A subscription contains:

- tenant_id
- plan_id
- stripe_customer_id
- stripe_subscription_id
- status
- created_at
- updated_at

The subscription service can:

- Create subscriptions
- Retrieve a tenant's active subscription
- Change a tenant's subscription plan
- Retrieve associated plan information
- Retrieve quota information
- Retrieve pricing information

### Usage Events

Usage events record resource consumption by tenants.

Each event contains:

- tenant_id
- type
- quantity
- idempotency_key
- metadata
- created_at

Supported usage types currently include:

- api_call
- ai_tokens

The database enforces uniqueness on:

(tenant_id, idempotency_key)

This prevents the same usage request from being recorded multiple times.

### Webhook Events

The `webhook_events` table stores processed Stripe webhook events.

It contains information such as:

- stripe_event_id
- event_type
- processed_at

The Stripe event ID is used for webhook idempotency.

If Stripe sends the same event more than once, the system detects that the event has already been processed and does not process it again.

### Invoices

The `invoices` table stores Stripe invoice information locally.

Invoice records include:

- tenant_id
- subscription_id
- stripe_invoice_id
- status
- amount_due
- amount_paid
- currency
- period_start
- period_end
- created_at
- updated_at

Stripe invoice events are synchronized into the local database through verified webhooks.

---

## 4. Usage Metering

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

Usage types currently supported by the usage service are:

- api_call
- ai_tokens

The `quantity` field represents how much of the resource was consumed.

### Usage Recording

When usage is recorded, the usage service:

1. Begins a PostgreSQL transaction.
2. Finds the tenant's active subscription.
3. Locks the subscription row.
4. Determines the quota from the tenant's plan.
5. Calculates the tenant's current usage.
6. Checks whether the requested usage would exceed the quota.
7. Records the usage event if the quota allows it.
8. Commits the transaction.

If an error occurs, the transaction is rolled back.

---

## 5. Usage Aggregation

Current usage is calculated from the `usage_events` table.

The usage service calculates the total quantity for:

- tenant
- usage type

For example:

api_call usage =

SUM(quantity)

WHERE tenant_id = X

AND type = 'api_call'

AI token usage is calculated similarly:

SUM(quantity)

WHERE tenant_id = X

AND type = 'ai_tokens'

This allows the system to determine how much of a tenant's quota has already been consumed.

---

## 6. Quota Enforcement

Quota enforcement is performed inside the usage transaction.

The service compares:

current usage + requested quantity

against the quota defined by the tenant's active plan.

If the request would exceed the quota, the usage event is rejected.

The response includes:

- current usage
- quota
- remaining quota
- requested quantity

The request does not create a usage event when the quota is exceeded.

The subscription row is locked during the transaction to help prevent concurrent usage requests from bypassing quota enforcement.

For example:

If a tenant has:

Quota: 1,000 API calls

Current usage: 1,000

Requested usage: 1

The request is rejected with:

- current usage: 1,000
- quota: 1,000
- remaining: 0
- requested: 1

---

## 7. Idempotency

There are two separate idempotency mechanisms in the system.

### Usage Idempotency

Usage events use an idempotency key to prevent duplicate usage from being recorded.

The database enforces uniqueness on:

(tenant_id, idempotency_key)

The usage service uses:

ON CONFLICT (tenant_id, idempotency_key)
DO NOTHING

This protects the system when a client retries the same request.

A duplicate request does not create another usage event.

The API returns:

- duplicate: true

when the same usage request has already been recorded.

### Stripe Webhook Idempotency

Stripe webhook events use:

stripe_event_id

Before processing a webhook, the system checks whether the event ID already exists in `webhook_events`.

If it exists:

- the event is not processed again
- the transaction is committed
- the API returns `duplicate: true`

This prevents duplicate Stripe deliveries from causing duplicate database operations.

---

## 8. Validation

Express Validator is used to validate API input.

Usage validation currently checks:

- tenant_id must be a positive integer
- type is required
- type must not exceed 50 characters
- quantity must be at least 1
- idempotency_key is required
- idempotency_key must not exceed 255 characters
- metadata must be an object when provided

Invalid request data returns:

HTTP 400

A non-existent tenant returns:

HTTP 404

A tenant without an active subscription returns:

HTTP 404

An unsupported usage type returns:

HTTP 400

A quota-exceeded request returns:

HTTP 403

Unexpected server or database errors return:

HTTP 500

---

## 9. Transactions and Data Consistency

Usage recording uses PostgreSQL transactions.

The transaction begins before subscription and usage checks are performed.

If all checks succeed:

BEGIN

↓

Check subscription

↓

Lock subscription

↓

Calculate usage

↓

Check quota

↓

Insert usage event

↓

COMMIT

If an error occurs:

ROLLBACK

This ensures that a failed usage request does not leave a partially completed operation in the database.

The subscription row is locked during the transaction to improve consistency when multiple usage requests are processed concurrently for the same tenant.

Stripe webhook processing also uses a database transaction.

The webhook flow is:

BEGIN

↓

Check webhook event

↓

Reject duplicate if already processed

↓

Process Stripe event

↓

Update local database

↓

Record webhook event

↓

COMMIT

If processing fails:

ROLLBACK

This prevents partially processed webhook events from being recorded as successfully completed.

---

## 10. Billing

The billing system combines subscription pricing with usage information.

Billing information is calculated by the billing service.

The billing service retrieves:

- Active subscription
- Plan
- Monthly price
- API usage
- AI token usage
- API quota
- AI token quota
- Remaining quota
- Usage percentages
- Overage information
- Billing total

### Billing Summary

The billing summary is available through:

GET /billing/:tenantId

The response contains:

- tenant information
- subscription information
- plan information
- API usage
- AI token usage
- remaining quotas
- usage percentages
- overage quantities
- overage unit prices
- overage costs
- monthly price
- total billing amount

### Billing Calculation

The current billing calculation is:

Total = Monthly Price + API Overage Cost + AI Token Overage Cost

Usage within the included quota does not generate an additional charge.

For API calls:

API Overage = max(API Usage - API Quota, 0)

API Overage Cost = API Overage × API Overage Price

For AI tokens:

AI Token Overage = max(AI Token Usage - AI Token Quota, 0)

AI Token Overage Cost = AI Token Overage × AI Token Overage Price

The final amount is:

Total = Monthly Price
      + API Overage Cost
      + AI Token Overage Cost

### Current Implementation Note

The current usage service treats quotas as hard limits and rejects usage that would exceed the quota.

Therefore, overage billing is currently calculated by the billing service but cannot be reached through normal usage recording while hard quota enforcement is active.

A future architectural decision can determine whether the system should:

1. Keep quotas as hard limits, or
2. Treat quotas as included usage and allow additional usage to generate overage charges.

The implementation should be changed only after this decision is made.

---

## 11. Stripe Integration

Stripe is integrated as the external payment provider.

The intended relationship is:

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

The local database remains responsible for application-specific tenant, usage, subscription, billing, and invoice data.

Stripe remains the external source of truth for payment-related events.

### Stripe Configuration

Stripe configuration is loaded from environment variables:

STRIPE_SECRET_KEY

STRIPE_WEBHOOK_SECRET

STRIPE_PRO_PRICE_ID

The application does not require Stripe credentials to start when Stripe is not configured.

The Stripe configuration module checks whether a valid Stripe secret key is available before creating the Stripe client.

### Stripe Customer Creation

The application can create a Stripe customer for a tenant.

The customer is created using tenant information such as:

- name
- email

The tenant ID is also stored in Stripe customer metadata.

The resulting Stripe customer ID is saved in the local subscription record.

If the subscription already contains a Stripe customer ID, the operation returns the existing customer instead of creating another one.

### Stripe Subscription Creation

The application can create a Stripe subscription for a tenant.

The flow is:

Tenant

↓

Local Subscription

↓

Stripe Customer

↓

Stripe Subscription

The configured Stripe Pro price is used when creating the Stripe subscription.

The resulting Stripe subscription ID is stored in the local subscription record.

If a Stripe subscription already exists for the local subscription, another Stripe subscription is not created.

---

## 12. Stripe Webhooks

Stripe webhooks are handled through:

POST /webhooks/stripe

The webhook route uses the raw request body because Stripe signature verification requires the original request payload.

The flow is:

Stripe

↓

POST /webhooks/stripe

↓

Read Stripe signature

↓

Verify signature

↓

Process event

↓

Update PostgreSQL

### Signature Verification

The webhook handler obtains:

stripe-signature

from the request headers.

Stripe's SDK verifies the event using:

- raw request body
- Stripe signature
- STRIPE_WEBHOOK_SECRET

Invalid signatures return:

HTTP 400

This prevents forged requests from modifying local subscription or invoice data.

### Webhook Idempotency

Before processing an event, the webhook service checks:

stripe_event_id

against the `webhook_events` table.

If the event has already been processed, the system returns:

duplicate: true

and does not process the event again.

### Subscription Events

The webhook service handles subscription lifecycle events including:

- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- customer.subscription.paused
- customer.subscription.resumed

Subscription update events synchronize the local subscription status.

For example:

Stripe subscription updated

↓

Verified webhook

↓

Find local subscription

↓

Update local status

### Invoice Events

The webhook service handles invoice events including:

- invoice.created
- invoice.finalized
- invoice.paid
- invoice.payment_failed
- invoice.payment_action_required
- invoice.voided
- invoice.marked_uncollectible

Invoice information is synchronized into the local `invoices` table.

The local invoice record is identified using:

stripe_invoice_id

If an invoice already exists, the existing record is updated instead of creating a duplicate.

### Payment Events

The webhook service also recognizes payment-related events including:

- payment_intent.succeeded
- payment_intent.payment_failed

These events are currently logged and processed through the webhook pipeline.

### Unknown Events

Unknown Stripe event types are safely ignored after being recorded as processed webhook events.

---

## 13. Invoices

Invoices are synchronized from Stripe webhook events into PostgreSQL.

The local invoice record contains:

- tenant_id
- subscription_id
- stripe_invoice_id
- status
- amount_due
- amount_paid
- currency
- period_start
- period_end
- created_at
- updated_at

Invoice amounts received from Stripe are converted from Stripe's smallest currency unit into the application's stored monetary representation.

Invoice records use the Stripe invoice ID as their unique external identifier.

### Invoice API

Invoices can be retrieved for a tenant.

The API supports:

- retrieving a single invoice
- listing tenant invoices
- filtering by status
- filtering by date range
- pagination

Example:

GET /invoices/:tenantId

Example with pagination:

GET /invoices/:tenantId?page=1&limit=20

Example with status:

GET /invoices/:tenantId?status=paid

Example with date range:

GET /invoices/:tenantId?from=2025-01-01&to=2025-12-31

---

## 14. Current API

### Health Check

GET /health

Used to verify that the API is running.

### Create Tenant

POST /tenants

Creates a new tenant.

### Create Subscription

POST /subscriptions

Creates a subscription connecting a tenant to a plan.

### Get Tenant Subscription

GET /subscriptions/:tenantId

Returns the tenant's active subscription and associated plan information.

### Change Subscription

PATCH /subscriptions/:tenantId

Changes the tenant's subscription plan.

### Create Stripe Customer

POST /subscriptions/:tenantId/stripe-customer

Creates a Stripe customer for a tenant and stores the Stripe customer ID locally.

### Create Stripe Subscription

POST /subscriptions/:tenantId/stripe-subscription

Creates a Stripe subscription using the configured Stripe Pro price.

### Record Usage

POST /usage

Records a usage event for a tenant while enforcing the tenant's plan quota and idempotency rules.

### Billing Summary

GET /billing/:tenantId

Returns the tenant's current subscription, plan, usage, quota, remaining quota, overage information, and calculated billing total.

### Stripe Webhook

POST /webhooks/stripe

Receives and verifies Stripe webhook events and synchronizes relevant payment and subscription information into PostgreSQL.

### Get Invoice

GET /invoices/:tenantId/:invoiceId

Returns a specific invoice belonging to a tenant.

### List Invoices

GET /invoices/:tenantId

Returns invoices for a tenant with support for filtering and pagination.

---

## 15. Development

Nodemon is used during development so that the server automatically restarts when source files change.

Development server:

npm run dev

Environment configuration is stored in `.env`.

The `.env` file must not be committed to Git.

The application currently uses:

- Node.js
- Express
- PostgreSQL
- pg
- Express Validator
- dotenv
- Stripe SDK

Stripe integration is designed for Stripe test mode.

The project does not require real payment processing or real money.

When Stripe credentials are unavailable, the application safely reports that Stripe is not configured rather than attempting to make Stripe API calls.

---

## 16. Automated Testing

The project uses Jest for automated testing.

The test suite currently covers:

- API health check
- Usage recording
- Usage validation
- Invalid usage types
- Invalid quantities
- Missing idempotency keys
- Usage idempotency
- Billing summary
- Missing active subscriptions
- Invoice retrieval
- Invoice filtering
- Invoice pagination
- Stripe webhook signature verification
- Stripe webhook processing
- Duplicate Stripe webhook events
- Stripe webhook processing failures

Current test result:

Test Suites: 5 passed, 5 total

Tests: 24 passed, 24 total

The Stripe webhook tests use mocked Stripe behavior so that the webhook logic can be tested without requiring live Stripe credentials.

---

## 17. Current Implementation Status

The following components have been implemented:

- PostgreSQL database connection
- Tenant management
- Plans
- Subscriptions
- Subscription management API
- Usage events
- Usage recording
- Usage aggregation
- Express Validator validation
- Usage idempotency
- Transaction-based usage recording
- Subscription row locking
- Plan quota enforcement
- Quota-exceeded handling
- Monthly plan pricing
- API call overage pricing
- AI token overage pricing
- Billing calculation
- Billing summary service
- Billing summary API
- Stripe configuration
- Stripe customer creation
- Stripe subscription creation
- Stripe webhook route
- Stripe webhook signature verification
- Stripe webhook processing
- Stripe webhook idempotency
- Stripe subscription status synchronization
- Stripe invoice synchronization
- Local invoice storage
- Invoice retrieval
- Invoice filtering
- Invoice pagination
- Automated Jest tests
- Nodemon development workflow
- Basic API error handling

The following have been tested successfully:

- Creating tenants
- Creating subscriptions
- Retrieving active subscriptions
- Changing subscriptions
- Recording API usage
- Recording AI token usage
- Rejecting invalid quantities
- Rejecting unsupported usage types
- Rejecting usage for tenants without valid subscriptions
- Enforcing quotas
- Preventing duplicate usage events
- Aggregating usage
- Calculating remaining quota
- Calculating usage percentages
- Calculating base subscription billing
- Returning billing summaries through the API
- Retrieving invoices
- Filtering invoices
- Paginating invoices
- Rejecting missing Stripe signatures
- Rejecting invalid Stripe signatures
- Processing valid Stripe webhook events
- Detecting duplicate Stripe webhook events
- Handling webhook processing failures

The automated test suite currently reports:

5 test suites passed

24 tests passed

---

## 18. Future Components

The following are possible future improvements:

- True Stripe Checkout session flow
- Automatic plan synchronization based on Stripe price IDs
- Automatic invoice generation through Stripe billing cycles
- Usage-period-specific aggregation
- Monthly billing period calculations
- Automated usage alerts at quota thresholds
- Proration for mid-cycle subscription changes
- Stripe/database reconciliation jobs
- Production-grade authentication and authorization
- Rate limiting
- Structured logging
- Production deployment
- Additional integration tests
- API documentation with OpenAPI/Swagger

These are outside the current implemented scope.

---

## 19. Design Principles

The system is designed around the following principles.

### Data Integrity

Important relationships and uniqueness rules are enforced by PostgreSQL.

### Transactional Consistency

Usage recording and Stripe webhook processing use database transactions to prevent partially completed operations.

### Idempotency

Client retries must not result in duplicate usage events.

Stripe webhook retries must not result in duplicate event processing.

### Separation of Responsibilities

Routes handle HTTP concerns.

Validation handles request validation.

Services handle business logic.

PostgreSQL handles persistent storage and database constraints.

Stripe handles external payment operations.

### Tenant Isolation

Tenant-specific queries are scoped using tenant IDs so that one tenant cannot access another tenant's usage, subscription, billing, or invoice records.

### Extensibility

The system supports multiple usage types and is designed so additional resource types can be introduced later.

### External Payment Isolation

Stripe is treated as an external payment provider rather than the source of truth for internal usage metering.

Local usage and application-specific billing data remain under the application's control.

Verified Stripe webhook events are used to synchronize payment-related state into the local database.

### Correctness Over Complexity

The system intentionally keeps the core architecture small while protecting the most important billing invariants:

- Usage must not be double-counted.
- Quota checks must be consistent.
- Stripe webhook events must be verified.
- Stripe webhook events must be idempotent.
- Tenant data must remain isolated.
- Database changes must be transactional.