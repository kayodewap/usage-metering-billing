import { body } from "express-validator";

export const recordUsageValidation = [
  body("tenant_id")
    .notEmpty()
    .withMessage("Tenant ID is required")
    .isInt({ min: 1 })
    .withMessage("Tenant ID must be a positive integer"),

  body("type")
    .trim()
    .notEmpty()
    .withMessage("Usage type is required")
    .isLength({ max: 50 })
    .withMessage("Usage type must not exceed 50 characters"),

  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  body("idempotency_key")
    .trim()
    .notEmpty()
    .withMessage("Idempotency key is required")
    .isLength({ max: 255 })
    .withMessage("Idempotency key must not exceed 255 characters"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
];