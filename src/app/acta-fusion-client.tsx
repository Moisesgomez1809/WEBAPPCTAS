
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, BarChart3, Combine, Stamp, Trash2, Frame, Wallet, FileCog, Files, ShoppingCart, Lock, Unlock, TrendingUp, CalendarDays, Pencil, Download, History, AlertCircle, Search, Database } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { backupStatToSheet } from '../actions';
import { Switch } from '@/components/ui/switch';


interface Stats {
  total: number;
}

interface DailyStats {
  weekNumber: number;
  counts: number[]; // Index 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

interface CurpHistory {
  weekNumber: number;
  history: Record<number, string[]>; // { 0: ["curp1", "curp2"], 1: ["curp3"], ... }
}

interface DisplayHistoryItem {
    curp: string;
    day: string;
    dayIndex: number;
}

// Helper to get the ISO week number
const getWeekNumber = (d: Date): number => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};

const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const orderedDayIndexes = [1, 2, 3, 4, 5, 6, 0]; // Lunes a Domingo

const usePrevious = (value: number[] | undefined) => {
  const ref = useRef<number[] | undefined>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

export default function ActaFusionClient() {
  const [stats, setStats] = useState<Stats>({ total: 0 });
  const [dailyStats, setDailyStats] = useState<number[]>(Array(7).fill(0));
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(null);
  const [isGoalLocked, setIsGoalLocked] = useState(false);
  const [adjustmentDay, setAdjustmentDay] = useState<string>("");
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [fullHistory, setFullHistory] = useState<DisplayHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<DisplayHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [curpSearchQuery, setCurpSearchQuery] = useState<string>("");
  const [backupUrl, setBackupUrl] = useState('');
  const [backupEnabled, setBackupEnabled] = useState(false);
  const prevDailyStats = usePrevious(dailyStats);


  const router = useRouter();
  const { toast } = useToast();

  const loadDataFromLocalStorage = () => {
     // This effect should only run on the client side
    const totalFusions = parseInt(localStorage.getItem('fusionCount') || '0', 10);
    setStats({ total: totalFusions });

    const today = new Date();
    const currentWeek = getWeekNumber(today);
    
    // Load daily stats
    const storedStatsRaw = localStorage.getItem('dailyFusionStats');
    let loadedStats: DailyStats = { weekNumber: currentWeek, counts: Array(7).fill(0) };
    if (storedStatsRaw) {
      try {
        const parsed = JSON.parse(storedStatsRaw);
        if (parsed.weekNumber === currentWeek) loadedStats = parsed;
        else localStorage.setItem('dailyFusionStats', JSON.stringify(loadedStats)); // Reset for new week
      } catch (e) { console.error(e) }
    } else {
        localStorage.setItem('dailyFusionStats', JSON.stringify(loadedStats));
    }
    setDailyStats(loadedStats.counts);
    
    // The historical total should be the sum of the weekly stats
    const weeklyTotal = loadedStats.counts.reduce((sum, count) => sum + count, 0);
    setStats({ total: weeklyTotal });
    localStorage.setItem('fusionCount', weeklyTotal.toString()); // Keep historical in sync


    // Load CURP History
    const storedHistoryRaw = localStorage.getItem('curpHistory');
    let loadedHistory: CurpHistory = { weekNumber: currentWeek, history: {} };
    if (storedHistoryRaw) {
        try {
            const parsed = JSON.parse(storedHistoryRaw);
            if (parsed.weekNumber === currentWeek) loadedHistory = parsed;
            else localStorage.setItem('curpHistory', JSON.stringify(loadedHistory)); // Reset for new week
        } catch(e) { console.error(e); }
    } else {
        localStorage.setItem('curpHistory', JSON.stringify(loadedHistory));
    }

    const displayHistory: DisplayHistoryItem[] = [];
    Object.entries(loadedHistory.history).forEach(([dayIndex, curps]) => {
      const dayIdx = parseInt(dayIndex, 10);
      curps.forEach(curp => {
        displayHistory.push({ curp, day: dayNames[dayIdx], dayIndex: dayIdx });
      });
    });
    setFullHistory(displayHistory);
    setFilteredHistory(displayHistory);


    // Load weekly goal state
    const savedGoal = localStorage.getItem('weeklyGoal');
    const savedIsLocked = localStorage.getItem('isGoalLocked');

    if (savedGoal) setWeeklyGoal(parseInt(savedGoal, 10));
    if (savedIsLocked) setIsGoalLocked(JSON.parse(savedIsLocked));

    // Load backup settings
    const savedBackupUrl = localStorage.getItem('backupUrl') || '';
    const savedBackupEnabled = localStorage.getItem('backupEnabled') === 'true';
    setBackupUrl(savedBackupUrl);
    setBackupEnabled(savedBackupEnabled);
  };

  useEffect(() => {
    loadDataFromLocalStorage();
  }, []);

  useEffect(() => {
    let newFilteredHistory = fullHistory;

    // Filter by day
    if (historyFilter !== 'all') {
      const dayIndex = parseInt(historyFilter, 10);
      newFilteredHistory = newFilteredHistory.filter(item => item.dayIndex === dayIndex);
    }

    // Filter by CURP search query
    if (curpSearchQuery) {
        newFilteredHistory = newFilteredHistory.filter(item => 
            item.curp.toLowerCase().includes(curpSearchQuery.toLowerCase())
        );
    }
    
    setFilteredHistory(newFilteredHistory);
  }, [historyFilter, curpSearchQuery, fullHistory]);
  
  // Backup effect
  useEffect(() => {
    if (!backupEnabled || !backupUrl || !prevDailyStats) return;

    const backupStat = async (dayIndex: number, count: number) => {
        const dayName = dayNames[dayIndex];
        const normalizedDayName = dayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        try {
            const result = await backupStatToSheet(backupUrl, normalizedDayName, count);
            if (!result.success) {
                toast({
                    title: `Error de Respaldo (${dayName})`,
                    description: result.error,
                    variant: 'destructive'
                });
                // Disable on failure to prevent spamming toasts
                setBackupEnabled(false);
                localStorage.setItem('backupEnabled', 'false');
            }
        } catch (e: any) {
            toast({
                title: `Error de Respaldo (${dayName})`,
                description: "No se pudo conectar al servicio. Revisa la URL y la consola.",
                variant: 'destructive'
            });
             // Disable on failure
            setBackupEnabled(false);
            localStorage.setItem('backupEnabled', 'false');
        }
    };

    dailyStats.forEach((count, dayIndex) => {
        if (prevDailyStats[dayIndex] !== count) {
            backupStat(dayIndex, count);
        }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyStats]);

  const handleManualAdjustment = () => {
    if (adjustmentDay === "") {
      toast({
        title: "Día no seleccionado",
        description: "Por favor, selecciona un día para el ajuste.",
        variant: "destructive",
      });
      return;
    }
    if (adjustmentAmount === 0) {
      toast({
        title: "Cantidad Inválida",
        description: "Por favor, introduce una cantidad (positiva o negativa) distinta de cero.",
        variant: "destructive",
      });
      return;
    }
    
    const dayIndex = parseInt(adjustmentDay, 10);

    try {
      const storedStatsRaw = localStorage.getItem('dailyFusionStats');
      if (storedStatsRaw) {
        const parsedStats = JSON.parse(storedStatsRaw);
        const today = new Date();
        const currentWeek = getWeekNumber(today);
        if (parsedStats.weekNumber === currentWeek) {
            // Adjust daily stats
            const newDailyCount = Math.max(0, (parsedStats.counts[dayIndex] || 0) + adjustmentAmount);
            const actualAmountChanged = newDailyCount - (parsedStats.counts[dayIndex] || 0);
            parsedStats.counts[dayIndex] = newDailyCount;
            localStorage.setItem('dailyFusionStats', JSON.stringify(parsedStats));

            // Adjust historical total as well
            const currentTotal = parseInt(localStorage.getItem('fusionCount') || '0', 10);
            const newTotal = Math.max(0, currentTotal + actualAmountChanged);
            localStorage.setItem('fusionCount', newTotal.toString());
            
            // Reload data to reflect changes
            loadDataFromLocalStorage();

            toast({
                title: "Ajuste Exitoso",
                description: `Se ${actualAmountChanged >= 0 ? 'agregaron' : 'restaron'} ${Math.abs(actualAmountChanged)} trámites al ${dayNames[dayIndex]}.`
            });

            // Reset form and close dialog
            setAdjustmentDay("");
            setAdjustmentAmount(0);
            setIsAdjustmentDialogOpen(false);
        } else {
             toast({
                title: "Semana Desactualizada",
                description: "Las estadísticas son de una semana pasada. No se realizó el ajuste.",
                variant: "destructive",
            });
        }
      }
    } catch(e) {
        console.error("Failed to apply manual adjustment", e);
         toast({
            title: "Error",
            description: "No se pudo aplicar el ajuste manual.",
            variant: "destructive"
        });
    }
  };


  const totalTrámites = stats.total;
  const maxTrámites = 1000;
  const progressPercentage = totalTrámites > 0 ? (totalTrámites / maxTrámites) * 100 : 0;

  const weeklyTransactions = dailyStats.reduce((sum, count) => sum + count, 0);
  const remainingForGoal = weeklyGoal ? Math.max(0, weeklyGoal - weeklyTransactions) : 0;
  
  const radialChartData = weeklyGoal ? [
    { name: "trámites", value: weeklyTransactions, fill: "hsl(var(--primary))" },
  ] : [];
  
  const radialChartConfig = {
    trámites: { label: "Trámites", color: "hsl(var(--primary))" },
  } satisfies ChartConfig;

  const barChartData = orderedDayIndexes.map(dayIndex => ({
    name: dayNames[dayIndex].substring(0, 3), // e.g., "Lun"
    trámites: dailyStats[dayIndex] || 0,
  }));
  
  const barChartConfig = {
    trámites: {
      label: "Trámites",
      color: "hsl(var(--primary))",
    },
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

  const handleDownloadStats = () => {
    try {
      const dataForSheet = orderedDayIndexes.map(dayIndex => ({
        'Día': dayNames[dayIndex],
        'Cantidad': dailyStats[dayIndex] || 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Trámites Semanales");
      
      // Auto-size columns
      const max_width = dataForSheet.reduce((w, r) => Math.max(w, r['Día'].length), 10);
      worksheet["!cols"] = [ { wch: max_width }, { wch: 10 } ];

      XLSX.writeFile(workbook, "Reporte Semanal_SIST.xlsx");
       toast({
          title: "Descarga Iniciada",
          description: "Tu reporte de Excel se está descargando.",
      });
    } catch(e) {
      console.error("Failed to generate Excel file", e);
      toast({
          title: "Error de Descarga",
          description: "No se pudo generar el archivo de Excel.",
          variant: "destructive"
      });
    }
  }

  const handleDownloadHistory = () => {
    if (fullHistory.length === 0) {
        toast({ title: "No hay datos", description: "El historial de la semana está vacío.", variant: "destructive" });
        return;
    }
    try {
        const storedHistoryRaw = localStorage.getItem('curpHistory');
        const historyData: CurpHistory = storedHistoryRaw ? JSON.parse(storedHistoryRaw) : { weekNumber: 0, history: {} };
        const dataByDay: Record<string, string[]> = {};
        dayNames.forEach(day => dataByDay[day] = []);
        Object.entries(historyData.history).forEach(([dayIndex, curps]) => {
            const dayName = dayNames[parseInt(dayIndex, 10)];
            dataByDay[dayName].push(...curps);
        });

        const maxRows = Math.max(...Object.values(dataByDay).map(arr => arr.length));
        const sheetData = [];
        for (let i = 0; i < maxRows; i++) {
            const row: Record<string, string> = {};
            orderedDayIndexes.forEach(dayIndex => {
                const dayName = dayNames[dayIndex];
                row[dayName] = dataByDay[dayName]?.[i] || "";
            });
            sheetData.push(row);
        }
        
        const worksheet = XLSX.utils.json_to_sheet(sheetData, { header: dayNames.filter((_, i) => orderedDayIndexes.includes(i)) });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Historial CURPs");

        // Auto-size columns
        worksheet["!cols"] = dayNames.map(() => ({ wch: 20 }));

        XLSX.writeFile(workbook, "Historial_CURPs_SIST.xlsx");
        toast({
            title: "Descarga Iniciada",
            description: "Tu historial de CURPs se está descargando.",
        });
    } catch(e) {
        console.error("Failed to generate history Excel file", e);
        toast({
            title: "Error de Descarga",
            description: "No se pudo generar el archivo de Excel.",
            variant: "destructive"
        });
    }
  }
  
  const handleBackupUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setBackupUrl(newUrl);
    localStorage.setItem('backupUrl', newUrl);
    if (!newUrl && backupEnabled) {
        setBackupEnabled(false);
        localStorage.setItem('backupEnabled', 'false');
        toast({ title: "Respaldo desactivado", description: "La URL fue eliminada."});
    }
  };

  const handleBackupEnabledChange = (checked: boolean) => {
      setBackupEnabled(checked);
      localStorage.setItem('backupEnabled', checked.toString());
      if (checked) {
          toast({
              title: "Respaldo Activado",
              description: "Los conteos se respaldarán en tu Google Sheet al cambiar."
          })
      } else {
           toast({
              title: "Respaldo Desactivado",
          })
      }
  };

  const todayIndex = new Date().getDay();

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
        <header className="w-full text-center mb-10">
            <h1 className="text-5xl font-bold text-primary font-headline">Panel de Control</h1>
            <p className="text-muted-foreground mt-2 text-lg">
            Un resumen de todos los documentos que has procesado y accesos directos.
            </p>
        </header>

        <Alert variant="destructive" className="w-full max-w-7xl mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Advertencia</AlertTitle>
            <AlertDescription>
                Los contadores, metas, estadisticas e historial de tramites se guarda localmente en el navegador. Si borras la caché o las cookies de este sitio, estos datos serán eliminados sin posibilidad de recuperación.
            </AlertDescription>
        </Alert>

        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Trámites Totales de la Semana</CardTitle>
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
                     <CardDescription>Establece un objetivo semanal y monitorea tu progreso. Se basa en los trámites de la semana actual.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center pt-6">
                   {isGoalLocked && weeklyGoal ? (
                        <ChartContainer
                          config={radialChartConfig}
                          className="mx-auto aspect-square h-[150px] w-[150px]" // Smaller size
                        >
                          <RadialBarChart
                            data={radialChartData}
                            startAngle={180}
                            endAngle={0}
                            innerRadius={60} // Adjusted
                            outerRadius={80} // Adjusted
                            barSize={15} // Adjusted
                          >
                            <PolarAngleAxis
                              type="number"
                              domain={[0, weeklyGoal]}
                              dataKey="value"
                              tick={false}
                            />
                            <RadialBar
                              dataKey="value"
                              background={{ fill: 'hsla(var(--muted))' }}
                              cornerRadius={10}
                            />
                             <text
                                x="50%"
                                y="50%"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="fill-foreground text-3xl font-bold"
                            >
                                {weeklyTransactions.toLocaleString()}
                            </text>
                            <text
                                x="50%"
                                y="50%"
                                dy="2em"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="fill-muted-foreground text-sm"
                            >
                                de {weeklyGoal?.toLocaleString()}
                            </text>
                          </RadialBarChart>
                        </ChartContainer>
                    ) : (
                        <div className="text-center text-muted-foreground p-8 h-[150px] flex items-center justify-center">
                            <p>Define una meta y bloquéala para empezar a rastrear.</p>
                        </div>
                    )}
                     {isGoalLocked && weeklyGoal && (
                        <p className="text-center mt-4 text-xs text-muted-foreground font-medium">
                            {remainingForGoal > 0
                            ? `¡Te faltan ${remainingForGoal} para llegar a tu meta!`
                            : "¡Felicidades, has alcanzado tu meta!"}
                        </p>
                    )}
                </CardContent>
             </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 lg:col-span-2">
                <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                          <CalendarDays className="h-6 w-6 text-primary"/>
                          <CardTitle>Contador Diario de Trámites</CardTitle>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button variant="outline" size="icon" onClick={handleDownloadStats} title="Descargar Reporte de Conteo">
                           <Download className="h-4 w-4" />
                           <span className="sr-only">Descargar Reporte de Conteo</span>
                         </Button>
                        <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" title="Ajuste Manual">
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Ajuste Manual</span>
                              </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Ajuste Manual de Trámites</DialogTitle>
                              <DialogDescription>
                                Agrega o resta trámites a un día específico de la semana actual.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="day" className="text-right">Día</Label>
                                <Select onValueChange={setAdjustmentDay} value={adjustmentDay}>
                                  <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Selecciona un día" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {orderedDayIndexes.map(dayIndex => (
                                        <SelectItem key={dayIndex} value={dayIndex.toString()}>{dayNames[dayIndex]}</SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="amount" className="text-right">Cantidad</Label>
                                <Input
                                  id="amount"
                                  type="number"
                                  placeholder="+10, -5, etc."
                                  className="col-span-3"
                                  value={adjustmentAmount || ''}
                                  onChange={e => setAdjustmentAmount(parseInt(e.target.value, 10) || 0)}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancelar</Button>
                              </DialogClose>
                              <Button type="submit" onClick={handleManualAdjustment}>Guardar Ajuste</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <CardDescription>Resumen de los trámites realizados durante la semana actual.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {orderedDayIndexes.map(dayIndex => (
                        <Card key={dayIndex} className={cn("flex flex-col items-center justify-center p-4 text-center", dayIndex === todayIndex && "bg-primary/10 border-primary")}>
                           <p className={cn("font-semibold text-sm", dayIndex === todayIndex && "text-primary")}>{dayNames[dayIndex]}</p>
                           <p className="text-3xl font-bold mt-2">{dailyStats[dayIndex] || 0}</p>
                        </Card>
                    ))}
                </CardContent>
            </Card>

             <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 lg:col-span-2">
                <CardHeader>
                    <CardTitle>Rendimiento de la Semana</CardTitle>
                    <CardDescription>Visualización de los trámites por día.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={barChartConfig} className="w-full h-[250px]">
                      <BarChart data={barChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip
                          content={<ChartTooltipContent 
                            labelClassName="font-bold text-primary"
                            indicator="dot"
                          />}
                          cursor={{ fill: "hsl(var(--muted))" }}
                         />
                        <Bar dataKey="trámites" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ChartContainer>
                </CardContent>
             </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 lg:col-span-2">
                 <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                          <History className="h-6 w-6 text-primary"/>
                          <CardTitle>Historial de Trámites de la Semana</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar CURP..."
                                value={curpSearchQuery}
                                onChange={(e) => setCurpSearchQuery(e.target.value)}
                                className="pl-8 w-40"
                            />
                        </div>
                        <Select value={historyFilter} onValueChange={setHistoryFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrar por día..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los días</SelectItem>
                                {orderedDayIndexes.map(dayIndex => (
                                    <SelectItem key={dayIndex} value={dayIndex.toString()}>{dayNames[dayIndex]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={handleDownloadHistory} title="Descargar Historial de CURPs">
                           <Download className="h-4 w-4" />
                           <span className="sr-only">Descargar Historial de CURPs</span>
                         </Button>
                      </div>
                    </div>
                    <CardDescription>
                        Lista de todas las CURPs de los trámites que has realizado esta semana.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-72 w-full rounded-md border">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                <TableHead className="w-[70%]">CURP</TableHead>
                                <TableHead>Día</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHistory.length > 0 ? (
                                    filteredHistory.map((item, index) => (
                                        <TableRow key={`${item.curp}-${index}`}>
                                        <TableCell className="font-mono">{item.curp}</TableCell>
                                        <TableCell>{item.day}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                                            No hay trámites para mostrar.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>

        </div>

        <Card className="w-full max-w-7xl mt-8 shadow-lg">
            <CardHeader>
                <div className="flex items-center space-x-2">
                    <Database className="h-6 w-6 text-primary"/>
                    <CardTitle>Respaldo en Google Sheets</CardTitle>
                </div>
                <CardDescription>
                    Activa esta opción para enviar automáticamente una copia de tus conteos diarios a una hoja de cálculo de Google. 
                    Esto requiere un App Script configurado. Pega la URL de tu Web App abajo.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="backup-url">URL del Web App de Apps Script</Label>
                    <Input 
                        id="backup-url"
                        placeholder="https://script.google.com/macros/s/..."
                        value={backupUrl}
                        onChange={handleBackupUrlChange}
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <Switch 
                        id="backup-switch" 
                        checked={backupEnabled}
                        onCheckedChange={handleBackupEnabledChange}
                        disabled={!backupUrl}
                    />
                    <Label htmlFor="backup-switch">
                        {backupEnabled ? 'Respaldo automático activado' : 'Respaldo automático desactivado'}
                    </Label>
                </div>
                {!backupUrl && (
                    <Alert variant="default" className="border-amber-500 text-amber-700 [&>svg]:text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>URL Requerida</AlertTitle>
                        <AlertDescription>
                            Debes proporcionar una URL para poder activar el respaldo.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    </main>
  );
}
