
"use client";

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Loader2, AlertCircle, RefreshCcw, ScanText, FileCheck2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";

// Configure the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface OcrResult {
  identificador: string | null;
  entidad: string | null;
  curp: string | null;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

function extraerDatosEspeciales(texto: string): OcrResult {
  // Clean up the text: remove non-printable characters, normalize whitespace.
  const limpio = texto
    .replace(/\s+/g, " ")
    .trim();

  let identificador = null;
  let entidad = null;
  let curp = null;

  // Regex for Electronic Identifier
  // Looks for "Identificador Electronico" followed by a sequence of digits
  const regexId = /Identificador\s+Electr[oó]nico\s*:\s*(\d{10,30})|Identificador\s+Electr[oó]nico\s*(\d{10,30})/;
  let matchId = limpio.match(regexId);
  if (matchId) {
    identificador = matchId[1] || matchId[2];
  } else {
    const fallbackRegexId = /(\d{2}\s\d{2}\s\d{4})\s\d{5}/;
    const fallbackMatch = limpio.match(fallbackRegexId);
    if(fallbackMatch) {
       const potentialIdSection = limpio.substring(fallbackMatch.index! + fallbackMatch[0].length).trim();
       const finalIdMatch = potentialIdSection.match(/^\d+/);
       if(finalIdMatch){
           identificador = finalIdMatch[0]
       }
    }
  }

  // Regex for CURP
  // Standard 18-character CURP format.
  const regexCurp = /([A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d)/;
  let matchCurp = limpio.match(regexCurp);
  if (matchCurp) curp = matchCurp[0];

  // Regex for Issuing Entity (Entidad de Registro)
  // Looks for "Entidad de Registro" followed by capitalized words.
  const regexEntidad = /Entidad de Registro\s+([A-ZÁÉÍÓÚÜÑ\s]+?)(?=\s[A-Z]{2,}|$)/;
  let matchEntidad = limpio.match(regexEntidad);
  if (matchEntidad) {
    entidad = matchEntidad[1].trim();
  }

  return { identificador, entidad, curp };
}

export default function DevelopOcrClient() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  
  const { toast } = useToast();

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setOriginalFile(null);
    setPreviewUrl(null);
    setStatus('idle');
    setError(null);
    setOcrResult(null);
  }, [previewUrl]);

  const handleFileChange = (file: File | null) => {
    if (file && file.type === 'application/pdf') {
      handleReset();
      setOriginalFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    } else {
      setError('Por favor, sube un archivo PDF válido.');
      toast({ title: "Tipo de Archivo Inválido", description: "Por favor, sube un archivo PDF válido.", variant: "destructive" });
    }
  };

  const processOcr = async () => {
    if (!originalFile) return;

    setStatus('loading');
    setError(null);
    setOcrResult(null);

    try {
      const arrayBuffer = await originalFile.arrayBuffer();
      const typedarray = new Uint8Array(arrayBuffer);
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => 'str' in item ? item.str : '').join(" ");
      }
      
      const datos = extraerDatosEspeciales(fullText);
      setOcrResult(datos);
      setStatus('success');
      toast({ title: 'OCR Completado', description: 'Se han extraído los datos del documento.' });

    } catch (e: any) {
      console.error("OCR Error:", e);
      const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido durante el OCR.';
      setError(errorMessage);
      setStatus('error');
      toast({ title: 'Error de OCR', description: errorMessage, variant: 'destructive' });
    }
  };


  const handleDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault(); e.stopPropagation(); setIsDragging(false);
      if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
    },
  };

  const renderDropzone = () => (
    <div
      {...handleDragEvents}
      className={`relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70 hover:bg-secondary'}`}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <FileUp className="w-16 h-16 text-primary mb-4" />
      <h3 className="text-xl font-semibold text-foreground">Arrastra y suelta un acta de nacimiento</h3>
      <p className="text-muted-foreground mt-2">o haz clic para seleccionar un archivo PDF</p>
      <input id="file-upload" type="file" className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
    </div>
  );

  const renderProcessingState = () => (
    <Card>
      <CardHeader>
        <CardTitle>Archivo Cargado</CardTitle>
        <CardDescription>{originalFile?.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'loading' && (
          <div className="flex items-center justify-center space-x-2 p-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-lg font-medium">Procesando OCR...</p>
          </div>
        )}
        
        {status !== 'loading' && (
             <Button onClick={processOcr} disabled={!originalFile || status === 'loading'} className="w-full">
                <ScanText className="mr-2 h-4 w-4" /> Extraer Datos con OCR
            </Button>
        )}

        {status === 'success' && ocrResult && (
           <Card className="bg-secondary p-4">
            <CardHeader className="p-2">
                <CardTitle className="text-lg">Resultados del OCR</CardTitle>
            </CardHeader>
             <CardContent className="p-2 space-y-2 text-sm">
                <p><strong>CURP:</strong> <span className="font-mono bg-background px-2 py-1 rounded">{ocrResult.curp || 'No encontrada'}</span></p>
                <p><strong>Identificador Electrónico:</strong> <span className="font-mono bg-background px-2 py-1 rounded">{ocrResult.identificador || 'No encontrado'}</span></p>
                <p><strong>Entidad de Registro:</strong> <span className="font-mono bg-background px-2 py-1 rounded">{ocrResult.entidad || 'No encontrada'}</span></p>
             </CardContent>
           </Card>
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
        <h1 className="text-5xl font-bold text-primary font-headline">Develop OCR</h1>
        <p className="text-muted-foreground mt-2 text-lg">Extrae datos de un acta usando OCR nativo con pdf.js.</p>
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
                  {previewUrl ? 'Vista previa de tu documento cargado.' : 'Sube un archivo para ver la vista previa.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="w-full h-full bg-secondary rounded-lg flex items-center justify-center">
                {previewUrl ? (
                  <object data={previewUrl} type="application/pdf" className="w-full h-full rounded-lg">
                    <div className="p-4 text-center text-destructive">No se puede mostrar la vista previa.</div>
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
