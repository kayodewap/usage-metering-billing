import request from "supertest";
import { jest } from "@jest/globals";

const constructEventMock = jest.fn();

jest.unstable_mockModule("../src/config/stripe.js", () => ({
  default: {
    webhooks: {
      constructEvent: constructEventMock,
    },
  },
}));

const processStripeWebhookMock = jest.fn();

jest.unstable_mockModule(
  "../src/services/stripe-webhook-service.js",
  () => ({
    processStripeWebhook: processStripeWebhookMock,
  })
);

const { default: app } = await import("../src/app.js");

describe("POST /webhooks/stripe", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.STRIPE_WEBHOOK_SECRET =
      "whsec_test_secret";
  });

  test("should reject request without Stripe signature", async () => {
    const response = await request(app)
      .post("/webhooks/stripe")
      .set("Content-Type", "application/json")
      .send({
        id: "evt_test_001",
        type: "invoice.paid",
      });

    expect(response.statusCode).toBe(400);

    expect(response.body).toEqual({
      status: false,
      message: "Missing Stripe signature",
    });
  });

  test("should reject invalid Stripe signature", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await request(app)
      .post("/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "invalid_signature")
      .send({
        id: "evt_test_002",
        type: "invoice.paid",
      });

    expect(response.statusCode).toBe(400);

    expect(response.body).toEqual({
      status: false,
      message: "Invalid Stripe webhook signature",
    });

    expect(constructEventMock).toHaveBeenCalled();
  });

  test("should process a valid Stripe webhook", async () => {
    const event = {
      id: "evt_test_003",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_002",
        },
      },
    };

    constructEventMock.mockReturnValue(event);

    processStripeWebhookMock.mockResolvedValue({
      duplicate: false,
    });

    const response = await request(app)
      .post("/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid_signature")
      .send({
        id: event.id,
        type: event.type,
      });

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      status: true,
      duplicate: false,
    });

    expect(processStripeWebhookMock).toHaveBeenCalledWith(
      event
    );
  });

  test("should return duplicate true when event was already processed", async () => {
    const event = {
      id: "evt_test_duplicate",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_003",
        },
      },
    };

    constructEventMock.mockReturnValue(event);

    processStripeWebhookMock.mockResolvedValue({
      duplicate: true,
    });

    const response = await request(app)
      .post("/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid_signature")
      .send({
        id: event.id,
        type: event.type,
      });

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      status: true,
      duplicate: true,
    });
  });

  test("should return 500 when webhook processing fails", async () => {
    const event = {
      id: "evt_test_005",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_005",
        },
      },
    };

    constructEventMock.mockReturnValue(event);

    processStripeWebhookMock.mockRejectedValue(
      new Error("Database error")
    );

    const response = await request(app)
      .post("/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid_signature")
      .send({
        id: event.id,
        type: event.type,
      });

    expect(response.statusCode).toBe(500);

    expect(response.body).toEqual({
      status: false,
      message: "Failed to process Stripe webhook",
    });
  });
});