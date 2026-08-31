# Usage Metering & Billing System — Design

## 1. Overview

This project is a usage metering and billing system for tracking tenant usage, enforcing plan quotas, and supporting subscription-based billing.

The system is designed around:

- Tenants
- Plans
- Subscriptions
- Usage events
- Billing
- Stripe integration
- Invoices
- Stripe webhooks

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

PostgreSQL

### Routes

Routes are responsible for handling HTTP requests and responses.

### Validation

Validation is responsible for validating incoming request data using Express Validator.

### Services

Services contain application logic and database operations.

### PostgreSQL

PostgreSQL is responsible for persistent data storage and enforcing database constraints.

### Stripe

Stripe is used as the external payment provider for customer management, subscriptions, invoices, and payment-related events.

---

## 3. Database

The database is PostgreSQL.

Current tables:

- tenants
- plans
- subscriptions
- usage_events
- webhook_events
- invoices

### Tenants

A tenant represents a customer using the system.

### Plans

Plans define the usage limits and pricing available to a tenant.

Current plans include:

- Free — 1,000 API calls and 100,000 AI tokens
- Pro — 50,000 API calls and 5,000,000 AI tokens

Plans currently contain:

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

- stripe_customer_id
- stripe_subscription_id
- status
- created_at
- updated_at

The subscription service can:

- Create subscriptions
- Retrieve a tenant's active subscription
- Change a tenant's subscription plan
- Retrieve the associated plan and quota information
- Retrieve plan pricing information

Stripe integration extends the local subscription with:

- Stripe customer creation
- Stripe subscription creation
- Stripe customer ID synchronization
- Stripe subscription ID synchronization
- Stripe subscription status synchronization

### Usage Events

Usage events record resource consumption by tenants.

Each event contains:

- tenant_id
- type
- quantity
- idempotency_key
- metadata
- created_at

The tenant relationship is enforced using a foreign key.

The database also enforces uniqueness on:

(tenant_id, idempotency_key)

Supported usage types currently include:

- api_call
- ai_tokens

### Webhook Events

The `webhook_events` table stores processed Stripe webhook events.

Each Stripe event is recorded using its Stripe event ID.

The event ID is used to provide webhook idempotency.

If Stripe sends the same event more than once, the system detects the existing event and does not process it again.

### Invoices

The `invoices` table stores invoice information received from Stripe.

Invoices are associated with:

- tenant
- local subscription
- Stripe invoice ID

Stored invoice information includes:

- status
- amount_due
- amount_paid
- currency
- period_start
- period_end
- created_at
- updated_at

Stripe invoice events update the local invoice record using the Stripe invoice ID.

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

Usage events use an idempotency key to prevent duplicate usage from being recorded.

The database enforces uniqueness on:

(tenant_id, idempotency_key)

The usage service uses:

ON CONFLICT (tenant_id, idempotency_key) DO NOTHING

This protects the system when a client retries the same request.

A duplicate request does not create another usage event.

The API returns:

- duplicate: true

when the same usage request has already been recorded.

This ensures that a client retry does not accidentally increase the tenant's usage or billing amount.

Stripe webhook events use a similar idempotency mechanism through the `webhook_events` table.

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

Stripe webhook processing also uses PostgreSQL transactions.

A webhook event is processed and recorded as part of the same transaction. If processing fails, the transaction is rolled back and the event is not recorded as successfully processed.

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

A future architectural decision will determine whether the system should:

1. Keep quotas as hard limits, or
2. Treat quotas as included usage and allow additional usage to generate overage charges.

The implementation should be changed only after this decision is made.

---

## 11. Current API

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

Changes the active subscription plan for a tenant.

### Record Usage

POST /usage

Records a usage event for a tenant while enforcing the tenant's plan quota and idempotency rules.

### Billing Summary

GET /billing/:tenantId

Returns the tenant's current subscription, plan, usage, quota, remaining quota, overage information, and calculated billing total.

### Create Stripe Customer

POST /subscriptions/:tenantId/stripe-customer

Creates a Stripe customer for a tenant and stores the Stripe customer ID locally.

If the tenant already has a Stripe customer, the existing customer ID is returned.

### Create Stripe Subscription

