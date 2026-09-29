"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sidebar } from "./sidebar";
import { AuthGate } from "@/components/auth/auth-gate";

/**
 * Two-column shell: persistent history on the left from `lg` up, the same
 * sidebar behind a drawer below that. Procurement officers work on laptops and
 * tablets both, and the history is navigation on either.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <AuthGate>
        <div className="flex min-h-dvh">
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-0 h-dvh">
              <Sidebar />
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/80 px-3 py-2 backdrop-blur lg:hidden">
              <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open history">
                    <Menu />
                  </Button>
                </DialogTrigger>
                <DialogContent className="h-[85dvh] max-w-sm gap-0 overflow-hidden p-0">
                  <DialogTitle className="sr-only">Request history</DialogTitle>
                  <Sidebar onNavigate={() => setDrawerOpen(false)} />
                </DialogContent>
              </Dialog>
              <span className="font-semibold">Quotebook</span>
            </header>

            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </AuthGate>
    </TooltipProvider>
  );
}
