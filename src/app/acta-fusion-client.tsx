
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, BarChart3, Combine, Stamp, Trash2, Frame, Wallet, FileCog, Files, ShoppingCart } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { RadialBar, RadialBarChart } from "recharts";


interface Stats {
  total: number;
  profit: number;
  providerCost: number;
}

export default function ActaFusionClient() {
  const [stats, setStats] = useState<Stats>({ total: 0, profit: 0, providerCost: 0 });
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // This effect should only run on the client side
    const fusions = parseInt(localStorage.getItem('fusionCount') || '0', 10);
    const folios = parseInt(localStorage.getItem('folioCount') || '0', 10);
    const frames = parseInt(localStorage.getItem('frameCount') || '0', 10);
    const metadata = parseInt(localStorage.getItem('metadataCount') || '0', 10);
    const profit = parseFloat(localStorage.getItem('totalProfit') || '0');
    const providerCost = parseFloat(localStorage.getItem('totalProviderCost') || '0');
    
    setStats({
      total: fusions + folios + frames + metadata,
      profit,
      providerCost,
    });
  }, []);

  const handleResetStats = () => {
    try {
        localStorage.setItem('fusionCount', '0');
        localStorage.setItem('folioCount', '0');
        localStorage.setItem('frameCount', '0');
        localStorage.setItem('metadataCount', '0');
        localStorage.setItem('totalProfit', '0');
        localStorage.setItem('totalProviderCost', '0');
        setStats({ total: 0, profit: 0, providerCost: 0 });
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

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);

  const chartData = [{ name: 'trámites', value: stats.total, fill: 'hsl(var(--primary))' }];
  const chartConfig = {
      value: { label: 'Trámites' },
      trámites: {
          label: 'Trámites',
          color: 'hsl(var(--primary))'
      }
  };
  const totalTrámites = stats.total;
  const maxTrámites = 1000;
  const chartAngle = 180 + (totalTrámites / maxTrámites) * 180;


  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col items-center">
        <header className="w-full text-center mb-10">
            <h1 className="text-5xl font-bold text-primary font-headline">Panel de Control</h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Un resumen de todos los documentos que has procesado y accesos directos.
            </p>
        </header>

        <div className="w-full max-w-5xl space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Compra a Proveedor</CardTitle>
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-destructive">
                           {formatCurrency(stats.providerCost)}
                        </div>
                        <p className="text-xs text-muted-foreground pt-1">Suma total de costo de proveedor</p>
                    </CardContent>
                </Card>
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Trámites Totales</CardTitle>
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="flex-1 flex items-center justify-center relative">
                       <ChartContainer
                            config={chartConfig}
                            className="mx-auto aspect-square h-[180px]"
                        >
                            <RadialBarChart
                                data={[{ name: 'trámites', value: maxTrámites, fill: 'hsl(var(--muted))' }]}
                                startAngle={180}
                                endAngle={0}
                                innerRadius="75%"
                                outerRadius="100%"
                                barSize={20}
                                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                                >
                                <RadialBar
                                    dataKey="value"
                                    background={{ fill: 'hsl(var(--muted))' }}
                                    cornerRadius={10}
                                    isAnimationActive={false}
                                />
                                <RadialBar
                                    data={[{ name: 'trámites', value: totalTrámites, fill: 'hsl(var(--primary))' }]}
                                    dataKey="value"
                                    cornerRadius={10}
                                    barSize={20}
                                />
                            </RadialBarChart>
                        </ChartContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center mt-4">
                            <span className="text-5xl font-bold text-foreground">
                                {stats.total}
                            </span>
                            <span className="text-xs text-muted-foreground">/ 1000</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utilidad Total</CardTitle>
                        <Wallet className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-green-600">
                            {formatCurrency(stats.profit)}
                        </div>
                        <p className="text-xs text-muted-foreground pt-1">Ganancia neta de todos los trámites</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Acciones Rápidas</CardTitle>
                    <CardDescription>Gestiona tu aplicación y tus datos desde aquí.</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     <Link href="/dashboard" className="w-full">
                        <Button variant="outline" className="w-full h-12">
                            <Combine className="mr-2 h-4 w-4" />
                            Ir a Acta Fusion
                        </Button>
                    </Link>
                     <Link href="/bulk-fusion" className="w-full">
                        <Button variant="outline" className="w-full h-12">
                            <Files className="mr-2 h-4 w-4" />
                            Ir a Fusión Masiva
                        </Button>
                    </Link>
                    <Link href="/frame" className="w-full">
                        <Button variant="outline" className="w-full h-12">
                            <Frame className="mr-2 h-4 w-4" />
                            Ir a Enmarcar
                        </Button>
                    </Link>
                    <Link href="/metadata" className="w-full">
                        <Button variant="outline" className="w-full h-12">
                            <FileCog className="mr-2 h-4 w-4" />
                            Modificar Metadata
                        </Button>
                    </Link>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="destructive" className="w-full h-12 col-span-full">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Reiniciar Estadísticas
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás absolutely seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto pondrá a cero todos los contadores de trámites, las ganancias y los costos.
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
