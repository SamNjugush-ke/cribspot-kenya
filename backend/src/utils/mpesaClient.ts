//backend/src/utils/mpesaClient.ts
export type StkPushRequest = {
  phone: string;
  amount: number;
  accountRef: string;
  description?: string;
};

export type StkPushResponse = {
  ok: boolean;
  providerRef?: string; // e.g., CheckoutRequestID
  message: string;
};

// For now this is a stub. Replace with actual Daraja integration later.
export async function sendStkPush(req: StkPushRequest): Promise<StkPushResponse> {
  // Simulate a provider reference & success
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: true,
        providerRef: `CHK-${Date.now()}`,
        message: "Simulated STK push sent.",
      });
    }, 600);
  });
}