POST /subscriptions/:tenantId/stripe-subscription

Creates a Stripe subscription for a tenant using the configured Stripe price.

The endpoint requires a Stripe customer to already exist for the tenant.

### Stripe Webhook

POST /webhooks/stripe

Receives and processes Stripe webhook events.

The endpoint:

- Verifies the Stripe signature
- Processes supported Stripe events
- Stores processed event IDs
- Prevents duplicate event processing

### Get Tenant Invoices

GET /invoices/:tenantId

Returns invoices belonging to the tenant.

Supported query parameters include:

- page
- limit
- status
- from
- to

### Get Invoice

GET /invoices/:tenantId/:invoiceId

Returns a specific invoice belonging to the tenant.

---

## 12. Stripe Integration

Stripe is integrated as the external payment provider for subscription and invoice-related operations.

The relationship is:

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

Stripe Webhook

↓

Local Database

### Stripe Configuration

Stripe is initialized from the environment using:

STRIPE_SECRET_KEY

Stripe is only enabled when a valid Stripe secret key is configured.

The application also uses:

STRIPE_PRO_PRICE_ID

for creating Stripe Pro subscriptions.

Stripe webhook signature verification uses:

STRIPE_WEBHOOK_SECRET

### Stripe Customer

A Stripe customer can be created for a tenant through:

POST /subscriptions/:tenantId/stripe-customer

The system:

1. Validates the tenant.
2. Retrieves the tenant information.
3. Checks that the tenant has a local subscription.
4. Checks whether a Stripe customer already exists.
5. Creates the customer in Stripe when necessary.
6. Stores the Stripe customer ID in the local subscription.

Tenant information sent to Stripe includes:

- name
- email
- tenant_id metadata

If a Stripe customer already exists, the existing customer ID is returned instead of creating another customer.

### Stripe Subscription

A Stripe subscription can be created through:

POST /subscriptions/:tenantId/stripe-subscription

The system requires:

- Stripe to be configured
- The tenant to have a local subscription
- The tenant to have a Stripe customer
- STRIPE_PRO_PRICE_ID to be configured

The Stripe subscription ID is stored in the local subscription record.

If the Stripe subscription already exists, the existing subscription ID is returned.

### Stripe Webhooks

Stripe webhooks are received through:

POST /webhooks/stripe

The webhook endpoint:

1. Receives the raw Stripe request body.
2. Reads the Stripe signature.
3. Verifies the signature using the Stripe webhook secret.
4. Processes the Stripe event.
5. Records the Stripe event ID.
6. Returns a successful response.

Invalid signatures are rejected.

### Webhook Idempotency

Stripe can deliver the same webhook event multiple times.

The system prevents duplicate processing by storing each processed Stripe event in:

`webhook_events`

Before processing an event, the system checks whether its Stripe event ID already exists.

If it exists, the event is not processed again and the API returns:

duplicate: true

This prevents duplicate database updates caused by repeated webhook delivery.

### Subscription Webhooks

The system handles subscription events including:

- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- customer.subscription.paused
- customer.subscription.resumed

Subscription status changes are synchronized with the local database.

### Invoice Webhooks

The system handles invoice events including:

- invoice.created
- invoice.finalized
- invoice.paid
- invoice.payment_failed
- invoice.payment_action_required
- invoice.voided
- invoice.marked_uncollectible

Invoice information received from Stripe is stored in the local `invoices` table.

Existing invoices are updated using the Stripe invoice ID.

### Invoice Synchronization

When an invoice webhook is received, the system identifies the related local subscription using:

- Stripe customer ID, or
- Stripe subscription ID

The invoice is then associated with the correct:

- tenant
- local subscription

The following Stripe invoice information is stored locally:

- Stripe invoice ID
- status
- amount due
- amount paid
- currency
- billing period start
- billing period end

### Supported Stripe Events

The webhook service currently handles:

Subscription events:

- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- customer.subscription.paused
- customer.subscription.resumed

Invoice events:

- invoice.created
- invoice.finalized
- invoice.paid
- invoice.payment_failed
- invoice.payment_action_required
- invoice.voided
- invoice.marked_uncollectible

Payment and checkout events are also recognized:

