
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as xlsx from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AuthGuard from '@/components/auth-guard';
import { useAuth } from '@/components/auth-provider';

function UploadDatabasePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file) {
      setError("Porfavor selecciona el archivo.");
      return;
    }

    if (!file.name.endsWith('.xlsx')) {
      setError("Porvafor sube un archivo .xlsx.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(worksheet);

      if (json.length === 0) {
        throw new Error("El archivo XLSX está vacío o no se pudo analizar correctamente.");
      }

      // Validate columns
      const firstRow: any = json[0];
      const requiredColumns = ['entidad de registro', 'link del reverso para descarga directa', 'link de preview'];
      for (const col of requiredColumns) {
        if (!firstRow.hasOwnProperty(col)) {
           throw new Error(`Falta la columna requerida: "${col}". Por favor, revisa tu archivo XLSX.`);
        }
      }

      localStorage.setItem('reverse-sides-db', JSON.stringify(json));
      toast({
        title: "¡Base de datos cargada con éxito!",
        description: `Se cargaron ${json.length} registros. Serás redirigido al panel de control.`,
      });
      router.push('/dashboard'); // Changed from '/' to '/dashboard'

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An error occurred while processing the file.');
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <main className="flex min-h-screen flex-col items-center justify-center bg-secondary p-8">
        <Card className="w-full max-w-lg shadow-2xl">
           <CardHeader className="text-center relative">
            <UploadCloud className="mx-auto h-16 w-16 text-primary" />
            <CardTitle className="text-3xl font-headline">Cargar Base de Datos de Reversos</CardTitle>
            <CardDescription>
              Por favor, sube el archivo XLSX que contiene los enlaces a los reversos de las actas de nacimiento.
            </CardDescription>
             <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4"
                onClick={() => {
                  logout();
                  router.push('/');
                }}
              >
                <LogOut className="h-5 w-5" />
              </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex w-full items-center justify-center">
              <label htmlFor="file-upload" className="w-full">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                  disabled={loading}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary/10 file:text-primary
                    hover:file:bg-primary/20 cursor-pointer"
                />
              </label>
            </div>
            
            {loading && (
              <div className="flex justify-center items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Procesando archivo...</span>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error al Cargar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-muted-foreground p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Requisitos del Archivo XLSX:</h4>
              <p>Tu archivo debe estar en formato .xlsx y contener las siguientes columnas:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>entidad de registro</li>
                <li>link del reverso para descarga directa</li>
                <li>link de preview</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </AuthGuard>
  );
}

export default UploadDatabasePage;
