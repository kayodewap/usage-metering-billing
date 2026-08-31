import request from "supertest";
import { jest } from "@jest/globals";
import app from "../src/app.js";
import pool from "../src/db/database.js";

const consoleError = console.error;

beforeAll(() => {
  console.error = jest.fn();
});

afterAll(async () => {
  console.error = consoleError;
  await pool.end();
});

describe("POST /usage", () => {
  const tenantId = 8;

  test("should record valid API usage", async () => {
    const response = await request(app)
      .post("/usage")
      .send({
        tenant_id: tenantId,
        type: "api_call",
        quantity: 5,
        idempotency_key: `test-api-${Date.now()}`,
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe(true);
    expect(response.body.duplicate).toBe(false);
    expect(response.body.data).toBeDefined();
  });

  test("should reject invalid usage type", async () => {
    const response = await request(app)
      .post("/usage")
      .send({
        tenant_id: tenantId,
        type: "invalid_type",
        quantity: 5,
        idempotency_key: `test-invalid-${Date.now()}`,
      });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe(false);
  });

  test("should reject quantity below 1", async () => {
    const response = await request(app)
      .post("/usage")
      .send({
        tenant_id: tenantId,
        type: "api_call",
        quantity: 0,
        idempotency_key: `test-zero-${Date.now()}`,
      });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe(false);
  });

  test("should reject missing idempotency key", async () => {
    const response = await request(app)
      .post("/usage")
      .send({
        tenant_id: tenantId,
        type: "api_call",
        quantity: 5,
      });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe(false);
  });

  test("should return duplicate for repeated idempotency key", async () => {
    const key = `test-duplicate-${Date.now()}`;

    const first = await request(app)
      .post("/usage")
      .send({
        tenant_id: tenantId,
        type: "api_call",
        quantity: 5,
        idempotency_key: key,
      });

    const second = await request(app)
      .post("/usage")
      .send({
        tenant_id: tenantId,
        type: "api_call",
        quantity: 5,
        idempotency_key: key,
      });

    expect(first.status).toBe(201);
    expect(first.body.duplicate).toBe(false);

    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
  });
});