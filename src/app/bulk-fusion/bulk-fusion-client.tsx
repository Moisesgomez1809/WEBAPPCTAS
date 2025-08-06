
"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, Loader2, CheckCircle2, AlertCircle, Trash2, Files, Sparkles, Download } from 'lucide-react';
import { getReversePdfAsDataUri, extractDocumentDetails } from '../actions';
import { mergePdfsClient, modifyReversePdfClient } from '@/lib/pdf-utils';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReverseSideEntry } from '@/lib/types';
import Link from 'next/link';

interface FileQueueItem {
  id: string;
  file: File;
  state: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  resultUrl?: string;
  error?: string;
  curp?: string;
}

function normalizeString(str: string): string {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

function findReverseSide(entity: string, db: ReverseSideEntry[]): ReverseSideEntry | null {
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [selectedState, setSelectedState] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [db, setDb] = useState<ReverseSideEntry[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { toast } = useToast();

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

  const handleFileChange = (files: FileList | null) => {
    if (files) {
      const newFiles = Array.from(files).filter(file => file.type === 'application/pdf');
      if (newFiles.length !== files.length) {
        toast({ title: 'Archivos Inválidos', description: 'Algunos archivos no eran PDF y fueron omitidos.', variant: 'destructive' });
      }
      setPendingFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleAddToList = () => {
    if (pendingFiles.length === 0) {
      toast({ title: 'No hay archivos', description: 'Arrastra o selecciona archivos PDF para agregar.'});
      return;
    }
    if (!selectedState) {
      toast({ title: 'Estado no seleccionado', description: 'Por favor, selecciona un estado para los archivos.'});
      return;
    }
    const newQueueItems: FileQueueItem[] = pendingFiles.map(file => ({
      id: `${file.name}-${Math.random()}`,
      file,
      state: selectedState,
      status: 'pending',
    }));
    setFileQueue(prev => [...prev, ...newQueueItems]);
    setPendingFiles([]); // Clear pending files after adding them to the queue
  };
  
  const handleRemoveFromQueue = (id: string) => {
    setFileQueue(prev => prev.filter(item => item.id !== id));
  };
  
  const handleProcessQueue = async () => {
    const itemsToProcess = fileQueue.filter(item => item.status === 'pending');
    if (itemsToProcess.length === 0) {
      toast({ title: 'No hay archivos pendientes', description: 'Agrega archivos a la cola o ya se han procesado todos.' });
      return;
    }
    setIsProcessing(true);

    const promises = itemsToProcess.map(async (item) => {
      try {
        setFileQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));
        
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

        return { ...item, status: 'success' as 'success', resultUrl: finalPdf, curp };

      } catch (e: any) {
        console.error(`Error processing ${item.file.name}:`, e);
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido.';
        return { ...item, status: 'error' as 'error', error: errorMessage };
      }
    });
    
    // Process one by one and update the UI
    for (const promise of promises) {
        const result = await promise;
        setFileQueue(prev => prev.map(i => i.id === result.id ? result : i));
    }

    setIsProcessing(false);
    toast({ title: 'Proceso Completado', description: 'Se han procesado todos los archivos pendientes de la cola.' });
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

  const renderStatusIcon = (item: FileQueueItem) => {
    switch (item.status) {
        case 'pending': return <span className="text-muted-foreground">Pendiente</span>;
        case 'processing': return <span className="text-blue-500 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Procesando</span>;
        case 'success': return <span className="text-green-500 flex items-center"><CheckCircle2 className="mr-2 h-4 w-4"/>Éxito</span>;
        case 'error': return <span className="text-destructive flex items-center" title={item.error}><AlertCircle className="mr-2 h-4 w-4"/>Error</span>;
    }
  }

  const renderActionCell = (item: FileQueueItem) => {
    if (item.status === 'success' && item.resultUrl) {
      return (
        <a href={item.resultUrl} download={`${item.curp || item.file.name.replace('.pdf','')}.pdf`}>
          <Button variant="outline" size="sm"><Download className="h-4 w-4"/></Button>
        </a>
      );
    }
    return (
      <Button variant="ghost" size="icon" onClick={() => handleRemoveFromQueue(item.id)} disabled={isProcessing}>
          <Trash2 className="h-4 w-4 text-destructive"/>
      </Button>
    );
  }

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
      
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>1. Cargar Archivos</CardTitle>
                    <CardDescription>Arrastra y suelta o selecciona múltiples archivos PDF.</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>2. Configurar y Agregar a la Cola</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Select onValueChange={setSelectedState} value={selectedState}>
                        <SelectTrigger><SelectValue placeholder="Selecciona un estado para el lote..." /></SelectTrigger>
                        <SelectContent>
                            {availableStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {pendingFiles.length > 0 && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>{pendingFiles.length} archivo(s) listo(s) para agregar</AlertTitle>
                            <AlertDescription>
                                Los archivos se agregarán a la cola con el estado: <strong>{selectedState || '(Ninguno seleccionado)'}</strong>.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter>
                     <Button onClick={handleAddToList} disabled={pendingFiles.length === 0 || !selectedState} className="w-full">
                        <Files className="mr-2 h-4 w-4" /> Agregar {pendingFiles.length > 0 ? pendingFiles.length : ''} archivo(s) a la lista
                    </Button>
                </CardFooter>
            </Card>
        </div>
        
        <div className="lg:h-auto">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>3. Lista de Procesamiento</CardTitle>
              <CardDescription>
                Archivos listos para ser procesados. Presiona "Procesar Lista" cuando estés listo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto">
                <div className="w-full h-full bg-background rounded-lg border">
                    {fileQueue.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Archivo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fileQueue.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium truncate max-w-[200px]">{item.file.name}</TableCell>
                                        <TableCell>{item.state}</TableCell>
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
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex-col space-y-2 pt-6">
                 <Button onClick={handleProcessQueue} disabled={isProcessing || fileQueue.every(i => i.status !== 'pending')} className="w-full">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                    {isProcessing ? 'Procesando...' : 'Procesar Lista'}
                </Button>
                <Button onClick={() => setFileQueue([])} variant="destructive" className="w-full" disabled={isProcessing}>
                    <Trash2 className="mr-2 h-4 w-4" /> Limpiar Lista
                </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}

    