
"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, Loader2, CheckCircle2, AlertCircle, Trash2, Files, Sparkles, Download, ListPlus, FileCheck2, RefreshCcw, ScanSearch, Wand2 } from 'lucide-react';
import { getReversePdfAsDataUri, extractDocumentDetails } from '../actions';
import { mergePdfsClient, modifyReversePdfClient, addFolioToPdfClient } from '@/lib/pdf-utils';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReverseSideEntry } from '@/lib/types';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { extractDataFromPdf } from '@/lib/ocr-utils';

// --- Manual Mode Types ---
interface ManualQueueItem {
  id: string;
  file: File;
  state: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  resultUrl?: string;
  error?: string;
  curp?: string;
}
interface RawFile {
    id: string;
    file: File;
}

// --- Automated Mode Types ---
interface OcrQueueItem {
    id: string;
    file: File;
    status: 'pending' | 'analyzing' | 'success' | 'error' | 'fusing' | 'done';
    curp: string | null;
    electronicId: string | null;
    issuingEntity: string | null;
    resultUrl?: string;
    error?: string;
}

type OperationMode = 'manual' | 'automated';

// --- LocalStorage Types ---
interface DailyStats {
  weekNumber: number;
  counts: number[];
}

interface CurpHistory {
  weekNumber: number;
  history: Record<number, string[]>;
}

// Helper to get the ISO week number
const getWeekNumber = (d: Date): number => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};

