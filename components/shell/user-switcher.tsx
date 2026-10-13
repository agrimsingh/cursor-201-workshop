"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { apiRequest } from "@/lib/client/api";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

/** Mocked sign-in: pick which seeded user you are acting as. */
export function UserSwitcher({ users, currentUserId }: { users: UserOption[]; currentUserId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Acting as</span>
      <select
        aria-label="Acting as"
        className="input w-auto py-1"
        value={currentUserId}
        disabled={pending}
        onChange={(event) => {
          const userId = event.target.value;
          startTransition(async () => {
            await apiRequest("PUT", "/api/session", { userId });
            router.refresh();
          });
        }}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.role})
          </option>
        ))}
      </select>
    </label>
  );
}
