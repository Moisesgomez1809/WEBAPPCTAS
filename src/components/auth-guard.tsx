
"use client";

import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Si no se está cargando y el usuario no está autenticado, redirigir.
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    // Muestra un cargador mientras se verifica la sesión o mientras ocurre la redirección.
    // Esto evita mostrar brevemente el contenido protegido.
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Si está autenticado, muestra el contenido de la página.
  return <>{children}</>;
}
