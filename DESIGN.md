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

---

## 3. Database

The database is PostgreSQL.

Current tables:

- tenants
- plans
- subscriptions
- usage_events
- webhook_events

### Tenants

A tenant represents a customer using the system.

### Plans

Plans define the usage limits available to a tenant.

Current plans include:

- Free — 1,000 API calls and 100,000 AI tokens
- Pro — 50,000 API calls and 5,000,000 AI tokens

### Subscriptions

A subscription connects a tenant to a plan.

The relationship is:

tenants
↓
subscriptions
↓
plans

A subscription contains fields for future Stripe integration, including:

- stripe_customer_id
- stripe_subscription_id
- status

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

### Webhook Events

The `webhook_events` table is reserved for storing processed Stripe webhook events and supporting webhook idempotency.

Stripe webhook processing will be implemented later.

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

---

## 10. Current API

### Health Check

GET /health

Used to verify that the API is running.

### Create Tenant

POST /tenants

Creates a new tenant.

### Record Usage

POST /usage

Records a usage event for a tenant while enforcing the tenant's plan quota and idempotency rules.

---

## 11. Development

Nodemon is used during development so that the server automatically restarts when source files change.

Development server:

npm run dev

Environment configuration is stored in `.env`.

The `.env` file must not be committed to Git.

The application uses:

- Node.js
- Express
- PostgreSQL
- pg
- Express Validator
- dotenv
- Stripe SDK

---

## 12. Current Implementation Status

The following components have been implemented:

- PostgreSQL database connection
- Tenant management
- Plans
- Subscriptions
- Usage events
- Usage recording
- Usage aggregation
- Express Validator validation
- Usage idempotency
- Transaction-based usage recording
- Subscription row locking
- Plan quota enforcement
- Quota-exceeded handling
- Basic API error handling
- Nodemon development workflow

---

## 13. Future Components

The following components will be implemented as the project progresses:

- Subscription management API
- Billing calculations
- Stripe customer management
- Stripe subscription integration
- Stripe webhook processing
- Webhook idempotency
- Invoice generation
- Billing history
- Automated tests
- API documentation
- Production error handling improvements
- Production deployment