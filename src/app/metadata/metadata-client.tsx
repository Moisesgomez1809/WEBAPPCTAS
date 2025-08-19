
"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Download, Loader2, FileCheck2, AlertCircle, RefreshCcw, BarChart3, Combine, Frame, Stamp, FileCog, Files } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { modifyMetadataAndResizeClient } from '@/lib/pdf-utils';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface DailyStats {
  weekNumber: number;
  counts: number[];
}

// Helper to get the ISO week number
const getWeekNumber = (d: Date): number => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};

export default function MetadataClient() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null); // data-uri for processing
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // object-url for iframe
  const [modifiedPdfUrl, setModifiedPdfUrl] = useState<string | null>(null); // data-uri for download
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleReset = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setOriginalFile(null);
    setPdfDataUri(null);
    setPreviewUrl(null);
    setModifiedPdfUrl(null);
    setStatus('idle');
    setError(null);
  }, [previewUrl]);

  const handleFileChange = (file: File | null) => {
    if (file && file.type === 'application/pdf') {
      handleReset();
      setOriginalFile(file);
      
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      const reader = new FileReader();
      reader.onload = (e) => {
        setPdfDataUri(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    } else {
      setError('Por favor, sube un archivo PDF válido.');
      toast({
        title: "Tipo de Archivo Inválido",
        description: "Por favor, sube un archivo PDF válido.",
        variant: "destructive",
      })
    }
  };
  
  const setPreviewFromDataUri = async (dataUri: string) => {
    try {
        const res = await fetch(dataUri);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(objectUrl);
    } catch (e) {
        console.error("Failed to create preview URL for modified PDF", e);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(dataUri); // Fallback to data URI
    }
  };

  const handleDownloadAndSave = () => {
    if (!modifiedPdfUrl) return;

    try {
      const today = new Date();
      const currentWeek = getWeekNumber(today);
      const dayIndex = today.getDay();
      
      const currentFusionCount = parseInt(localStorage.getItem('fusionCount') || '0', 10);
      localStorage.setItem('fusionCount', (currentFusionCount + 1).toString());

      const storedStatsRaw = localStorage.getItem('dailyFusionStats');
      let dailyStats: DailyStats = { weekNumber: currentWeek, counts: Array(7).fill(0) };

      if (storedStatsRaw) {
          try {
              const parsed = JSON.parse(storedStatsRaw);
              if (parsed.weekNumber === currentWeek) {
                  dailyStats = parsed;
              }
          } catch (e) { console.error(e); }
      }

      dailyStats.counts[dayIndex] = (dailyStats.counts[dayIndex] || 0) + 1;
      localStorage.setItem('dailyFusionStats', JSON.stringify(dailyStats));
      
      // Note: We don't save CURP history here as we don't extract it.

      const link = document.createElement('a');
      link.href = modifiedPdfUrl;
      const fileName = originalFile?.name.replace('.pdf', '_SIST.pdf') || 'documento-modificado_SIST.pdf';
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Failed to save data or download", e);
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo.",
        variant: "destructive",
      });
    }
  };


  const handleProcessMetadata = async () => {
    if (!pdfDataUri) return;

    setStatus('loading');
    setError(null);

    try {
      const modifiedPdf = await modifyMetadataAndResizeClient(pdfDataUri);

      setModifiedPdfUrl(modifiedPdf);
      await setPreviewFromDataUri(modifiedPdf);

      setStatus('success');
      toast({
        title: "¡Éxito!",
        description: "La metadata y el tamaño de tu documento han sido actualizados.",
      });

    } catch (e: any) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`El proceso falló: ${errorMessage}`);
      setStatus('error');
      toast({
        title: "El Proceso Falló",
        description: errorMessage,
        variant: "destructive",
      })
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const renderDropzone = () => (
     <div
      onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
      className={`relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ease-in-out ${ isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70 hover:bg-secondary'}`}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <FileUp className="w-16 h-16 text-primary mb-4" />
      <h3 className="text-xl font-semibold text-foreground">Arrastra y suelta tu documento</h3>
      <p className="text-muted-foreground mt-2">o haz clic para seleccionar un archivo PDF para editar su metadata</p>
      <input id="file-upload" type="file" className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} />
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
            <p className="text-lg font-medium text-foreground">Modificando metadata y tamaño...</p>
          </div>
        ) : (
          status !== 'success' && (
            <Button onClick={handleProcessMetadata} className="w-full">
              <FileCog className="mr-2 h-4 w-4" /> Modificar Metadatos
            </Button>
          )
        )}

        {status === 'success' && modifiedPdfUrl && (
          <Button onClick={handleDownloadAndSave} className="w-full bg-green-500 hover:bg-green-600 text-white">
              <Download className="mr-2 h-4 w-4" /> Descargar PDF Modificado
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
        <h1 className="text-5xl font-bold text-primary font-headline">Modificar Metadatos</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Limpia y estandariza la metadata de tu PDF y ajústalo a tamaño carta.
        </p>
      </header>
      
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col space-y-8">
            {originalFile ? renderProcessingState() : renderDropzone()}
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
                {modifiedPdfUrl ? 'Tu documento modificado está listo abajo.' : (previewUrl ? 'Vista previa de tu documento cargado.' : 'Sube un archivo para ver la vista previa.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="w-full h-full bg-secondary rounded-lg flex items-center justify-center">
                {previewUrl ? (
                   <object
                    data={previewUrl}
                    type="application/pdf"
                    className="w-full h-full rounded-lg"
                  >
                     <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive"/>
                        <p className="font-semibold">No se puede mostrar la vista previa del PDF.</p>
                        <p className="text-sm">Es posible que tu navegador no admita vistas previas incrustadas. Aún puedes procesar y descargar el archivo.</p>
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
