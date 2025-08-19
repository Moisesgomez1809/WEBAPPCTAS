
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { BarChart3, Combine, FileCog, Files, Frame, ScanText, Trash2 } from "lucide-react";
import { useAuth } from "./auth-provider";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { href: "/home", icon: BarChart3, label: "Dashboard" },
  { href: "/dashboard", icon: Combine, label: "Acta Fusion" },
  { href: "/bulk-fusion", icon: Files, label: "Fusión Masiva" },
  { href: "/frame", icon: Frame, label: "Enmarcar Acta" },
  { href: "/metadata", icon: FileCog, label: "Modificar Metadata" },
  { href: "/develop-ocr", icon: ScanText, label: "OCR Nativo" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const { toast } = useToast();

  if (pathname === '/login' || !isAuthenticated) {
    return <>{children}</>;
  }
  
  const handleResetStats = () => {
    try {
        localStorage.setItem('fusionCount', '0');
        localStorage.removeItem('dailyFusionStats');
        localStorage.removeItem('weeklyGoal');
        localStorage.removeItem('isGoalLocked');
        localStorage.removeItem('curpHistory');
        
        toast({
            title: "Estadísticas Reiniciadas",
            description: "Los contadores han sido puestos a cero. Refresca la página para ver los cambios.",
        });
        // Optionally, force a reload to see changes immediately
        window.location.reload();

    } catch (e) {
        console.error("Failed to reset stats", e);
        toast({
            title: "Error",
            description: "No se pudieron reiniciar las estadísticas.",
            variant: "destructive"
        });
    }
  };


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
          <SidebarSeparator />
           <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Reiniciar Estadísticas
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Esta acción no se puede deshacer. Esto pondrá a cero todos los contadores de trámites, tanto el histórico como los diarios y las metas.
                  </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetStats} className="bg-destructive hover:bg-destructive/90">Continuar y Reiniciar</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
