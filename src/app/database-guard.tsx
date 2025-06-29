"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DatabaseGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect ensures we are on the client.
    setIsClient(true);
  }, []);

  // Return null on the server and on the first client-side render.
  // This ensures there's no mismatch between server and client HTML.
  if (!isClient) {
    return null;
  }
  
  // Now that we're safely on the client, we can check localStorage.
  const db = localStorage.getItem('reverse-sides-db');
  
  if (!db) {
    // If there's no database, redirect and show a loader.
    router.replace('/upload');
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirigiendo a la página de carga...</p>
        </div>
      </div>
    );
  }

  // If the database exists, render the actual page content.
  return <>{children}</>;
}
