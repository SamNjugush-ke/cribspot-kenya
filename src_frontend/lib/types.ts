export type Role = 'LISTER' | 'RENTER' | 'ADMIN' | 'SUPER_ADMIN' | 'AGENT';

export type Unit = {
  id: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  available: number;
  rented: number;
  type: string;
};

export type Image = {
  id: string;
  url: string;
  width?: number;
  height?: number;
};

export type Property = {
  id: string;
  title: string;
  location: string;
  county?: string;
  area?: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  featured?: boolean;
  createdAt: string;
  updatedAt?: string;
  images: Image[];
  units: Unit[];
};

export type Blog = {
  id: string;
  title: string;
  excerpt: string;
  image?: string;
  createdAt: string;
};

export type SubscriptionUsage = {
  planName: string;
  totalListings: number;
  usedListings: number;
  remainingListings: number;
  expiresAt?: string | null;
};
