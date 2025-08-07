
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // The onAuthStateChanged listener in AuthProvider will handle the session state.
      // We call login() here just to immediately update the context if needed,
      // though the listener is the source of truth.
      if (userCredential.user) {
        login(userCredential.user);
        toast({
          title: "Inicio de Sesión Exitoso",
          description: "¡Bienvenido! Serás redirigido.",
        });
        router.push('/home'); // Redirect to home/dashboard page
      }
      
    } catch (error: any) {
      console.error("Firebase Auth Error:", error);
      let description = "Ocurrió un error. Por favor, inténtalo de nuevo.";
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
           description = "Correo electrónico o contraseña incorrectos.";
           break;
        case 'auth/invalid-email':
           description = "El formato del correo electrónico no es válido.";
           break;
        case 'auth/too-many-requests':
            description = "Demasiados intentos de inicio de sesión. Inténtalo de nuevo más tarde.";
            break;
      }
      toast({
        title: "Error de Inicio de Sesión",
        description,
        variant: "destructive",
      });
    } finally {
        setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
            <LogIn className="mx-auto h-10 w-10 text-primary" />
            <CardTitle className="text-3xl font-headline mt-4">Bienvenido a SIFFA</CardTitle>
            <CardDescription className="mt-2">
            Sistema Integral para Fusión y Foleo de Actas.
            </CardDescription>
            <CardDescription className="mt-2">
            Ingresa tus credenciales para acceder al sistema.
            </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                 className="bg-background"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {loading ? 'Verificando...' : 'Acceder'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
