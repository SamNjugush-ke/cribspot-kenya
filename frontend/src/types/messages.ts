// src/types/messages.ts
export type UserLite = {
  id: string;
  name: string;
  email?: string;
  role?: "ADMIN" | "SUPER_ADMIN" | "LISTER" | "RENTER" | "AGENT" | "EDITOR";
};

export type Participant = {
  userId: string;
  role: "MEMBER" | "ADMIN";
  user?: UserLite;
  lastReadAt?: string | null;
};

export type Message = {
  id: string;
  conversationId?: string | null;
  senderId: string;
  receiverId: string;
  content: string;
  sentAt: string;
  readAt?: string | null;
};

export type Thread = {
  id: string;
  type: "DIRECT" | "SUPPORT" | "GROUP" | "BROADCAST";
  subject?: string | null;
  propertyId?: string | null;
  createdAt: string;
  updatedAt: string;
  participants: Participant[];
  messages?: Message[];
  unread?: number;
};

export type ThreadsResponse = Thread[];

export type SendMessagePayload = {
  threadId?: string;
  toUserId?: string;
  content: string;
};

export type Broadcast = {
  id: string;
  subject?: string | null;
  content?: string;
  createdAt?: string;
};

export type Lead = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  propertyId?: string;
  createdAt: string;
};