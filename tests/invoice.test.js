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

describe("Invoice API", () => {
  describe("GET /invoices/:tenantId", () => {
    test("should return tenant invoices", async () => {
      const response = await request(app)
        .get("/invoices/8");

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      expect(response.body).toHaveProperty("pagination");
      expect(response.body.pagination).toHaveProperty("page");
      expect(response.body.pagination).toHaveProperty("limit");
      expect(response.body.pagination).toHaveProperty("total");
      expect(response.body.pagination).toHaveProperty("total_pages");
    });

    test("should filter invoices by status", async () => {
      const response = await request(app)
        .get("/invoices/8?status=paid");

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(true);

      for (const invoice of response.body.data) {
        expect(invoice.status).toBe("paid");
      }
    });

    test("should support pagination", async () => {
      const response = await request(app)
        .get("/invoices/8?page=1&limit=1");

      expect(response.statusCode).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    test("should support date filters", async () => {
      const response = await request(app)
        .get(
          "/invoices/8?from=2025-01-01&to=2025-12-31"
        );

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(true);
    });

    test("should reject invalid page", async () => {
      const response = await request(app)
        .get("/invoices/8?page=0");

      expect(response.statusCode).toBe(400);
      expect(response.body.status).toBe(false);
    });

    test("should reject invalid invoice status", async () => {
      const response = await request(app)
        .get("/invoices/8?status=wrong");

      expect(response.statusCode).toBe(400);
      expect(response.body.status).toBe(false);
    });

    test("should return 404 for non-existent tenant", async () => {
      const response = await request(app)
        .get("/invoices/999999");

      expect(response.statusCode).toBe(404);
      expect(response.body.status).toBe(false);
    });
  });

  describe("GET /invoices/:tenantId/:invoiceId", () => {
    test("should return one invoice", async () => {
      const response = await request(app)
        .get("/invoices/8/1");

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(true);

      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data).toHaveProperty("tenant_id");
      expect(response.body.data).toHaveProperty("status");
      expect(response.body.data).toHaveProperty("amount_due");
      expect(response.body.data).toHaveProperty("amount_paid");
    });

    test("should return 404 when invoice does not exist", async () => {
      const response = await request(app)
        .get("/invoices/8/999999");

      expect(response.statusCode).toBe(404);
      expect(response.body.status).toBe(false);
    });

    test("should reject invalid invoice ID", async () => {
      const response = await request(app)
        .get("/invoices/8/abc");

      expect(response.statusCode).toBe(400);
      expect(response.body.status).toBe(false);
    });
  });
});