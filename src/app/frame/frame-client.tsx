
"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Download, Loader2, FileCheck2, AlertCircle, Sparkles, RefreshCcw, BarChart3, Frame, Combine, Stamp, FileCog } from 'lucide-react';
import { getReversePdfAsDataUri, extractDocumentDetails } from '../actions';
import { framePdfClient, mergePdfsClient, modifyReversePdfClient } from '@/lib/pdf-utils';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReverseSideEntry } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import UtilitiesCalculator from '@/components/utilities-calculator';

type Status = 'idle' | 'loading' | 'success' | 'error';
type LoadingStep = 'idle' | 'finding_frame' | 'framing' | 'extractingDetails' | 'matching' | 'modifying' | 'merging' | 'done';

const loadingMessages: Record<LoadingStep, string> = {
  idle: 'Esperando para empezar...',
  finding_frame: 'Buscando el marco en tu base de datos...',
  framing: 'Aplicando el marco al acta...',
  extractingDetails: 'Extrayendo CURP e Identificador Electrónico...',
  matching: 'Buscando el reverso correcto...',
  modifying: 'Creando el nuevo código QR para el reverso...',
  merging: 'Fusionando el acta enmarcada con el reverso...',
  done: '¡Tu documento enmarcado está listo!',
};

function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, '');
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

