import dotenv from 'dotenv';
dotenv.config();

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Initializes a transaction with Paystack.
// Amount must be sent in kobo (i.e. Naira * 100).
export const initializeTransaction = async ({ email, amountInNaira, reference, callback_url }) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amountInNaira * 100), // convert to kobo
      reference,
      callback_url,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Failed to initialize Paystack transaction.');
  }

  return data.data; // { authorization_url, access_code, reference }
};

// Verifies a transaction status directly with Paystack using the reference.
export const verifyTransaction = async (reference) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Failed to verify Paystack transaction.');
  }

  return data.data; // { status, amount, reference, customer, ... }
};
