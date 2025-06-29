"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DatabaseGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Use three states: 'checking' while waiting for client-side check, 'valid' if DB exists, 'invalid' if not.
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  useEffect(() => {
    // This logic now runs only on the client, after the initial render is complete.
    const db = localStorage.getItem('reverse-sides-db');
    if (db) {
      setStatus('valid');
    } else {
      setStatus('invalid');
    }
  }, []); // The empty dependency array ensures this runs only once on mount.

  if (status === 'invalid') {
    // If the database isn't found, redirect to the upload page.
    router.replace('/upload');
    // Show a loader while the redirect is happening.
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirigiendo a la página de carga...</p>
        </div>
      </div>
    );
  }

  if (status === 'checking') {
    // This is the default state that will be rendered on the server and on the initial client render.
    // This guarantees that the server and client HTML match, preventing a hydration error.
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando...</p>
        </div>
      </div>
    );
  }

  // If status is 'valid', we can safely render the page content.
  return <>{children}</>;
}
