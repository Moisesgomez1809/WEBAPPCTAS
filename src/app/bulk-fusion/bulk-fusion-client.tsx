
"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, Loader2, CheckCircle2, AlertCircle, Trash2, Files, Sparkles, Download, ListPlus, FileCheck2, RefreshCcw } from 'lucide-react';
import { getReversePdfAsDataUri, extractDocumentDetails } from '../actions';
import { mergePdfsClient, modifyReversePdfClient } from '@/lib/pdf-utils';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReverseSideEntry } from '@/lib/types';
import Link from 'next/link';
import UtilitiesCalculator from '@/components/utilities-calculator';

interface QueueItem {
  id: string;
  file: File;
  state: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  resultUrl?: string;
  error?: string;
  curp?: string;
  providerCost: number;
  clientCost: number;
  profit: number;
}

interface RawFile {
    id: string;
    file: File;
}

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
  const [rawFiles, setRawFiles] = useState<RawFile[]>([]);
  const [processingQueue, setProcessingQueue] = useState<QueueItem[]>([]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [db, setDb] = useState<ReverseSideEntry[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');
  
  const [providerCost, setProviderCost] = useState('');
  const [clientCost, setClientCost] = useState('');
  const [profit, setProfit] = useState(0);

  const { toast } = useToast();

  const activeFile = rawFiles.length > 0 ? rawFiles[0] : null;

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
    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
      setCurrentPreviewUrl(null);
    }
    if (activeFile) {
      const url = URL.createObjectURL(activeFile.file);
      setCurrentPreviewUrl(url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile]);

  useEffect(() => {
    const pCost = parseFloat(providerCost) || 0;
    const cCost = parseFloat(clientCost) || 0;
    setProfit(cCost - pCost);
  }, [providerCost, clientCost]);

  const handleFileChange = (files: FileList | null) => {
    if (files) {
      const newFiles = Array.from(files).filter(file => file.type === 'application/pdf');
      if (newFiles.length !== files.length) {
        toast({ title: 'Archivos Inválidos', description: 'Algunos archivos no eran PDF y fueron omitidos.', variant: 'destructive' });
      }
      const newRawFiles: RawFile[] = newFiles.map(file => ({
        id: `${file.name}-${Math.random()}`,
        file,
      }));
      setRawFiles(prev => [...prev, ...newRawFiles]);
    }
  };

  const handleAddToList = () => {
    if (!activeFile || !selectedState) {
        toast({title: "Falta Información", description: "Debes seleccionar un estado para el archivo actual.", variant: "destructive"});
        return;
    }
    const newItem: QueueItem = {
        id: activeFile.id,
        file: activeFile.file,
        state: selectedState,
        status: 'pending',
        providerCost: parseFloat(providerCost) || 0,
        clientCost: parseFloat(clientCost) || 0,
        profit: profit
    };
    setProcessingQueue(prev => [...prev, newItem]);
    setRawFiles(prev => prev.slice(1)); // Remove the processed file from raw files
    setSelectedState(''); // Reset select
    // No reseteamos los costos para que se puedan reusar en el siguiente archivo
  };

  const handleRemoveFromQueue = (id: string) => {
    setProcessingQueue(prev => prev.filter(item => item.id !== id));
  };
  
  const downloadFile = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessQueue = async () => {
    const itemsToProcess = processingQueue.filter(item => item.status === 'pending');
    if (itemsToProcess.length === 0) {
      toast({ title: 'No hay archivos pendientes', description: 'Agrega archivos a la cola o ya se han procesado todos.' });
      return;
    }
    
    setIsProcessing(true);
    const successfulDownloads: { url: string; name: string }[] = [];
    let totalProfitThisSession = 0;

    const promises = itemsToProcess.map(async (item) => {
      try {
        setProcessingQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));
        
        const fileReader = new FileReader();
        const fileDataUri = await new Promise<string>((resolve, reject) => {
          fileReader.onerror = () => {
            fileReader.abort();
            reject(new DOMException("Problem parsing input file."));
          };
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
        
        const currentFusionCount = parseInt(localStorage.getItem('fusionCount') || '0', 10);
        localStorage.setItem('fusionCount', (currentFusionCount + 1).toString());
        
        if (item.profit > 0) {
            totalProfitThisSession += item.profit;
        }

        return { ...item, status: 'success' as 'success', resultUrl: finalPdf, curp };

      } catch (e: any) {
        console.error(`Error processing ${item.file.name}:`, e);
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido.';
        return { ...item, status: 'error' as 'error', error: errorMessage };
      }
    });
    
    for (const promise of promises) {
        const result = await promise;
        setProcessingQueue(prev => prev.map(i => i.id === result.id ? result : i));
        if (result.status === 'success' && result.resultUrl) {
            successfulDownloads.push({
                url: result.resultUrl,
                name: `${result.curp || result.file.name.replace('.pdf', '')}.pdf`
            });
        }
    }
    
    // Save total profit from this session to localStorage
    if (totalProfitThisSession > 0) {
        const currentTotalProfit = parseFloat(localStorage.getItem('totalProfit') || '0');
        localStorage.setItem('totalProfit', (currentTotalProfit + totalProfitThisSession).toString());
        toast({
            title: "Utilidad Guardada",
            description: `Se añadieron ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalProfitThisSession)} a tus ganancias totales.`,
        });
    }

    setIsProcessing(false);
    toast({ title: 'Proceso Completado', description: 'Se han procesado todos los archivos. Las descargas comenzarán ahora.' });
    
    // Automatically download all successful files.
    successfulDownloads.forEach(file => downloadFile(file.url, file.name));
  };
  
  const handleDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault(); e.stopPropagation(); setIsDragging(false);
      if (e.dataTransfer.files) handleFileChange(e.dataTransfer.files);
    },
  };

  const renderStatusIcon = (item: QueueItem) => {
    switch (item.status) {
        case 'pending': return <span className="text-muted-foreground">Pendiente</span>;
        case 'processing': return <span className="text-blue-500 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Procesando</span>;
        case 'success': return <span className="text-green-500 flex items-center"><CheckCircle2 className="mr-2 h-4 w-4"/>Éxito</span>;
        case 'error': return <span className="text-destructive flex items-center" title={item.error}><AlertCircle className="mr-2 h-4 w-4"/>Error</span>;
    }
  }

  const renderActionCell = (item: QueueItem) => {
    if (item.status === 'success' && item.resultUrl) {
      return (
        <Button variant="outline" size="sm" onClick={() => downloadFile(item.resultUrl!, `${item.curp || item.file.name.replace('.pdf','')}.pdf`)}>
            <Download className="h-4 w-4"/>
        </Button>
      );
    }
    return (
      <Button variant="ghost" size="icon" onClick={() => handleRemoveFromQueue(item.id)} disabled={isProcessing}>
          <Trash2 className="h-4 w-4 text-destructive"/>
      </Button>
    );
  }
  
  const handleResetAll = () => {
    setRawFiles([]);
    setProcessingQueue([]);
    setSelectedState('');
    setProviderCost('');
    setClientCost('');
    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
      setCurrentPreviewUrl(null);
    }
  };
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);


  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-bold text-primary font-headline">Fusión Masiva</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Sube múltiples actas de nacimiento para fusionarlas con su reverso oficial en lote.
        </p>
         <div className="mt-6 flex justify-center gap-4 flex-wrap">
            <Link href="/dashboard"><Button variant="outline">Fusión Individual</Button></Link>
            <Link href="/frame"><Button variant="outline">Enmarcar Acta</Button></Link>
            <Link href="/metadata"><Button variant="outline">Modificar Metadata</Button></Link>
            <Link href="/home"><Button variant="secondary">Ver Dashboard</Button></Link>
        </div>
      </header>
      
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* Left column: Upload and Configure */}
        <div className="lg:w-2/5 flex flex-col space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>1. Cargar y Configurar Archivos</CardTitle>
                    <CardDescription>Arrastra archivos, luego visualízalos y asígnales un estado y costo para añadirlos a la lista de procesamiento.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!activeFile ? (
                        <div
                            {...handleDragEvents}
                            className={`relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70 hover:bg-secondary'}`}
                            onClick={() => document.getElementById('file-upload')?.click()}
                        >
                            <FileUp className="w-12 h-12 text-primary mb-4" />
                            <h3 className="text-lg font-semibold text-foreground">Arrastra y suelta tus actas</h3>
                            <p className="text-muted-foreground mt-1">o haz clic para seleccionar archivos</p>
                            <input id="file-upload" type="file" multiple className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e.target.files)} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Card className="h-[40vh] flex flex-col">
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base truncate">Visualizando: {activeFile.file.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow p-0">
                                    <div className="w-full h-full bg-secondary rounded-b-lg flex items-center justify-center">
                                    {currentPreviewUrl ? (
                                        <object data={currentPreviewUrl} type="application/pdf" className="w-full h-full rounded-b-lg">
                                            <p className="p-4 text-center text-destructive">No se puede mostrar la vista previa.</p>
                                        </object>
                                    ) : <Loader2 className="w-8 h-8 animate-spin" />}
                                    </div>
                                </CardContent>
                            </Card>
                            <Select onValueChange={setSelectedState} value={selectedState}>
                                <SelectTrigger><SelectValue placeholder="Selecciona un estado..." /></SelectTrigger>
                                <SelectContent>
                                    {availableStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <UtilitiesCalculator
                                providerCost={providerCost}
                                clientCost={clientCost}
                                profit={profit}
                                onProviderCostChange={setProviderCost}
                                onClientCostChange={setClientCost}
                            />
                            <Button onClick={handleAddToList} disabled={!selectedState} className="w-full">
                                <ListPlus className="mr-2 h-4 w-4" /> Añadir a la Lista ({rawFiles.length - 1} restantes)
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Right column: Processing Queue */}
        <div className="lg:w-3/5 flex flex-col">
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle>2. Lista de Procesamiento</CardTitle>
                    <CardDescription>
                    Cuando todos tus archivos estén en la lista, presiona "Procesar Lista".
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto">
                    <div className="w-full h-full bg-background rounded-lg border">
                        {processingQueue.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[30%]">Archivo</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Costo</TableHead>
                                        <TableHead>Venta</TableHead>
                                        <TableHead>Ganancia</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {processingQueue.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium truncate max-w-[120px]">{item.file.name}</TableCell>
                                            <TableCell>{item.state}</TableCell>
                                            <TableCell>{formatCurrency(item.providerCost)}</TableCell>
                                            <TableCell>{formatCurrency(item.clientCost)}</TableCell>
                                            <TableCell className="text-green-600 font-medium">{formatCurrency(item.profit)}</TableCell>
                                            <TableCell>{renderStatusIcon(item)}</TableCell>
                                            <TableCell className="text-right">{renderActionCell(item)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center text-muted-foreground p-8 h-full flex flex-col justify-center items-center">
                                <Files className="w-20 h-20 mx-auto mb-4"/>
                                <p>La cola de procesamiento está vacía</p>
                                <p className="text-xs mt-2">Añade archivos desde el panel izquierdo.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex-col space-y-2 pt-6">
                        <Button onClick={handleProcessQueue} disabled={isProcessing || processingQueue.every(i => i.status !== 'pending')} className="w-full">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isProcessing ? 'Procesando...' : `Procesar Lista (${processingQueue.filter(i => i.status === 'pending').length} Archivos)`}
                    </Button>
                    <Button onClick={handleResetAll} variant="destructive" className="w-full" disabled={isProcessing}>
                        <RefreshCcw className="mr-2 h-4 w-4" /> Limpiar Todo
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </main>
  );
}

    