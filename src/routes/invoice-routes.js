import express from "express";

import {
  tenantExists,
  getTenantInvoices,
  countTenantInvoices,
  getTenantInvoice,
} from "../services/invoice-service.js";

const router = express.Router();

function isValidDate(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
}

/*
 * GET ONE INVOICE
 *
 * GET /invoices/:tenantId/:invoiceId
 */
router.get("/:tenantId/:invoiceId", async (req, res) => {
  try {
    const tenantId = Number(req.params.tenantId);
    const invoiceId = Number(req.params.invoiceId);

    if (
      !Number.isInteger(tenantId) ||
      tenantId <= 0
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid tenant ID",
      });
    }

    if (
      !Number.isInteger(invoiceId) ||
      invoiceId <= 0
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid invoice ID",
      });
    }

    const exists = await tenantExists(tenantId);

    if (!exists) {
      return res.status(404).json({
        status: false,
        message: "Tenant not found",
      });
    }

    const invoice = await getTenantInvoice(
      tenantId,
      invoiceId
    );

    if (!invoice) {
      return res.status(404).json({
        status: false,
        message: "Invoice not found",
      });
    }

    return res.status(200).json({
      status: true,
      data: invoice,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      status: false,
      message: "Failed to get invoice",
    });
  }
});


/*
 * GET TENANT INVOICES
 *
 * GET /invoices/:tenantId
 *
 * Query parameters:
 *
 * ?page=1
 * ?limit=20
 * ?status=paid
 * ?from=2025-01-01
 * ?to=2025-12-31
 */
router.get("/:tenantId", async (req, res) => {
  try {
    const tenantId = Number(req.params.tenantId);

    if (
      !Number.isInteger(tenantId) ||
      tenantId <= 0
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid tenant ID",
      });
    }

    /*
     * Pagination
     */

    const limit =
      req.query.limit === undefined
        ? 20
        : Number(req.query.limit);

    const page =
      req.query.page === undefined
        ? 1
        : Number(req.query.page);

    if (
      !Number.isInteger(limit) ||
      limit <= 0 ||
      limit > 100
    ) {
      return res.status(400).json({
        status: false,
        message: "Limit must be between 1 and 100",
      });
    }

    if (
      !Number.isInteger(page) ||
      page <= 0
    ) {
      return res.status(400).json({
        status: false,
        message: "Page must be a positive integer",
      });
    }

    /*
     * Status filter
     */

    const status = req.query.status;

    const allowedStatuses = [
      "draft",
      "open",
      "paid",
      "uncollectible",
      "void",
    ];

    if (
      status !== undefined &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid invoice status",
      });
    }

    /*
     * Date filters
     */

    const from = req.query.from;
    const to = req.query.to;

    if (
      from !== undefined &&
      !isValidDate(from)
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid from date",
      });
    }

    if (
      to !== undefined &&
      !isValidDate(to)
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid to date",
      });
    }

    if (
      from &&
      to &&
      new Date(from) > new Date(to)
    ) {
      return res.status(400).json({
        status: false,
        message: "From date cannot be after to date",
      });
    }

    /*
     * Check tenant
     */

    const exists = await tenantExists(tenantId);

    if (!exists) {
      return res.status(404).json({
        status: false,
        message: "Tenant not found",
      });
    }

    /*
     * Calculate offset
     */

    const offset = (page - 1) * limit;

    /*
     * Get invoices
     */

    const invoices = await getTenantInvoices(
      tenantId,
      limit,
      offset,
      status,
      from,
      to
    );

    /*
     * Get total count
     */

    const total = await countTenantInvoices(
      tenantId,
      status,
      from,
      to
    );

    return res.status(200).json({
      status: true,
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      status: false,
      message: "Failed to get invoices",
    });
  }
});

export default router;