
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
import { verifyUser } from '../actions';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isValid = await verifyUser(username, token);
      
      if (isValid) {
        login(username, token);
        toast({
          title: "Inicio de Sesión Exitoso",
          description: "¡Bienvenido! Serás redirigido.",
        });
        router.push('/home'); // Redirect to home/dashboard page
      } else {
        toast({
          title: "Error de Inicio de Sesión",
          description: "Usuario o token inválido. Por favor, inténtalo de nuevo.",
          variant: "destructive",
        });
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error del Servidor",
        description: "No se pudo verificar las credenciales. Inténtalo más tarde.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
            <LogIn className="mx-auto h-10 w-10 text-primary" />
            <CardTitle className="text-3xl font-headline mt-4">Iniciar Sesión</CardTitle>
            <CardDescription className="mt-2">
            Ingresa tus credenciales para acceder a la aplicación.
            </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Ingresa tu token único"
                value={token}
                onChange={(e) => setToken(e.target.value)}
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
