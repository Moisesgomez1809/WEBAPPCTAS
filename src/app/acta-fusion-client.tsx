
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, BarChart3, Combine, Stamp, Trash2, Frame, Wallet, FileCog, Files, ShoppingCart, Lock, Unlock, TrendingUp } from 'lucide-react';
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
import { Progress } from "@/components/ui/progress";
import { Input } from '@/components/ui/input';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import type { ChartConfig } from "@/components/ui/chart";


interface Stats {
  total: number;
  profit: number;
  providerCost: number;
}

export default function ActaFusionClient() {
  const [stats, setStats] = useState<Stats>({ total: 0, profit: 0, providerCost: 0 });
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(null);
  const [isGoalLocked, setIsGoalLocked] = useState(false);

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

    // Load weekly goal state
    const savedGoal = localStorage.getItem('weeklyGoal');
    const savedIsLocked = localStorage.getItem('isGoalLocked');

    if (savedGoal) setWeeklyGoal(parseInt(savedGoal, 10));
    if (savedIsLocked) setIsGoalLocked(JSON.parse(savedIsLocked));
  }, []);

  const handleResetStats = () => {
    try {
        localStorage.setItem('fusionCount', '0');
        localStorage.setItem('folioCount', '0');
        localStorage.setItem('frameCount', '0');
        localStorage.setItem('metadataCount', '0');
        localStorage.setItem('totalProfit', '0');
        localStorage.setItem('totalProviderCost', '0');
        localStorage.removeItem('weeklyGoal');
        localStorage.removeItem('isGoalLocked');

        setStats({ total: 0, profit: 0, providerCost: 0 });
        setWeeklyGoal(null);
        setIsGoalLocked(false);
        
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

  const totalTrámites = stats.total;
  const maxTrámites = 1000;
  const progressPercentage = totalTrámites > 0 ? (totalTrámites / maxTrámites) * 100 : 0;

  const weeklyTransactions = stats.total;
  const remainingForGoal = weeklyGoal ? Math.max(0, weeklyGoal - weeklyTransactions) : 0;
  
  const chartData = [
    { name: "trámites", value: weeklyTransactions, fill: "hsl(var(--primary))" },
  ];
  const chartConfig = {
    trámites: { label: "Trámites", color: "hsl(var(--primary))" },
  } satisfies ChartConfig;

  const handleGoalLockToggle = () => {
    if (isGoalLocked) {
      // Unlock
      setIsGoalLocked(false);
      localStorage.setItem('isGoalLocked', 'false');
    } else {
      // Lock
      if (weeklyGoal && weeklyGoal > 0) {
        setIsGoalLocked(true);
        localStorage.setItem('weeklyGoal', weeklyGoal.toString());
        localStorage.setItem('isGoalLocked', 'true');
        toast({ title: "¡Meta guardada!", description: "A trabajar para alcanzarla." });
      } else {
        toast({ title: "Meta Inválida", description: "Por favor, introduce un número mayor que cero.", variant: "destructive" });
      }
    }
  };


  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col items-center">
        <header className="w-full text-center mb-10">
            <h1 className="text-5xl font-bold text-primary font-headline">Panel de Control</h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Un resumen de todos los documentos que has procesado y accesos directos.
            </p>
        </header>

        <div className="w-full max-w-5xl space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Trámites Totales</CardTitle>
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalTrámites}</div>
                        <p className="text-xs text-muted-foreground">
                            de {maxTrámites} trámites totales.
                        </p>
                        <Progress value={progressPercentage} className="mt-4 h-2" />
                         <p className="text-xs text-muted-foreground pt-1 text-right">{progressPercentage.toFixed(1)}%</p>
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
            
             <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 col-span-full">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <TrendingUp className="h-6 w-6 text-primary"/>
                            <CardTitle>Meta de la Semana</CardTitle>
                        </div>
                        <div className="flex items-center space-x-2">
                             <Input
                                type="number"
                                placeholder="Tu meta"
                                className="w-24 h-8"
                                value={weeklyGoal || ''}
                                onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                                disabled={isGoalLocked}
                            />
                            <Button variant="ghost" size="icon" onClick={handleGoalLockToggle}>
                                {isGoalLocked ? <Lock className="h-5 w-5 text-primary" /> : <Unlock className="h-5 w-5 text-muted-foreground" />}
                            </Button>
                        </div>
                    </div>
                     <CardDescription>Establece un objetivo semanal y monitorea tu progreso.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center">
                   {isGoalLocked && weeklyGoal ? (
                        <div className="w-full flex flex-col items-center">
                            <div className="h-[200px] w-full relative">
                                <RadialBarChart
                                    data={chartData}
                                    barSize={20}
                                    startAngle={-210}
                                    endAngle={30}
                                    innerRadius={80}
                                    cy="55%"
                                    outerRadius={110}
                                    barCategoryGap={0}
                                    viewBox={{ x: 0, y: 0, width: 300, height: 200 }}
                                >
                                <PolarAngleAxis
                                    type="number"
                                    domain={[0, weeklyGoal]}
                                    dataKey="value"
                                    angleAxisId={0}
                                    tick={false}
                                />
                                <RadialBar
                                    background={{ fill: "hsl(var(--secondary))" }}
                                    dataKey="value"
                                    angleAxisId={0}
                                    cornerRadius={10}
                                />
                                </RadialBarChart>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center mt-2">
                                     <p className="text-4xl font-bold">{weeklyTransactions}</p>
                                     <p className="text-xs text-muted-foreground">de {weeklyGoal}</p>
                                </div>
                            </div>
                             <p className="text-center mt-4 text-muted-foreground font-medium">
                                {remainingForGoal > 0
                                ? `¡Vamos, sí se puede! Te faltan ${remainingForGoal} para llegar a tu meta.`
                                : "¡Felicidades, has alcanzado tu meta semanal!"}
                            </p>
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground p-8">
                            <p>Define una meta y bloquéala para empezar a rastrear.</p>
                        </div>
                    )}
                </CardContent>
             </Card>

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

    