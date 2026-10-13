import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { UserSwitcher } from "@/components/shell/user-switcher";
import { StatusBadge } from "@/components/ui/status-badge";
import { currentActor } from "@/lib/auth/session";
import { listUsers } from "@/lib/services/users";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tally · Accounts receivable",
  description: "A small accounts-receivable console used in the Cursor 201 workshop.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [actor, users] = await Promise.all([currentActor(), listUsers()]);
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-5 md:block">
            <div className="mb-6 flex items-center gap-2 px-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">T</span>
              <span className="text-lg font-semibold tracking-tight">Tally</span>
            </div>
            <SidebarNav />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3">
              <UserSwitcher users={users} currentUserId={actor.id} />
              <StatusBadge status={actor.role} />
            </header>
            <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
