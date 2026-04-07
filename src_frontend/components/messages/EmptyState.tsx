//frontend/src/components/messages/EmptyState.tsx
"use client";

import { FileQuestion } from "lucide-react";

export default function EmptyState({
  title = "No conversations yet",
  description = "When you start a conversation, it will show up here.",
}: { title?: string; description?: string }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-8">
      <div className="rounded-full bg-gray-100 p-4 mb-3">
        <FileQuestion className="h-6 w-6 text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600 mt-1 max-w-md">{description}</p>
    </div>
  );
}