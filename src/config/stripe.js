import Stripe from "stripe";
import "dotenv/config";

const stripeKey = process.env.STRIPE_SECRET_KEY;

const isStripeConfigured =
  stripeKey &&
  stripeKey !== "sk_test_your_key_here";

const stripe = isStripeConfigured
  ? new Stripe(stripeKey)
  : null;

export default stripe;