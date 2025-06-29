"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Download, Loader2, FileCheck2, AlertCircle, Sparkles, RefreshCcw, ArrowRight, BarChart3, Frame, Combine } from 'lucide-react';
import { extractIssuingEntity, getReversePdfAsDataUri, extractDocumentDetails } from '../actions';
import { mergePdfsClient, modifyReversePdfClient, framePdfClient } from '@/lib/pdf-utils';
import { useToast } from "@/hooks/use-toast";
import type { ReverseSideEntry } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Status = 'idle' | 'loading' | 'success' | 'error';
type LoadingStep = 'idle' | 'finding_frame' | 'framing' | 'extracting' | 'matching' | 'modifying' | 'merging' | 'done';

const loadingMessages: Record<LoadingStep, string> = {
  idle: 'Esperando para empezar...',
  finding_frame: 'Buscando el marco en tu base de datos...',
  framing: 'Enmarcando el acta de nacimiento...',
  extracting: 'Identificando la entidad emisora del acta...',
  matching: 'Buscando el reverso correcto...',
  modifying: 'Creando el nuevo código QR para el reverso...',
  merging: 'Fusionando el marco y el reverso en un solo PDF...',
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
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null); // data-uri for processing
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // object-url for iframe
  const [finalPdfUrl, setFinalPdfUrl] = useState<string | null>(null); // data-uri for download
  const [status, setStatus] = useState<Status>('idle');
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [db, setDb] = useState<ReverseSideEntry[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    try {
      const dbString = localStorage.getItem('reverse-sides-db');
      if (dbString) {
        setDb(JSON.parse(dbString));
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

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setOriginalFile(null);
    setPdfDataUri(null);
    setPreviewUrl(null);
    setFinalPdfUrl(null);
    setStatus('idle');
    setLoadingStep('idle');
    setError(null);
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

  const processFraming = async () => {
    if (!pdfDataUri) return;

    setStatus('loading');
    setLoadingStep('finding_frame');
    setError(null);

    try {
      const frameEntry = db.find(e => normalizeString(e['entidad de registro']) === 'marcoactas');
      if (!frameEntry) throw new Error('No se encontró "MARCO ACTAS" en tu base de datos.');
      
      const framePdfUri = await getReversePdfAsDataUri(frameEntry['link del reverso para descarga directa']);

      setLoadingStep('framing');
      const framedPdfPromise = framePdfClient(pdfDataUri, framePdfUri);

      const reverseSidePromise = (async () => {
        setLoadingStep('extracting');
        const { issuingEntity } = await extractIssuingEntity({ pdfDataUri });
        const { curp, electronicId } = await extractDocumentDetails({ pdfDataUri });
        if (!curp || !electronicId) throw new Error("No se pudo extraer la CURP o el Identificador Electrónico.");

        setLoadingStep('matching');
        const reverseSideEntry = findReverseSide(issuingEntity, db);
        if (!reverseSideEntry) throw new Error(`No se pudo encontrar un reverso para "${issuingEntity}".`);

        const reversePdfDataUri = await getReversePdfAsDataUri(reverseSideEntry['link del reverso para descarga directa']);

        setLoadingStep('modifying');
        const modifiedReversePdfUri = await modifyReversePdfClient(reversePdfDataUri, curp, electronicId);
        return { modifiedReversePdfUri, curp };
      })();

      const [framedPdf, { modifiedReversePdfUri, curp }] = await Promise.all([framedPdfPromise, reverseSidePromise]);
      
      setLoadingStep('merging');
      const mergedPdf = await mergePdfsClient(framedPdf, modifiedReversePdfUri);

      setFinalPdfUrl(mergedPdf);
      await setPreviewFromDataUri(mergedPdf);

      setLoadingStep('done');
      setStatus('success');
      toast({ title: "¡Éxito!", description: "Tu PDF ha sido enmarcado y fusionado con su reverso." });

      const currentCount = parseInt(localStorage.getItem('frameCount') || '0', 10);
      localStorage.setItem('frameCount', (currentCount + 1).toString());

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
          </div>
        ) : (
          <Button onClick={processFraming} className="w-full">
            <Frame className="mr-2 h-4 w-4" /> Enmarcar y Fusionar con Reverso
          </Button>
        )}
        {status === 'success' && finalPdfUrl && (
          <Button asChild className="w-full bg-green-500 hover:bg-green-600 text-white">
            <a href={finalPdfUrl} download={`${originalFile?.name.replace('.pdf', '')}-enmarcado.pdf`}>
              <Download className="mr-2 h-4 w-4" /> Descargar PDF Final
            </a>
          </Button>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleReset} variant="outline" className="w-full">
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
          <Link href="/"><Button variant="outline"><Combine className="mr-2 h-4 w-4" />Ir a Acta Fusion</Button></Link>
          <Link href="/folio"><Button variant="outline"><Sparkles className="mr-2 h-4 w-4" />Ir a Foliar</Button></Link>
          <Link href="/dashboard"><Button variant="secondary"><BarChart3 className="mr-2 h-4 w-4" />Ver Dashboard</Button></Link>
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
              <CardDescription>{finalPdfUrl ? 'Tu documento enmarcado está listo.' : (previewUrl ? 'Vista previa de tu documento.' : 'Sube un archivo para ver la vista previa.')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="w-full h-full bg-secondary rounded-lg flex items-center justify-center">
                {previewUrl ? (
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
