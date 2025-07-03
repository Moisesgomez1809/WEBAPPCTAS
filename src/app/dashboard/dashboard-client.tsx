
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, BarChart3, Combine, Stamp, Trash2, Frame, Wallet, FileCog } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
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
} from "@/components/ui/alert-dialog"

interface Stats {
  total: number;
  fusions: number;
  folios: number;
  frames: number;
  metadata: number;
  profit: number;
}

export default function DashboardClient() {
  const [stats, setStats] = useState<Stats>({ total: 0, fusions: 0, folios: 0, frames: 0, metadata: 0, profit: 0 });
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fusions = parseInt(localStorage.getItem('fusionCount') || '0', 10);
    const folios = parseInt(localStorage.getItem('folioCount') || '0', 10);
    const frames = parseInt(localStorage.getItem('frameCount') || '0', 10);
    const metadata = parseInt(localStorage.getItem('metadataCount') || '0', 10);
    const profit = parseFloat(localStorage.getItem('totalProfit') || '0');
    setStats({
      total: fusions + folios + frames + metadata,
      fusions,
      folios,
      frames,
      metadata,
      profit,
    });
  }, []);

  const handleResetStats = () => {
    try {
        localStorage.setItem('fusionCount', '0');
        localStorage.setItem('folioCount', '0');
        localStorage.setItem('frameCount', '0');
        localStorage.setItem('metadataCount', '0');
        localStorage.setItem('totalProfit', '0');
        setStats({ total: 0, fusions: 0, folios: 0, frames: 0, metadata: 0, profit: 0 });
        toast({
            title: "Estadísticas Reiniciadas",
            description: "Los contadores han sido puestos a cero.",
        });
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
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col items-center">
        <header className="w-full text-center mb-10">
            <h1 className="text-5xl font-bold text-primary font-headline">Dashboard de Actividad</h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Un resumen de todos los documentos que has procesado.
            </p>
        </header>

        <div className="w-full max-w-5xl space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Trámites Totales</CardTitle>
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground pt-1">Suma de todos los trámites</p>
                    </CardContent>
                </Card>
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utilidad Total</CardTitle>
                        <Wallet className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-green-600">
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(stats.profit)}
                        </div>
                        <p className="text-xs text-muted-foreground pt-1">Ganancia acumulada de todos los trámites</p>
                    </CardContent>
                </Card>
                 <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Actas Fusionadas</CardTitle>
                        <Combine className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{stats.fusions}</div>
                         <p className="text-xs text-muted-foreground pt-1">Documentos con reverso añadido</p>
                    </CardContent>
                </Card>
                 <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Documentos Foliados</CardTitle>
                        <Stamp className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{stats.folios}</div>
                        <p className="text-xs text-muted-foreground pt-1">Documentos con folio único</p>
                    </CardContent>
                </Card>
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Actas Enmarcadas</CardTitle>
                        <Frame className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{stats.frames}</div>
                        <p className="text-xs text-muted-foreground pt-1">Documentos con marco añadido</p>
                    </CardContent>
                </Card>
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Metadata Modificada</CardTitle>
                        <FileCog className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{stats.metadata}</div>
                        <p className="text-xs text-muted-foreground pt-1">Documentos con metadata limpia</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Acciones Rápidas</CardTitle>
                    <CardDescription>Gestiona tu aplicación y tus datos desde aquí.</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     <Link href="/" className="w-full">
                        <Button variant="outline" className="w-full h-12">
                            <Combine className="mr-2 h-4 w-4" />
                            Ir a Acta Fusion
                        </Button>
                    </Link>
                    <Link href="/frame" className="w-full">
                        <Button variant="outline" className="w-full h-12">
                            <Frame className="mr-2 h-4 w-4" />
                            Ir a Enmarcar
                        </Button>
                    </Link>
                    <Link href="/folio" className="w-full">
                        <Button variant="outline" className="w-full h-12">
                            <Stamp className="mr-2 h-4 w-4" />
                            Ir a Foliar
                        </Button>
                    </Link>
                    <Link href="/metadata" className="w-full">
                        <Button variant="outline" className="w-full h-12">
                            <FileCog className="mr-2 h-4 w-4" />
                            Modificar Metadata
                        </Button>
                    </Link>
                    <Link href="/upload" className="w-full">
                        <Button variant="outline" className="w-full h-12">
                            <Upload className="mr-2 h-4 w-4" />
                            Subir nueva Base de Datos
                        </Button>
                    </Link>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="destructive" className="w-full h-12">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Reiniciar Estadísticas
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás absolutely seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto pondrá a cero todos los contadores de trámites y las ganancias.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetStats}>Continuar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    </main>
  );
}
