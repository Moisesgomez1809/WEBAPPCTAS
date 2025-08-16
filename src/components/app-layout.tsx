
"use client";

import * as React from "react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { BarChart3, Combine, FileCog, Files, Frame, ScanText } from "lucide-react";
import { useAuth } from "./auth-provider";
import { Button } from "./ui/button";

const navItems = [
  { href: "/home", icon: BarChart3, label: "Dashboard" },
  { href: "/dashboard", icon: Combine, label: "Acta Fusion" },
  { href: "/bulk-fusion", icon: Files, label: "Fusión Masiva" },
  { href: "/frame", icon: Frame, label: "Enmarcar Acta" },
  { href: "/metadata", icon: FileCog, label: "Modificar Metadata" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (pathname === '/login' || !isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex flex-col items-center justify-center p-4 space-y-1">
            <h1 className="text-5xl font-bold text-primary font-headline">SIFFA</h1>
            <p className="text-xs text-muted-foreground text-center">
                Sistema Integral para Fusión y Foleo de Actas.
            </p>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname === item.href}>
                  <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content if needed */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