- checkout.session.completed
- payment_intent.succeeded
- payment_intent.payment_failed

Unhandled Stripe event types are logged without failing the webhook transaction.

### External Payment Isolation

Stripe is treated as an external payment provider rather than the source of truth for internal usage metering.

Local usage, tenant, subscription, invoice, and billing data remain under the application's control.

Stripe is responsible for external payment and subscription infrastructure, while the application maintains its own internal usage and billing logic.

---

## 13. Development

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
- Jest
- Nodemon

Stripe API calls use Stripe test-mode credentials during development.

Required Stripe configuration includes:

- STRIPE_SECRET_KEY
- STRIPE_PRO_PRICE_ID
- STRIPE_WEBHOOK_SECRET

---

## 14. Testing

Automated API tests are implemented using Jest.

The test suite currently covers:

- Health endpoint
- Usage API
- Billing API
- Invoice API
- Stripe webhook API

Current test result:

Test Suites: 5 passed, 5 total

Tests: 24 passed, 24 total

The tests cover:

### Health

- API health response

### Usage

- Valid usage recording
- Invalid usage type
- Invalid quantity
- Missing idempotency key
- Duplicate usage requests
- Quota enforcement

### Billing

- Billing summary
- Missing active subscription handling

### Invoices

- Invoice retrieval
- Invoice pagination
- Invoice status filtering
- Invoice date filtering
- Invalid invoice handling

### Stripe Webhooks

- Missing Stripe signature
- Invalid Stripe signature
- Valid webhook processing
- Duplicate webhook events
- Webhook processing failures

The current test suite passes successfully with:

npm test

---

## 15. Current Implementation Status

The following components have been implemented:

### Core System

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
- Basic API error handling
- Nodemon development workflow

### Stripe Integration

- Stripe configuration
- Stripe customer creation
- Stripe customer ID persistence
- Stripe subscription creation
- Stripe subscription ID persistence
- Stripe subscription status synchronization
- Stripe webhook signature verification
- Stripe webhook processing
- Stripe webhook idempotency
- Stripe invoice synchronization
- Local invoice persistence
- Invoice status updates
- Invoice retrieval API

### Testing

Automated tests have been added using Jest.

Current result:

- 5 test suites passing
- 24 tests passing

Tested areas include:

- Health endpoint
- Usage recording
- Usage validation
- Usage idempotency
- Quota enforcement
- Billing summary
- Invoice retrieval
- Invoice filtering
- Invoice pagination
- Stripe webhook signature validation
- Stripe webhook processing
- Stripe webhook idempotency
- Stripe webhook error handling

---

## 16. Future Components

The following components remain future work:

- Usage period management
- Billing period calculations
- Advanced overage billing
- Automated payment workflows
- Expanded Stripe payment flows
- Checkout/payment UI
- API documentation
- Production error handling improvements
- Production deployment
- Production monitoring and logging

The core Stripe customer, subscription, webhook, webhook idempotency, and invoice synchronization functionality has already been implemented.

---

## 17. Design Principles

The system is designed around the following principles:

### Data Integrity

Important relationships and uniqueness rules are enforced by PostgreSQL.

### Transactional Consistency

Usage recording and Stripe webhook processing use database transactions to ensure that related operations are handled consistently.

### Idempotency

Client retries must not result in duplicate usage events.

Stripe webhook retries must not result in duplicate event processing.

### Separation of Responsibilities

Routes handle HTTP concerns.

Validation handles request validation.

Services handle business logic.

PostgreSQL handles persistent storage and database constraints.

Stripe handles external payment and subscription infrastructure.

### Extensibility

The system supports multiple usage types and is designed so additional resource types can be introduced later.

### External Payment Isolation

Stripe is treated as an external payment provider rather than the source of truth for internal usage metering.

Local usage and billing data remain under the application's control.

### Security

Stripe webhook requests are verified using Stripe's webhook signature before events are processed.

Sensitive Stripe credentials are stored in environment variables and are not committed to the repository.

### Reliability

Transactions and idempotency mechanisms are used to protect against:

- Duplicate requests
- Duplicate webhook delivery
- Partial database operations
- Concurrent usage requests

---