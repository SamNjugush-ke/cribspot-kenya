import prisma from "../utils/prisma";
import { PaymentStatus } from "@prisma/client";

/** Mark PENDING payments older than 30 minutes as EXPIRED */
export async function expireStalePayments() {
  const threshold = new Date(Date.now() - 30 * 60 * 1000);

  await prisma.payment.updateMany({
    where: {
      status: PaymentStatus.PENDING,
      createdAt: { lt: threshold },
    },
    data: { status: PaymentStatus.EXPIRED },
  });
}