
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { fetchReverseSidesFromDB } from './actions';
import { useToast } from "@/hooks/use-toast";

export default function DatabaseGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  // Status: 'checking', 'fetching', 'valid', 'invalid'
  const [status, setStatus] = useState<'checking' | 'fetching' | 'valid' | 'invalid'>('checking');

  useEffect(() => {
    const checkAndFetchDatabase = async () => {
      try {
        const dbString = localStorage.getItem('reverse-sides-db');
        if (dbString) {
          setStatus('valid');
        } else {
          setStatus('fetching');
          const dbData = await fetchReverseSidesFromDB();
          if (dbData && dbData.length > 0) {
            localStorage.setItem('reverse-sides-db', JSON.stringify(dbData));
            setStatus('valid');
          } else {
            throw new Error("La base de datos de Firebase está vacía o no se pudo acceder.");
          }
        }
      } catch (error: any) {
        console.error("Database check/fetch failed:", error);
        toast({
          title: 'Error de Base de Datos',
          description: error.message || 'No se pudo cargar la base de datos desde Firebase.',
          variant: 'destructive',
        });
        setStatus('invalid');
      }
    };

    checkAndFetchDatabase();
  }, [router, toast]);

  if (status === 'checking' || status === 'fetching') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {status === 'checking' ? 'Verificando base de datos...' : 'Cargando base de datos desde Firebase...'}
          </p>
        </div>
      </div>
    );
  }
  
  if (status === 'invalid') {
     return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4 text-center p-4">
          <Loader2 className="h-12 w-12 text-destructive" />
          <p className="text-destructive font-semibold">Error Crítico</p>
          <p className="text-muted-foreground">No se pudo cargar la base de datos. La aplicación no puede funcionar. <br/>Por favor, contacta al administrador.</p>
        </div>
      </div>
    );
  }

  // If status is 'valid', we can safely render the page content.
  return <>{children}</>;
}
