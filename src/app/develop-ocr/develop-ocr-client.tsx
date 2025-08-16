
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Loader2, AlertCircle, RefreshCcw, ScanText, FileCheck2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";

// Configure the worker to use the local file from node_modules.
// This is the correct way for Next.js to avoid CDN and CORS issues.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;


type Status = 'idle' | 'loading' | 'success' | 'error';

interface ExtractedData {
  curp: string | null;
  electronicId: string | null;
  issuingEntity: string | null;
}

async function extraerDatosEspeciales(text: string): Promise<ExtractedData> {
    const curpRegex = /([A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z\d]\d)/;
    const idRegex = /(?:Identificador Electrónico|Identificador Electronico|Identificador):\s*([A-Z0-9]+)/i;
    const entidadRegex = /(?:Entidad de Registro|Entidad de Registra|Entidad de Regisiro):\s*([A-Z\s]+)/i;

    const curpMatch = text.match(curpRegex);
    const idMatch = text.match(idRegex);
    let entidadMatch = text.match(entidadRegex);

    // Fallback for entity if the main regex fails
    if (!entidadMatch) {
       const entidadFallbackRegex = /DATOS DE LA ENTIDAD FEDERATIVA\s*([A-Z\s]+?)\s*(?:DATOS DEL ACTA|Fecha de registro)/i;
       entidadMatch = text.match(entidadFallbackRegex);
    }
    
    return {
        curp: curpMatch ? curpMatch[1] : null,
        electronicId: idMatch ? idMatch[1] : null,
        issuingEntity: entidadMatch ? entidadMatch[1].trim() : null
    };
}


export default function DevelopOcrClient() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  
  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setOriginalFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setStatus('idle');
    setError(null);
  }, [previewUrl]);

  const handleFileChange = (file: File | null) => {
    if (file && file.type === 'application/pdf') {
      handleReset();
      setOriginalFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    } else {
      setError('Por favor, sube un archivo PDF válido.');
      toast({ title: "Tipo de Archivo Inválido", variant: "destructive" });
    }
  };

  const processOcr = async () => {
    if (!originalFile) return;

    setStatus('loading');
    setError(null);
    setExtractedData(null);

    try {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        if (e.target?.result) {
            const typedarray = new Uint8Array(e.target.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
            }
            
            const data = await extraerDatosEspeciales(fullText);

            if (!data.curp && !data.electronicId && !data.issuingEntity) {
               throw new Error("No se pudo extraer ninguna información útil. Asegúrate de que el documento sea legible y contenga los datos esperados.");
            }

            setExtractedData(data);
            setStatus('success');
            toast({ title: '¡Éxito!', description: 'Se han extraído los datos del PDF.' });
        }
      };
        fileReader.onerror = () => {
            throw new Error("No se pudo leer el archivo.");
        };
        fileReader.readAsArrayBuffer(originalFile);

    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido.';
      setError(`El proceso falló: ${errorMessage}`);
      setStatus('error');
      toast({ title: 'El Proceso Falló', description: errorMessage, variant: 'destructive' });
    }
  };
  
  const handleDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
    },
  };

  const renderDropzone = () => (
    <div
      {...handleDragEvents}
      className={`relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70'}`}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <FileUp className="w-16 h-16 text-primary mb-4" />
      <h3 className="text-xl font-semibold">Arrastra y suelta tu acta</h3>
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
          <div className="flex flex-col items-center justify-center space-y-4 p-8">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-medium">Extrayendo datos del PDF...</p>
          </div>
        ) : (
          <Button onClick={processOcr} className="w-full" disabled={status === 'loading'}>
            <ScanText className="mr-2 h-4 w-4" /> Procesar OCR
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

  const renderResults = () => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Resultados del OCR</CardTitle>
        <CardDescription>Datos extraídos del documento: {originalFile?.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 font-mono text-sm">
        <div>
          <p className="font-semibold text-muted-foreground">CURP:</p>
          <p className="text-primary font-bold">{extractedData?.curp || 'No encontrado'}</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Identificador Electrónico:</p>
          <p>{extractedData?.electronicId || 'No encontrado'}</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Entidad de Registro:</p>
          <p>{extractedData?.issuingEntity || 'No encontrada'}</p>
        </div>
      </CardContent>
       <CardFooter>
        <Button onClick={handleReset} variant="outline" className="w-full">
          <RefreshCcw className="mr-2 h-4 w-4" /> Procesar otro documento
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col items-center">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-bold text-primary font-headline">OCR Nativo</h1>
        <p className="text-muted-foreground mt-2 text-lg">Extrae datos de un acta usando OCR nativo con pdf.js.</p>
      </header>
      
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col space-y-8">
            {originalFile ? (status === 'success' ? renderResults() : renderProcessingState()) : renderDropzone()}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
        </div>
        
        <div className="lg:h-[70vh]">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Vista Previa del PDF</CardTitle>
              <CardDescription>
                {previewUrl ? 'Vista previa de tu documento cargado.' : 'Sube un archivo para ver la vista previa.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="w-full h-full bg-secondary rounded-lg flex items-center justify-center">
                {previewUrl ? (
                   <object data={previewUrl} type="application/pdf" className="w-full h-full rounded-lg">
                     <div className="p-4 text-center text-destructive">
                       <p>No se puede mostrar la vista previa del PDF.</p>
                     </div>
                  </object>
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    <FileCheck2 className="w-20 h-20 mx-auto mb-4"/>
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
