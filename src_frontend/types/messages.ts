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

/* -----------------------------
   Support tickets (new)
------------------------------ */
export type SupportAttachment = {
  id: string;
  ticketId: string;
  messageId: string;
  url: string;
  name?: string | null;
  size?: number | null;
  mime?: string | null;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  ticketId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: UserLite;
  supportAttachments?: SupportAttachment[];
};

export type SupportTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category?: string | null;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  createdById: string;
  assignedToId?: string | null;
  createdBy?: UserLite;
  assignedTo?: UserLite | null;
  messages?: SupportMessage[];
  supportAttachments?: SupportAttachment[];
};

export type SupportTicketsQuery = {
  status?: "OPEN" | "CLOSED";
  q?: string;
};

export type SupportTicketCreatePayload = {
  subject?: string;
  category?: string;
  message: string;
  files?: File[];
};

export type SupportTicketReplyPayload = {
  content: string;
  files?: File[];
};

/* -----------------------------
   Notifications (new)
------------------------------ */
export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};