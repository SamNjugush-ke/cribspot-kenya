// src/types/billing.ts
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface Plan {
  id: string;
  name: string;
  price: number;            // KES
  durationInDays: number;   // subscription length
  totalListings: number;    // quota
  featuredListings: number; // featured quota
  isActive: boolean;
  createdAt?: string;       // <-- optional to avoid type conflicts
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  startedAt: string;
  expiresAt: string;
  remainingListings: number;
  remainingFeatured: number;
  isActive: boolean;
  plan?: Plan;
}

export interface Payment {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  status: PaymentStatus;
  provider: 'MPESA';
  externalRef?: string | null;
  createdAt: string;
  plan?: Plan;
}