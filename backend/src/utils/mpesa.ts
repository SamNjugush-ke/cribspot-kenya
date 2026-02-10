// backend/src/utils/mpesa.ts
import axios from "axios";
import prisma from "./prisma";

/**
 * Environment
 */
const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORT_CODE,      
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
  MPESA_BASE_URL = "https://sandbox.safaricom.co.ke",
  MPESA_TILL_NUMBER,     // Till number for Buy Goods PartyB (recommended)
} = process.env;

if (
  !MPESA_CONSUMER_KEY ||
  !MPESA_CONSUMER_SECRET ||
  !MPESA_SHORT_CODE ||
  !MPESA_PASSKEY ||
  !MPESA_CALLBACK_URL
) {
  // eslint-disable-next-line no-console
  console.warn("[M-PESA] Missing one or more env vars. STK will fail.");
}

/**
 * Helpers
 */
const timestamp = () => {
  const d = new Date();
  const y = d.getFullYear().toString();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}${h}${min}${s}`;
};

const stkPassword = (ts: string) =>
  Buffer.from(`${MPESA_SHORT_CODE}${MPESA_PASSKEY}${ts}`).toString("base64");

async function getAccessToken(): Promise<string> {
  const url = `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await axios.get(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return res.data.access_token as string;
}

/**
 * Initiate STK Push (Buy Goods / Till)
 * NOTE: Payment row should already exist. We update externalRef on that Payment.
 */
export async function initiateStkPush(params: {
  paymentId: string;
  planId: string;
  amount: number;
  phone: string; // 2547XXXXXXXX / 2541XXXXXXXX
}): Promise<{
  CheckoutRequestID?: string;
  CustomerMessage?: string;
  MerchantRequestID?: string;
  ResponseDescription?: string;
}> {
  const { paymentId, planId, amount, phone } = params;

  // Ensure plan exists (for labels only)
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Subscription plan not found");

  const ts = timestamp();
  const token = await getAccessToken();

  // For Buy Goods STK, PartyB should be the Till number.
  // If MPESA_TILL_NUMBER isn't set, we fall back to MPESA_SHORT_CODE.
  //const partyB = Number(MPESA_TILL_NUMBER || MPESA_SHORT_CODE);
  const partyB = Number(MPESA_SHORT_CODE);


  const payload = {
    BusinessShortCode: Number(MPESA_SHORT_CODE),
    Password: stkPassword(ts),
    Timestamp: ts,

    // Till / Buy Goods
    //TransactionType: "CustomerBuyGoodsOnline",

    //Paybill
    TransactionType: "CustomerPayBillOnline",


    Amount: amount,
    PartyA: phone,
    PartyB: partyB,
    PhoneNumber: phone,

    CallBackURL: MPESA_CALLBACK_URL,

    // keep short and safe
    AccountReference: `PLAN-${plan.name}`.slice(0, 12),
    TransactionDesc: `Subscription ${plan.name}`.slice(0, 32),
  };

  const url = `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`;

  const res = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const { CheckoutRequestID, MerchantRequestID, CustomerMessage, ResponseDescription } = res.data || {};

  // Save external reference(s) to the EXISTING payment row
  await prisma.payment.update({
    where: { id: paymentId },
    data: { externalRef: CheckoutRequestID ?? MerchantRequestID ?? null },
  });

  return { CheckoutRequestID, MerchantRequestID, CustomerMessage, ResponseDescription };
}