function normalizeString(str: string): string {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

function findReverseSide(entity: string, db: ReverseSideEntry[]): ReverseSideEntry | null {
    if (!entity) return null;
    const normalizedEntity = normalizeString(entity);
    if (normalizedEntity.includes('distritofederal') || normalizedEntity.includes('ciudadmexico')) {
        return db.find(e => normalizeString(e['entidad de registro']).includes('distritofederal')) || null;
    }
    if (normalizedEntity.includes('mexico') && !normalizedEntity.includes('ciudadmexico') && !normalizedEntity.includes('nuevoleon')) {
        return db.find(e => normalizeString(e['entidad de registro']) === 'mexico' || normalizeString(e['entidad de registro']) === 'estadodemexico') || null;
    }
    return db.find(e => normalizeString(e['entidad de registro']) === normalizedEntity) || db.find(e => normalizedEntity.includes(normalizeString(e['entidad de registro']))) || null;
}

export default function BulkFusionClient() {
  const [mode, setMode] = useState<OperationMode>('manual');
  const [addFolio, setAddFolio] = useState(false);
  
  // --- Manual Mode State ---
  const [manualRawFiles, setManualRawFiles] = useState<RawFile[]>([]);
  const [manualQueue, setManualQueue] = useState<ManualQueueItem[]>([]);
  const [isProcessingManual, setIsProcessingManual] = useState(false);
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');
  
  // --- Automated Mode State ---
  const [ocrQueue, setOcrQueue] = useState<OcrQueueItem[]>([]);
  const [isAnalyzingOcr, setIsAnalyzingOcr] = useState(false);
  const [isFusingOcr, setIsFusingOcr] = useState(false);

  // --- Shared State ---
  const [isDragging, setIsDragging] = useState(false);
  const [db, setDb] = useState<ReverseSideEntry[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const { toast } = useToast();

  const activeFile = manualRawFiles.length > 0 ? manualRawFiles[0] : null;

  useEffect(() => {
    try {
      const dbString = localStorage.getItem('reverse-sides-db');
      if (dbString) {
        const parsedDb = JSON.parse(dbString) as ReverseSideEntry[];
        setDb(parsedDb);
        setAvailableStates(parsedDb.map(e => e['entidad de registro']).sort());
      }
    } catch (e) {
      console.error("Failed to load database from localStorage", e);
      toast({ title: 'Base de datos corrupta', variant: 'destructive' });
    }
  }, [toast]);
  
  useEffect(() => {
    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    if (activeFile) {
      const url = URL.createObjectURL(activeFile.file);
      setCurrentPreviewUrl(url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile]);

  // --- Shared Functions ---
  const incrementCounters = (curp: string | null) => {
    const today = new Date();
    const currentWeek = getWeekNumber(today);
    const dayIndex = today.getDay();

    // Increment count
    const currentFusionCount = parseInt(localStorage.getItem('fusionCount') || '0', 10);
    localStorage.setItem('fusionCount', (currentFusionCount + 1).toString());

    // Increment daily stats
    const storedStatsRaw = localStorage.getItem('dailyFusionStats');
    let dailyStats: DailyStats = { weekNumber: currentWeek, counts: Array(7).fill(0) };
    if (storedStatsRaw) {
        try {
            const parsed = JSON.parse(storedStatsRaw);
            if (parsed.weekNumber === currentWeek) dailyStats = parsed;
        } catch (e) { console.error(e); }
    }
    dailyStats.counts[dayIndex] = (dailyStats.counts[dayIndex] || 0) + 1;
    localStorage.setItem('dailyFusionStats', JSON.stringify(dailyStats));
    
    // Add CURP to history
    if (curp) {
        const storedHistoryRaw = localStorage.getItem('curpHistory');
        let curpHistory: CurpHistory = { weekNumber: currentWeek, history: {} };
        if (storedHistoryRaw) {
            try {
                const parsed = JSON.parse(storedHistoryRaw);
                if (parsed.weekNumber === currentWeek) curpHistory = parsed;
            } catch(e) { console.error(e); }
        }
        if (!curpHistory.history[dayIndex]) {
            curpHistory.history[dayIndex] = [];
        }
        curpHistory.history[dayIndex].push(curp);
        localStorage.setItem('curpHistory', JSON.stringify(curpHistory));
    }
  }
  
  const downloadFile = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault(); e.stopPropagation(); setIsDragging(false);
      if (e.dataTransfer.files) handleFileDrop(e.dataTransfer.files);
    },
  };
  
  const handleFileDrop = (files: FileList) => {
    const newFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    if (newFiles.length !== files.length) {
      toast({ title: 'Archivos Inválidos', description: 'Algunos archivos no eran PDF y fueron omitidos.', variant: 'destructive' });
    }

    if (mode === 'manual') {
      const newRawFiles: RawFile[] = newFiles.map(file => ({ id: `${file.name}-${Math.random()}`, file }));
      setManualRawFiles(prev => [...prev, ...newRawFiles]);
    } else { // 'automated'
      const newOcrItems: OcrQueueItem[] = newFiles.map(file => ({
        id: `${file.name}-${Math.random()}`,
        file,
        status: 'pending',
        curp: null,
        electronicId: null,
        issuingEntity: null,
      }));
      setOcrQueue(prev => [...prev, ...newOcrItems]);
    }
  };

  const handleResetAll = () => {
    setManualRawFiles([]);
    setManualQueue([]);
    setSelectedState('');
    setOcrQueue([]);
    setAddFolio(false);
    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
      setCurrentPreviewUrl(null);
    }
  };

  // --- Manual Mode Functions ---
  const handleAddToList = () => {
    if (!activeFile || !selectedState) {
        toast({title: "Falta Información", description: "Debes seleccionar un estado para el archivo actual.", variant: "destructive"});
        return;
    }
    const newItem: ManualQueueItem = { id: activeFile.id, file: activeFile.file, state: selectedState, status: 'pending' };
    setManualQueue(prev => [...prev, newItem]);
    setManualRawFiles(prev => prev.slice(1));
    setSelectedState('');
  };

  const handleRemoveFromManualQueue = (id: string) => setManualQueue(prev => prev.filter(item => item.id !== id));

  const handleProcessManualQueue = async () => {
    const itemsToProcess = manualQueue.filter(item => item.status === 'pending');
    if (itemsToProcess.length === 0) {
      toast({ title: 'No hay archivos pendientes', description: 'Agrega archivos a la cola o ya se han procesado todos.' });
      return;
    }
    setIsProcessingManual(true);
    const successfulDownloads: { url: string; name: string }[] = [];

    for (const item of itemsToProcess) {
      try {
        setManualQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));
        const fileReader = new FileReader();
        const fileDataUri = await new Promise<string>((resolve, reject) => {
          fileReader.onerror = () => reject(new DOMException("Problem parsing file."));
          fileReader.onload = () => resolve(fileReader.result as string);
          fileReader.readAsDataURL(item.file);
        });
        const { curp, electronicId } = await extractDocumentDetails({ pdfDataUri: fileDataUri });
        if (!curp || !electronicId) throw new Error("CURP/ID no extraído.");
        const reverseSideEntry = findReverseSide(item.state, db);
        if (!reverseSideEntry) throw new Error(`Reverso no encontrado para ${item.state}.`);
        const reversePdfDataUri = await getReversePdfAsDataUri(reverseSideEntry['link del reverso para descarga directa']);
        const modifiedReversePdfUri = await modifyReversePdfClient(reversePdfDataUri, curp, electronicId);
        const finalPdf = await mergePdfsClient(fileDataUri, modifiedReversePdfUri);
        incrementCounters(curp);
        const result = { ...item, status: 'success' as const, resultUrl: finalPdf, curp };
        setManualQueue(prev => prev.map(i => i.id === result.id ? result : i));
        successfulDownloads.push({ url: finalPdf, name: `${curp}_SIST.pdf` });
      } catch (e: any) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido.';
        const result = { ...item, status: 'error' as const, error: errorMessage };
        setManualQueue(prev => prev.map(i => i.id === result.id ? result : i));
      }
    }
    
    setIsProcessingManual(false);
    toast({ title: 'Proceso Completado', description: 'Las descargas comenzarán ahora.' });
    successfulDownloads.forEach(file => downloadFile(file.url, file.name));
  };
  
  // --- Automated Mode Functions ---
  const handleAnalyzeOcrQueue = async () => {
    const itemsToAnalyze = ocrQueue.filter(item => item.status === 'pending');
    if (itemsToAnalyze.length === 0) return;

    setIsAnalyzingOcr(true);
    for (const item of itemsToAnalyze) {
        setOcrQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'analyzing' } : i));
        try {
            const fileDataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target?.result as string);
                reader.onerror = e => reject(e);
                reader.readAsDataURL(item.file);
            });
            const { extractedData } = await extractDataFromPdf(fileDataUri);
            if (!extractedData.curp || !extractedData.electronicId || !extractedData.issuingEntity) {
                throw new Error("Datos clave no encontrados.");
            }
            setOcrQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'success', ...extractedData } : i));
        } catch (e: any) {
            const error = e instanceof Error ? e.message : 'Error desconocido.';
            setOcrQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error } : i));
        }
    }
    setIsAnalyzingOcr(false);
    toast({ title: 'Análisis Completado', description: 'Revisa los resultados y procede a fusionar.' });
  };
  
  const handleProcessOcrQueue = async () => {
    const itemsToProcess = ocrQueue.filter(item => item.status === 'success');
    if (itemsToProcess.length === 0) {
        toast({ title: 'No hay archivos válidos para procesar.' });
        return;
    }
    
    setIsFusingOcr(true);
    const successfulDownloads: { url: string; name: string }[] = [];

    for (const item of itemsToProcess) {
        if (!item.curp || !item.electronicId || !item.issuingEntity) continue;
        setOcrQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'fusing' } : i));
        try {
            const fileDataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target?.result as string);
                reader.onerror = e => reject(e);
                reader.readAsDataURL(item.file);
            });

            const reverseSideEntry = findReverseSide(item.issuingEntity, db);
            if (!reverseSideEntry) throw new Error(`Reverso no encontrado para ${item.issuingEntity}.`);
            
            const reversePdfDataUri = await getReversePdfAsDataUri(reverseSideEntry['link del reverso para descarga directa']);
            const modifiedReversePdfUri = await modifyReversePdfClient(reversePdfDataUri, item.curp, item.electronicId);
            let finalPdf = await mergePdfsClient(fileDataUri, modifiedReversePdfUri);

            if (addFolio) {
                finalPdf = await addFolioToPdfClient(finalPdf);
            }
            
            incrementCounters(item.curp);
            
            const result = { ...item, status: 'done' as const, resultUrl: finalPdf };
            setOcrQueue(prev => prev.map(i => i.id === item.id ? result : i));
            successfulDownloads.push({ url: finalPdf, name: `${item.curp}_SIST.pdf`});

        } catch (e: any) {
             const error = e instanceof Error ? e.message : 'Error desconocido.';
             setOcrQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error } : i));
        }
    }

    setIsFusingOcr(false);
    toast({ title: 'Fusión Completada', description: `${successfulDownloads.length} archivos procesados. Las descargas comenzarán.` });
    successfulDownloads.forEach(file => downloadFile(file.url, file.name));
  };
  
  const renderManualMode = () => (
     <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/5 flex flex-col space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>1. Cargar y Configurar</CardTitle>
                    <CardDescription>Arrastra archivos, luego visualízalos y asígnales un estado para añadirlos a la lista.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!activeFile ? (
                        <div
                            {...handleDragEvents}
                            className={`relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70 hover:bg-secondary'}`}
                            onClick={() => document.getElementById('file-upload-manual')?.click()}
                        >
                            <FileUp className="w-12 h-12 text-primary mb-4" />
                            <h3 className="text-lg font-semibold text-foreground">Arrastra y suelta tus actas</h3>
                            <p className="text-muted-foreground mt-1">o haz clic para seleccionar archivos</p>
                            <input id="file-upload-manual" type="file" multiple className="hidden" accept="application/pdf" onChange={(e) => handleFileDrop(e.target.files!)} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Card className="h-[40vh] flex flex-col">
                                <CardHeader className="p-4"><CardTitle className="text-base truncate">Visualizando: {activeFile.file.name}</CardTitle></CardHeader>
                                <CardContent className="flex-grow p-0">
                                    <div className="w-full h-full bg-secondary rounded-b-lg flex items-center justify-center">
                                    {currentPreviewUrl ? (
                                        <object data={currentPreviewUrl} type="application/pdf" className="w-full h-full rounded-b-lg" />
                                    ) : <Loader2 className="w-8 h-8 animate-spin" />}
                                    </div>
                                </CardContent>
                            </Card>
                            <Select onValueChange={setSelectedState} value={selectedState}>
                                <SelectTrigger><SelectValue placeholder="Selecciona un estado..." /></SelectTrigger>
                                <SelectContent>{availableStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button onClick={handleAddToList} disabled={!selectedState} className="w-full">
                                <ListPlus className="mr-2 h-4 w-4" /> Añadir a la Lista ({manualRawFiles.length - 1} restantes)
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
        <div className="lg:w-3/5 flex flex-col">
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle>2. Lista de Procesamiento</CardTitle>
                    <CardDescription>Cuando tus archivos estén en la lista, presiona "Procesar Lista".</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto">
                    <div className="w-full h-full bg-background rounded-lg border">
                        {manualQueue.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40%]">Archivo</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {manualQueue.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium truncate max-w-[120px]">{item.file.name}</TableCell>
                                            <TableCell>{item.state}</TableCell>
                                            <TableCell>{item.status}</TableCell>
                                            <TableCell className="text-right">
                                                 {item.status === 'success' && item.resultUrl ? (
                                                    <Button variant="outline" size="sm" onClick={() => downloadFile(item.resultUrl!, `${item.curp || item.file.name.replace('.pdf', '')}_SIST.pdf`)}><Download className="h-4 w-4"/></Button>
                                                  ) : (
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveFromManualQueue(item.id)} disabled={isProcessingManual}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                  )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center text-muted-foreground p-8 h-full flex flex-col justify-center items-center">
                                <Files className="w-20 h-20 mx-auto mb-4"/><p>La cola de procesamiento está vacía</p>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex-col space-y-2 pt-6">
                    <Button onClick={handleProcessManualQueue} disabled={isProcessingManual || manualQueue.every(i => i.status !== 'pending')} className="w-full">
                        {isProcessingManual ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isProcessingManual ? 'Procesando...' : `Procesar Lista (${manualQueue.filter(i => i.status === 'pending').length} Archivos)`}
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
  );
  
  const renderAutomatedMode = () => {
    const isReadyForFusion = ocrQueue.some(item => item.status === 'success');
    const isAnythingProcessing = isAnalyzingOcr || isFusingOcr;

    return (
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Cargar Archivos</CardTitle>
            <CardDescription>Arrastra todos los PDF que quieras procesar a la zona de abajo.</CardDescription>
          </CardHeader>
          <CardContent>
              <div
                  {...handleDragEvents}
                  className={`relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70 hover:bg-secondary'}`}
                  onClick={() => document.getElementById('file-upload-automated')?.click()}
              >
                  <FileUp className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-lg font-semibold text-foreground">Arrastra y suelta tus actas</h3>
                  <p className="text-muted-foreground mt-1">o haz clic para seleccionar archivos</p>
                  <input id="file-upload-automated" type="file" multiple className="hidden" accept="application/pdf" onChange={(e) => handleFileDrop(e.target.files!)} />
              </div>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>2. Analizar y Fusionar</CardTitle>
                <CardDescription>Usa los botones para analizar los documentos y luego fusionarlos.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="w-full bg-background rounded-lg border min-h-[200px]">
                  {ocrQueue.length > 0 ? (
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead className="w-[35%]">Archivo</TableHead>
                                  <TableHead>CURP</TableHead>
                                  <TableHead>ID Electrónico</TableHead>
                                  <TableHead>Entidad</TableHead>
                                  <TableHead>Status</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {ocrQueue.map(item => (
                                  <TableRow key={item.id} className={item.status === 'success' || item.status === 'done' ? 'bg-green-500/10' : item.status === 'error' ? 'bg-destructive/10' : ''}>
                                      <TableCell className="font-medium truncate max-w-xs">{item.file.name}</TableCell>
                                      <TableCell>{item.curp || '...'}</TableCell>
                                      <TableCell>{item.electronicId || '...'}</TableCell>
                                      <TableCell>{item.issuingEntity || '...'}</TableCell>
                                      <TableCell>{item.status}</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  ) : (
                      <div className="text-center text-muted-foreground p-8 h-full flex flex-col justify-center items-center">
                          <Files className="w-20 h-20 mx-auto mb-4"/>
                          <p>Carga archivos para verlos aquí</p>
                      </div>
                  )}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleAnalyzeOcrQueue} disabled={isAnythingProcessing || ocrQueue.length === 0} className="w-full sm:w-auto">
                    {isAnalyzingOcr ? <Loader2 className="animate-spin mr-2"/> : <ScanSearch className="mr-2" />}
                    {isAnalyzingOcr ? 'Analizando...' : `Empezar Análisis (${ocrQueue.filter(i => i.status === 'pending').length})`}
                </Button>
                 <Button onClick={handleProcessOcrQueue} disabled={isAnythingProcessing || !isReadyForFusion} className="w-full sm:w-auto">
                    {isFusingOcr ? <Loader2 className="animate-spin mr-2"/> : <Wand2 className="mr-2" />}
                    {isFusingOcr ? 'Fusionando...' : `Procesar y Descargar (${ocrQueue.filter(i => i.status === 'success').length})`}
                </Button>
            </CardFooter>
        </Card>
      </div>
    )
  };

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-bold text-primary font-headline">Fusión Masiva</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Sube múltiples actas de nacimiento para fusionarlas con su reverso oficial en lote.
        </p>
      </header>

       <Card className="w-full max-w-md mx-auto mb-8">
            <CardContent className="p-4 flex flex-col gap-4">
                 <div className="flex items-center justify-center space-x-4">
                    <Label htmlFor="mode-switch" className={mode === 'manual' ? 'font-bold text-primary' : 'text-muted-foreground'}>
                      Manual
                    </Label>
                    <Switch 
                        id="mode-switch"
                        checked={mode === 'automated'}
                        onCheckedChange={(checked) => {
                            const newMode = checked ? 'automated' : 'manual';
                            setMode(newMode);
                            if (newMode === 'manual') {
                                setAddFolio(false);
                            }
                        }}
                        disabled={isProcessingManual || isAnalyzingOcr || isFusingOcr}
                    />
                    <Label htmlFor="mode-switch" className={mode === 'automated' ? 'font-bold text-primary' : 'text-muted-foreground'}>
                      Automatizado
                    </Label>
                </div>
                {mode === 'automated' && (
                    <>
                        <div className="w-full border-t"></div>
                        <div className="flex items-center justify-center space-x-2">
                            <Switch id="folio-switch" checked={addFolio} onCheckedChange={setAddFolio} />
                            <Label htmlFor="folio-switch">Añadir Folio</Label>
                        </div>
                    </>
                )}
            </CardContent>
             <CardFooter className="p-2 pt-0">
                <Button onClick={handleResetAll} variant="outline" size="sm" className="w-full" disabled={isProcessingManual || isAnalyzingOcr || isFusingOcr}>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Limpiar Todo
                </Button>
            </CardFooter>
      </Card>
      
      {mode === 'manual' ? renderManualMode() : renderAutomatedMode()}

    </main>
  );
}
