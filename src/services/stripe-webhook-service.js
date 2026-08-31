import pool from "../db/database.js";

async function saveInvoice(client, invoice) {
  const subscriptionResult = await client.query(
    `SELECT
       id,
       tenant_id
     FROM subscriptions
     WHERE stripe_customer_id = $1
        OR stripe_subscription_id = $2
     LIMIT 1`,
    [
      invoice.customer,
      invoice.subscription,
    ]
  );

  if (subscriptionResult.rows.length === 0) {
    throw new Error(
      `No local subscription found for Stripe invoice ${invoice.id}`
    );
  }

  const subscription = subscriptionResult.rows[0];

  await client.query(
    `INSERT INTO invoices (
       tenant_id,
       subscription_id,
       stripe_invoice_id,
       status,
       amount_due,
       amount_paid,
       currency,
       period_start,
       period_end
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       $7,
       TO_TIMESTAMP($8),
       TO_TIMESTAMP($9)
     )
     ON CONFLICT (stripe_invoice_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       amount_due = EXCLUDED.amount_due,
       amount_paid = EXCLUDED.amount_paid,
       currency = EXCLUDED.currency,
       period_start = EXCLUDED.period_start,
       period_end = EXCLUDED.period_end,
       updated_at = NOW()`,
    [
      subscription.tenant_id,
      subscription.id,
      invoice.id,
      invoice.status,
      invoice.amount_due / 100,
      invoice.amount_paid / 100,
      invoice.currency,
      invoice.period_start,
      invoice.period_end,
    ]
  );
}

export async function processStripeWebhook(event) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check whether this Stripe event has already been processed.
    const existingEvent = await client.query(
      `SELECT id
       FROM webhook_events
       WHERE stripe_event_id = $1
       LIMIT 1`,
      [event.id]
    );

    // Stripe can deliver the same event more than once.
    if (existingEvent.rows.length > 0) {
      await client.query("COMMIT");

      return {
        duplicate: true,
      };
    }

    // Handle Stripe events.
    switch (event.type) {
      /*
       * ==============================
       * SUBSCRIPTION EVENTS
       * ==============================
       */

      case "customer.subscription.created": {
        const stripeSubscription = event.data.object;

        console.log(
          `Stripe subscription created: ${stripeSubscription.id}`
        );

        break;
      }

      case "customer.subscription.updated": {
        const stripeSubscription = event.data.object;

        await client.query(
          `UPDATE subscriptions
           SET status = $1,
               updated_at = NOW()
           WHERE stripe_subscription_id = $2`,
          [
            stripeSubscription.status,
            stripeSubscription.id,
          ]
        );

        console.log(
          `Subscription updated: ${stripeSubscription.id}`
        );

        break;
      }

      case "customer.subscription.deleted": {
        const stripeSubscription = event.data.object;

        await client.query(
          `UPDATE subscriptions
           SET status = 'canceled',
               updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [stripeSubscription.id]
        );

        console.log(
          `Subscription canceled: ${stripeSubscription.id}`
        );

        break;
      }

      case "customer.subscription.paused": {
        const stripeSubscription = event.data.object;

        await client.query(
          `UPDATE subscriptions
           SET status = 'paused',
               updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [stripeSubscription.id]
        );

        console.log(
          `Subscription paused: ${stripeSubscription.id}`
        );

        break;
      }

      case "customer.subscription.resumed": {
        const stripeSubscription = event.data.object;

        await client.query(
          `UPDATE subscriptions
           SET status = 'active',
               updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [stripeSubscription.id]
        );

        console.log(
          `Subscription resumed: ${stripeSubscription.id}`
        );

        break;
      }

      /*
       * ==============================
       * INVOICE EVENTS
       * ==============================
       */

      case "invoice.created": {
        const invoice = event.data.object;

        await saveInvoice(client, invoice);

        console.log(
          `Invoice created: ${invoice.id}`
        );

        break;
      }

      case "invoice.finalized": {
        const invoice = event.data.object;

        await saveInvoice(client, invoice);

        console.log(
          `Invoice finalized: ${invoice.id}`
        );

        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;

        await saveInvoice(client, invoice);

        console.log(
          `Invoice paid: ${invoice.id}`
        );

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        await saveInvoice(client, invoice);

        console.log(
          `Invoice payment failed: ${invoice.id}`
        );

        break;
      }

      case "invoice.payment_action_required": {
        const invoice = event.data.object;

        await saveInvoice(client, invoice);

        console.log(
          `Invoice requires payment action: ${invoice.id}`
        );

        break;
      }

      case "invoice.voided": {
        const invoice = event.data.object;

        await saveInvoice(client, invoice);

        console.log(
          `Invoice voided: ${invoice.id}`
        );

        break;
      }

      case "invoice.marked_uncollectible": {
        const invoice = event.data.object;

        await saveInvoice(client, invoice);

        console.log(
          `Invoice marked uncollectible: ${invoice.id}`
        );

        break;
      }

      /*
       * ==============================
       * CHECKOUT EVENTS
       * ==============================
       */

      case "checkout.session.completed": {
        const session = event.data.object;

        console.log(
          `Checkout session completed: ${session.id}`
        );

        break;
      }

      /*
       * ==============================
       * PAYMENT INTENT EVENTS
       * ==============================
       */

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;

        console.log(
          `Payment succeeded: ${paymentIntent.id}`
        );

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;

        console.log(
          `Payment failed: ${paymentIntent.id}`
        );

        break;
      }

      /*
       * ==============================
       * UNKNOWN EVENT
       * ==============================
       */

      default: {
        console.log(
          `Unhandled Stripe event: ${event.type}`
        );

        break;
      }
    }

    // Record the Stripe event after successful processing.
    await client.query(
      `INSERT INTO webhook_events
        (stripe_event_id, event_type)
       VALUES ($1, $2)`,
      [
        event.id,
        event.type,
      ]
    );

    await client.query("COMMIT");

    return {
      duplicate: false,
      event_id: event.id,
      event_type: event.type,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}