export default function FrameClient() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [finalPdfUrl, setFinalPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [db, setDb] = useState<ReverseSideEntry[]>([]);
  const [manualEntity, setManualEntity] = useState<string>("");
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [entity, setEntity] = useState<string | null>(null);
  const [extractedCurp, setExtractedCurp] = useState<string | null>(null);
  
  const [providerCost, setProviderCost] = useState('');
  const [clientCost, setClientCost] = useState('');
  const [profit, setProfit] = useState(0);

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    try {
      const dbString = localStorage.getItem('reverse-sides-db');
      if (dbString) {
        const parsedDb = JSON.parse(dbString) as ReverseSideEntry[];
        setDb(parsedDb);
        const states = parsedDb
          .map(e => e['entidad de registro'])
          .filter(name => normalizeString(name) !== 'marcoactas')
          .sort();
        setAvailableStates(states);
      } else {
        toast({ title: 'Base de datos no encontrada', description: 'Redirigiendo a la página de carga.', variant: 'destructive' });
        router.replace('/upload');
      }
    } catch (e) {
      console.error("Failed to load database from localStorage", e);
      toast({ title: 'Base de datos corrupta', description: 'Por favor, carga el archivo de la base de datos de nuevo.', variant: 'destructive' });
      localStorage.removeItem('reverse-sides-db');
      router.replace('/upload');
    }
  }, [router, toast]);
  
  useEffect(() => {
    const pCost = parseFloat(providerCost) || 0;
    const cCost = parseFloat(clientCost) || 0;
    setProfit(cCost - pCost);
  }, [providerCost, clientCost]);

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setOriginalFile(null);
    setPdfDataUri(null);
    setPreviewUrl(null);
    setFinalPdfUrl(null);
    setStatus('idle');
    setLoadingStep('idle');
    setError(null);
    setEntity(null);
    setManualEntity("");
    setExtractedCurp(null);
    setProviderCost('');
    setClientCost('');
  }, [previewUrl]);

  const handleFileChange = (file: File | null) => {
    if (file && file.type === 'application/pdf') {
      handleReset();
      setOriginalFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      const reader = new FileReader();
      reader.onload = (e) => setPdfDataUri(e.target?.result as string);
      reader.readAsDataURL(file);
      setError(null);
    } else {
      setError('Por favor, sube un archivo PDF válido.');
      toast({ title: "Tipo de Archivo Inválido", description: "Por favor, sube un archivo PDF válido.", variant: "destructive" });
    }
  };
  
  const handleDownloadAndSave = () => {
    if (!finalPdfUrl) return;

    try {
      if (profit > 0) {
        const currentProfit = parseFloat(localStorage.getItem('totalProfit') || '0');
        const newTotalProfit = currentProfit + profit;
        localStorage.setItem('totalProfit', newTotalProfit.toString());
         toast({
            title: "Utilidad Guardada",
            description: `Se añadieron ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(profit)} a tus ganancias.`,
        });
      }

      const currentCount = parseInt(localStorage.getItem('frameCount') || '0', 10);
      localStorage.setItem('frameCount', (currentCount + 1).toString());

      const link = document.createElement('a');
      link.href = finalPdfUrl;
      link.download = extractedCurp ? `${extractedCurp}-enmarcado.pdf` : 'acta-enmarcada.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
        console.error("Failed to save data or download", e);
        toast({
            title: "Error",
            description: "No se pudo guardar la utilidad o descargar el archivo.",
            variant: "destructive",
        });
    }
  };

  const setPreviewFromDataUri = async (dataUri: string) => {
    try {
      const res = await fetch(dataUri);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(objectUrl);
    } catch (e) {
      console.error("Failed to create preview URL", e);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(dataUri);
    }
  };

  const processFramingAndFusion = async (entityToUse: string) => {
    if (!pdfDataUri || !entityToUse) {
       toast({
        title: "Selección Requerida",
        description: "Por favor, selecciona un estado antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    setStatus('loading');
    setError(null);
    setEntity(null);
    setExtractedCurp(null);
    setLoadingStep('finding_frame');

    try {
      const framingPromise = (async () => {
        const frameEntry = db.find(e => normalizeString(e['entidad de registro']) === 'marcoactas');
        if (!frameEntry) throw new Error('No se encontró "MARCO ACTAS" en tu base de datos.');
        const framePdfUri = await getReversePdfAsDataUri(frameEntry['link del reverso para descarga directa']);
        setLoadingStep('framing');
        return framePdfClient(pdfDataUri, framePdfUri);
      })();

      const reverseSidePromise = (async () => {
        setLoadingStep('extractingDetails');
        const { curp, electronicId } = await extractDocumentDetails({ pdfDataUri });
        if (!curp || !electronicId) throw new Error("No se pudo extraer la CURP o el Identificador Electrónico.");
        
        setEntity(entityToUse);
        
        setLoadingStep('matching');
        const reverseSideEntry = findReverseSide(entityToUse, db);
        if (!reverseSideEntry) throw new Error(`No se pudo encontrar un reverso para "${entityToUse}".`);
        const reversePdfDataUri = await getReversePdfAsDataUri(reverseSideEntry['link del reverso para descarga directa']);

        setLoadingStep('modifying');
        const modifiedReversePdfUri = await modifyReversePdfClient(reversePdfDataUri, curp, electronicId);
        
        return { modifiedReversePdfUri, curp };
      })();

      const [framedPdf, { modifiedReversePdfUri, curp }] = await Promise.all([framingPromise, reverseSidePromise]);
      setExtractedCurp(curp);

      setLoadingStep('merging');
      const mergedPdf = await mergePdfsClient(framedPdf, modifiedReversePdfUri);

      setFinalPdfUrl(mergedPdf);
      await setPreviewFromDataUri(mergedPdf);

      setLoadingStep('done');
      setStatus('success');
      toast({ title: "¡Éxito!", description: "Tu PDF ha sido enmarcado y fusionado con su reverso." });

    } catch (e: any) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido.';
      setError(`El proceso falló: ${errorMessage}`);
      setStatus('error');
      toast({ title: "El Proceso Falló", description: errorMessage, variant: "destructive" });
    }
  };

  const handleDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault(); e.stopPropagation(); setIsDragging(false);
      if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    },
  };

  const renderDropzone = () => (
    <div
      {...handleDragEvents}
      className={`relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70 hover:bg-secondary'}`}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <FileUp className="w-16 h-16 text-primary mb-4" />
      <h3 className="text-xl font-semibold text-foreground">Arrastra y suelta tu acta sin marco</h3>
      <p className="text-muted-foreground mt-2">o haz clic para seleccionar un archivo PDF</p>
      <input id="file-upload" type="file" className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
    </div>
  );

  const renderProcessingState = () => (
    <Card>
      <CardHeader>
        <CardTitle>Información del Archivo</CardTitle>
        <CardDescription>{originalFile?.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === 'loading' ? (
          <div className="flex flex-col items-center justify-center space-y-4 p-8 bg-background rounded-lg">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-medium text-foreground">{loadingMessages[loadingStep]}</p>
            {entity && <p className="text-sm text-muted-foreground">Entidad: {entity}</p>}
          </div>
        ) : (
          <div className="pt-4 space-y-4">
              <p className="text-sm text-muted-foreground">Selecciona manualmente el estado para encontrar el reverso.</p>
               <Select onValueChange={setManualEntity} value={manualEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estado..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => processFramingAndFusion(manualEntity)} disabled={!manualEntity} className="w-full">
                <Frame className="mr-2 h-4 w-4" /> Enmarcar y Fusionar
              </Button>
            </div>
        )}
        {status === 'success' && finalPdfUrl && (
          <Button onClick={handleDownloadAndSave} className="w-full bg-green-500 hover:bg-green-600 text-white">
            <Download className="mr-2 h-4 w-4" /> Descargar PDF Final
          </Button>
        )}
         <UtilitiesCalculator
          providerCost={providerCost}
          clientCost={clientCost}
          profit={profit}
          onProviderCostChange={setProviderCost}
          onClientCostChange={setClientCost}
        />
      </CardContent>
      <CardFooter className="flex-col sm:flex-row gap-2 justify-between items-center">
        {entity && status !== 'loading' && (
          <p className="text-sm text-muted-foreground">Entidad Seleccionada: <strong>{entity}</strong></p>
        )}
        <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto mt-2 sm:mt-0 ml-auto">
          <RefreshCcw className="mr-2 h-4 w-4" /> Empezar de Nuevo
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col items-center">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-bold text-primary font-headline">Enmarcar Acta</h1>
        <p className="text-muted-foreground mt-2 text-lg">Sube un acta para enmarcarla y añadirle su reverso oficial.</p>
        <div className="mt-6 flex justify-center gap-4 flex-wrap">
          <Link href="/dashboard"><Button variant="outline"><Combine className="mr-2 h-4 w-4" />Ir a Acta Fusion</Button></Link>
          <Link href="/metadata"><Button variant="outline"><FileCog className="mr-2 h-4 w-4"/>Modificar Metadata</Button></Link>
          <Link href="/"><Button variant="secondary"><BarChart3 className="mr-2 h-4 w-4" />Ver Dashboard</Button></Link>
        </div>
      </header>
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col space-y-8">
          {originalFile ? renderProcessingState() : renderDropzone()}
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <div className="lg:h-[70vh]">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Vista Previa del PDF</CardTitle>
                <CardDescription>
                    {status === 'loading'
                    ? 'Procesando tu documento...'
                    : finalPdfUrl
                    ? 'Tu documento enmarcado está listo.'
                    : previewUrl
                    ? 'Vista previa de tu documento.'
                    : 'Sube un archivo para ver la vista previa.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="w-full h-full bg-secondary rounded-lg flex items-center justify-center">
                {status === 'loading' ? (
                    <div className="flex flex-col items-center justify-center space-y-4 p-8 bg-background rounded-lg text-center">
                        <Loader2 className="w-16 h-16 text-primary animate-spin" />
                        <p className="text-lg font-medium text-foreground">{loadingMessages[loadingStep]}</p>
                    </div>
                ) : previewUrl ? (
                  <object data={previewUrl} type="application/pdf" className="w-full h-full rounded-lg">
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                      <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
                      <p className="font-semibold">No se puede mostrar la vista previa del PDF.</p>
                    </div>
                  </object>
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    <FileCheck2 className="w-20 h-20 mx-auto mb-4" />
                    <p>La vista previa aparecerá aquí</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
