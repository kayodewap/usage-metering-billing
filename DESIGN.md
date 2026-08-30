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

Routes are responsible for handling HTTP requests and responses.

Validation is responsible for validating incoming request data.

Services contain application and database operations.

PostgreSQL is responsible for persistent data storage and enforcing database constraints.

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

A subscription also contains fields for future Stripe integration.

### Usage Events

Usage events record consumption by tenants.

Each event contains:

- tenant_id
- type
- quantity
- idempotency_key
- metadata
- created_at

The tenant relationship is enforced using a foreign key.

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

Usage types can represent different forms of consumption, such as:

- API calls
- AI tokens

The quantity field represents how much of the resource was consumed.

## 5. Idempotency

Usage events use an idempotency key to prevent duplicate usage from being recorded.

The database enforces uniqueness on:

(tenant_id, idempotency_key)

The usage service uses:

ON CONFLICT (tenant_id, idempotency_key) DO NOTHING

This protects the system when a client retries the same request.

A duplicate request does not create another usage event.

## 6. Validation

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

Unexpected server or database errors return:

HTTP 500

## 7. Current API

### Health Check

GET /health

Used to verify that the API is running.

### Create Tenant

POST /tenants

Creates a new tenant.

### Record Usage

POST /usage

Records a usage event for a tenant.

## 8. Development

Nodemon is used during development so that the server automatically restarts when source files change.

Development server:

npm run dev

Environment configuration is stored in `.env`.

The `.env` file must not be committed to Git.

## 9. Future Components

The following components will be implemented as the project progresses:

- Usage quota checking
- Usage aggregation
- Subscription management
- Billing calculations
- Stripe integration
- Stripe webhook processing
- Invoice generation
- Error handling improvements
- Automated tests