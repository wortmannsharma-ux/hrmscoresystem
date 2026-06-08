import React from "react";
import { Sidebar } from "./sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="flex h-14 items-center border-b px-6 bg-card sticky top-0 z-10">
          <h1 className="text-lg font-semibold">HR Command Center</h1>
        </div>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
