
"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Download, Loader2, FileCheck2, AlertCircle, Sparkles, RefreshCcw, Frame, FileCog, BarChart3, Files, Search, ScanLine } from 'lucide-react';
import { getReversePdfAsDataUri, extractDocumentDetails } from '../actions';
import { mergePdfsClient, modifyReversePdfClient, addFolioToPdfClient } from '@/lib/pdf-utils';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReverseSideEntry } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import curpStates from '@/lib/data/curp-states.json';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { extractDataFromPdf } from '@/lib/ocr-utils';

type Status = 'idle' | 'loading' | 'success' | 'error';
type LoadingStep = 'idle' | 'extractingDetails' | 'matching' | 'modifying' | 'merging' | 'foliating' | 'done';
type OcrStatus = 'idle' | 'processing' | 'success' | 'error';
type OperationMode = 'manual' | 'ocr';

interface OcrData {
  curp: string;
  electronicId: string;
  issuingEntity: string;
}


const loadingMessages: Record<LoadingStep, string> = {
  idle: 'Esperando para empezar...',
  extractingDetails: 'Extrayendo CURP e Identificador Electrónico...',
  matching: 'Buscando el reverso correcto en tu base de datos...',
  modifying: 'Reemplazando el código QR en el reverso...',
  merging: 'Fusionando los documentos en un solo PDF...',
  foliating: 'Añadiendo el folio y código de barras...',
  done: '¡Tu documento está listo!',
};

// Helper to get the ISO week number
const getWeekNumber = (d: Date): number => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};


function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, '');
}

function findReverseSide(entity: string, db: ReverseSideEntry[]): ReverseSideEntry | null {
    if (!entity) return null;
    const normalizedEntity = normalizeString(entity);

    // Handle special cases from old prompt
    if (normalizedEntity.includes('distritofederal') || normalizedEntity.includes('ciudadmexico')) {
        const df = db.find(e => normalizeString(e['entidad de registro']).includes('distritofederal'));
        if (df) return df;
    }
    if (normalizedEntity.includes('mexico') && !normalizedEntity.includes('ciudadmexico') && !normalizedEntity.includes('nuevoleon')) {
        const edoMex = db.find(e => normalizeString(e['entidad de registro']) === 'mexico' || normalizeString(e['entidad de registro']) === 'estadodemexico');
        if (edoMex) return edoMex;
    }

    // Exact match
    let match = db.find(e => normalizeString(e['entidad de registro']) === normalizedEntity);
    if (match) return match;

    // Partial match
    match = db.find(e => normalizedEntity.includes(normalizeString(e['entidad de registro'])));
    if (match) return match;

    return null;
}

export default function DashboardClient() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalPdfUrl, setOriginalPdfUrl] = useState<string | null>(null); // data-uri for processing
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // object-url for iframe
  const [combinedPdfUrl, setCombinedPdfUrl] = useState<string | null>(null); // data-uri for download
  const [status, setStatus] = useState<Status>('idle');
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<string | null>(null);
  const [manualEntity, setManualEntity] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [db, setDb] = useState<ReverseSideEntry[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [extractedCurp, setExtractedCurp] = useState<string | null>(null);
  const [addFolio, setAddFolio] = useState(false);
  const [curpQuery, setCurpQuery] = useState('');
  const [birthStateResult, setBirthStateResult] = useState<string | null>(null);
  const [mode, setMode] = useState<OperationMode>('manual');
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrData, setOcrData] = useState<OcrData>({ curp: '', electronicId: '', issuingEntity: ''});

  const { toast } = useToast();
  const router = useRouter();


  useEffect(() => {
    try {
      const dbString = localStorage.getItem('reverse-sides-db');
      if (dbString) {
        const parsedDb = JSON.parse(dbString) as ReverseSideEntry[];
        setDb(parsedDb);
        const states = parsedDb.map(e => e['entidad de registro']).sort();
        setAvailableStates(states);
      }
    } catch (e) {
      console.error("Failed to load database from localStorage", e);
      toast({ title: 'Base de datos corrupta', description: 'Intenta recargar la página para volver a sincronizar con Firebase.', variant: 'destructive' });
      localStorage.removeItem('reverse-sides-db');
      router.refresh();
    }
  }, [router, toast]);


  const handleReset = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setOriginalFile(null);
    setOriginalPdfUrl(null);
    setPreviewUrl(null);
    setCombinedPdfUrl(null);
    setStatus('idle');
    setLoadingStep('idle');
    setError(null);
    setEntity(null);
    setManualEntity("");
    setExtractedCurp(null);
    setAddFolio(false);
    setOcrStatus('idle');
    setOcrData({ curp: '', electronicId: '', issuingEntity: ''});
  }, [previewUrl]);

  const handleFileChange = (file: File | null) => {
    if (file && file.type === 'application/pdf') {
      handleReset();
      setOriginalFile(file);
      
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setOriginalPdfUrl(dataUri);
        if (mode === 'ocr') {
            handleOcrProcess(dataUri);
        }
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

   const handleOcrProcess = async (dataUri: string) => {
    setOcrStatus('processing');
    setOcrData({ curp: '', electronicId: '', issuingEntity: ''});
    try {
      const data = await extractDataFromPdf(dataUri);
      setOcrData({
        curp: data.curp || '',
        electronicId: data.electronicId || '',
        issuingEntity: data.issuingEntity || ''
      });
      setOcrStatus('success');

      if (!data.curp && !data.electronicId && !data.issuingEntity) {
        toast({ title: "OCR Sin Resultados", description: "No se encontró información clave. Puedes llenarla manualmente.", variant: "destructive" });
      } else {
        toast({ title: "OCR Completado", description: "Verifica y corrige los datos si es necesario." });
      }
      
    } catch (e: any) {
        setOcrStatus('error');
        setError(e.message || "Falló el proceso de OCR.");
        toast({ title: 'Error de OCR', description: e.message, variant: 'destructive' });
    }
  };

  const handleOcrDataChange = (field: keyof OcrData, value: string) => {
    setOcrData(prev => ({ ...prev, [field]: value }));
  };

  
  const setMergedPreview = async (mergedDataUri: string) => {
    try {
        const res = await fetch(mergedDataUri);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setPreviewUrl(objectUrl);
    } catch (e) {
        console.error("Failed to create preview URL for merged PDF", e);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(mergedDataUri);
    }
  };
  
  const handleDownloadAndSave = (url: string, name: string) => {
     try {
      const currentFusionCount = parseInt(localStorage.getItem('fusionCount') || '0', 10);
      localStorage.setItem('fusionCount', (currentFusionCount + 1).toString());

      // Update daily stats
        const today = new Date();
        const currentWeek = getWeekNumber(today);
        const dayIndex = today.getDay();

        const storedStatsRaw = localStorage.getItem('dailyFusionStats');
        let dailyStats = { weekNumber: currentWeek, counts: Array(7).fill(0) };

        if (storedStatsRaw) {
            try {
                const parsed = JSON.parse(storedStatsRaw);
                if (parsed.weekNumber === currentWeek) {
                    dailyStats = parsed;
                }
            } catch (e) { console.error(e); }
        }

        dailyStats.counts[dayIndex]++;
        localStorage.setItem('dailyFusionStats', JSON.stringify(dailyStats));
      
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
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
  }

  const handleProcessSuccess = useCallback((finalPdf: string, curp: string | null) => {
    setCombinedPdfUrl(finalPdf);
    setMergedPreview(finalPdf);
    setLoadingStep('done');
    setStatus('success');
    toast({
      title: "¡Éxito!",
      description: `Tu PDF ha sido creado ${addFolio ? 'y foliado' : ''} correctamente. Descargando...`,
    });
    handleDownloadAndSave(finalPdf, curp ? `${curp}.pdf` : 'acta-fusionada.pdf');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addFolio]);


  const processFusion = async (entityToUse: string | null, localOcrData: OcrData | null = null) => {
    if (!originalPdfUrl || !entityToUse) {
       toast({
        title: "Selección Requerida",
        description: "Por favor, selecciona un estado o usa el modo OCR.",
        variant: "destructive",
      });
      return;
    }

    setStatus('loading');
    setError(null);
    setEntity(null);
    setExtractedCurp(null);
    
    try {
      let curp: string | null = null;
      let electronicId: string | null = null;

      if (mode === 'ocr' && localOcrData) {
        setLoadingStep('matching'); // Skip extraction step visually
        curp = localOcrData.curp;
        electronicId = localOcrData.electronicId;
      } else {
        setLoadingStep('extractingDetails');
        const details = await extractDocumentDetails({ pdfDataUri: originalPdfUrl });
        curp = details.curp;
        electronicId = details.electronicId;
      }
      
      if (!curp || !electronicId) {
          throw new Error("No se pudo extraer la CURP o el Identificador Electrónico. Asegúrate de que el documento sea claro y los datos correctos.");
      }
      
      setExtractedCurp(curp);
      setEntity(entityToUse);
      
      if(loadingStep !== 'matching') setLoadingStep('matching');
      
      const reverseSideEntry = findReverseSide(entityToUse, db);
      if (!reverseSideEntry) {
          throw new Error(`No se pudo encontrar un reverso para "${entityToUse}" en tu base de datos.`);
      }

      const reverseSideUrl = reverseSideEntry['link del reverso para descarga directa'];
      const reversePdfDataUri = await getReversePdfAsDataUri(reverseSideUrl);

      setLoadingStep('modifying');
      const modifiedReversePdfUri = await modifyReversePdfClient(reversePdfDataUri, curp, electronicId);

      setLoadingStep('merging');
      let finalPdf = await mergePdfsClient(originalPdfUrl, modifiedReversePdfUri);

      if (addFolio) {
        setLoadingStep('foliating');
        finalPdf = await addFolioToPdfClient(finalPdf);
      }

      handleProcessSuccess(finalPdf, curp);

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

  const handleCurpLookup = () => {
    setBirthStateResult(null);
    if (curpQuery.length !== 18) {
        toast({
            title: "CURP Inválida",
            description: "La CURP debe tener exactamente 18 caracteres.",
            variant: "destructive",
        });
        return;
    }
    const stateCode = curpQuery.substring(11, 13).toUpperCase();
    const stateName = (curpStates as Record<string, string>)[stateCode];

    if (stateName) {
        setBirthStateResult(stateName);
    } else {
        setBirthStateResult("Código de entidad no reconocido.");
         toast({
            title: "Código de Entidad no Encontrado",
            description: `El código "${stateCode}" no corresponde a una entidad federativa válida.`,
            variant: "destructive",
        });
    }
  };

  const renderDropzone = () => (
     <div
      onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
      className={`relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ease-in-out ${ isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70 hover:bg-secondary'}`}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <FileUp className="w-16 h-16 text-primary mb-4" />
      <h3 className="text-xl font-semibold text-foreground">Arrastra y suelta tu acta de nacimiento</h3>
      <p className="text-muted-foreground mt-2">o haz clic para seleccionar un archivo PDF</p>
      <input id="file-upload" type="file" className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} />
    </div>
  );
  
  const renderOcrResults = () => {
    if (mode !== 'ocr' || !originalFile) return null;
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Resultados del OCR</CardTitle>
                <CardDescription>Verifica y corrige los datos extraídos antes de fusionar.</CardDescription>
            </CardHeader>
            <CardContent>
                {ocrStatus === 'processing' && (
                    <div className="flex items-center justify-center space-x-2 p-4">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        <p className="text-muted-foreground">Escaneando documento...</p>
                    </div>
                )}
                {ocrStatus === 'success' && (
                     <div className="space-y-4">
                        <div>
                            <Label htmlFor="ocr-curp">CURP</Label>
                            <Input id="ocr-curp" value={ocrData.curp} onChange={(e) => handleOcrDataChange('curp', e.target.value)} placeholder="CURP no encontrada" />
                        </div>
                         <div>
                            <Label htmlFor="ocr-id">ID Electrónico</Label>
                            <Input id="ocr-id" value={ocrData.electronicId} onChange={(e) => handleOcrDataChange('electronicId', e.target.value)} placeholder="ID no encontrado" />
                        </div>
                        <div>
                            <Label htmlFor="ocr-entity">Entidad de Registro</Label>
                             <Input id="ocr-entity" value={ocrData.issuingEntity} onChange={(e) => handleOcrDataChange('issuingEntity', e.target.value)} placeholder="Entidad no encontrada" />
                        </div>
                    </div>
                )}
                {ocrStatus === 'error' && <p className="text-destructive">Falló el OCR. Intenta en modo manual.</p>}
            </CardContent>
            {ocrStatus === 'success' && (
                <CardFooter>
                     <Button onClick={() => processFusion(ocrData.issuingEntity, ocrData)} disabled={!ocrData.issuingEntity || !ocrData.curp || !ocrData.electronicId || status === 'loading'} className="w-full">
                        {status === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                         Validar y Fusionar
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
  };

  const renderManualMode = () => {
     if (mode !== 'manual' || !originalFile || status === 'loading' || status === 'success') return null;

     return (
         <div className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">Selecciona el estado emisor del acta para encontrar el reverso correcto.</p>
            <Select onValueChange={setManualEntity} value={manualEntity}>
            <SelectTrigger>
                <SelectValue placeholder="Selecciona un estado..." />
            </SelectTrigger>
            <SelectContent>
                {availableStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
            </SelectContent>
            </Select>
            
            <Button onClick={() => processFusion(manualEntity)} disabled={!manualEntity} className="w-full">
            <Sparkles className="mr-2 h-4 w-4" /> Fusionar Documentos
            </Button>
        </div>
     )
  }

  const renderProcessingState = () => (
    <Card>
      <CardHeader>
        <CardTitle>Información del Archivo</CardTitle>
        <CardDescription>{originalFile?.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center space-y-4 p-8 bg-background rounded-lg">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-medium text-foreground">{loadingMessages[loadingStep]}</p>
            {entity && <p className="text-sm text-muted-foreground">Procesando para: {entity}</p>}
          </div>
        )}

        {status === 'success' && combinedPdfUrl && (
            <div className="text-center p-4">
                <FileCheck2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Proceso Completado</h3>
                 <Button onClick={() => handleDownloadAndSave(combinedPdfUrl, extractedCurp ? `${extractedCurp}.pdf` : 'acta-fusionada.pdf')} className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white">
                    <Download className="mr-2 h-4 w-4" /> Descargar PDF Fusionado
                </Button>
            </div>
        )}
        
        {renderManualMode()}
      </CardContent>
      <CardFooter className="flex-col sm:flex-row gap-2 justify-between items-center">
         {entity && status !== 'loading' && (
            <p className="text-sm text-muted-foreground">Entidad Procesada: <strong>{entity}</strong></p>
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
        <h1 className="text-5xl font-bold text-primary font-headline">Acta Fusion</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Combina fácilmente tu acta de nacimiento con su reverso oficial.
        </p>
      </header>
      
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Configuración</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label htmlFor="mode-switch" className="text-base">Modo de Operación</Label>
                            <p className="text-sm text-muted-foreground">
                                Elige OCR para automático o Manual para seleccionar el estado.
                            </p>
                        </div>
                        <div className="flex items-center space-x-2">
                           <Label htmlFor="mode-switch" className={mode === 'manual' ? 'font-bold text-primary' : ''}>Manual</Label>
                            <Switch 
                                id="mode-switch"
                                checked={mode === 'ocr'}
                                onCheckedChange={(checked) => setMode(checked ? 'ocr' : 'manual')}
                            />
                            <Label htmlFor="mode-switch" className={mode === 'ocr' ? 'font-bold text-primary' : ''}>OCR</Label>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-4">
                        <Switch id="folio-switch" checked={addFolio} onCheckedChange={setAddFolio} />
                        <Label htmlFor="folio-switch">¿Añadir Folio?</Label>
                    </div>
                </CardContent>
            </Card>

            {originalFile ? (status === 'idle' ? (mode === 'ocr' ? renderOcrResults() : renderManualMode()) : renderProcessingState()) : renderDropzone()}

            {mode === 'manual' && originalFile && status === 'idle' && renderManualMode()}

            {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
            )}
            
            {status !== 'success' && status !== 'loading' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Verificador de Entidad por CURP</CardTitle>
                        <CardDescription>
                            Ingresa una CURP para determinar el estado de nacimiento como guía.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex w-full items-center space-x-2">
                             <Input
                                type="text"
                                placeholder="Ingresa la CURP de 18 caracteres"
                                value={curpQuery}
                                onChange={(e) => setCurpQuery(e.target.value.toUpperCase())}
                                maxLength={18}
                                className="font-mono"
                            />
                            <Button onClick={handleCurpLookup}>
                                <Search className="mr-2 h-4 w-4" /> Verificar
                            </Button>
                        </div>
                        {birthStateResult && (
                            <Alert>
                                <AlertTitle>Entidad de Nacimiento Sugerida</AlertTitle>
                                <AlertDescription className="font-semibold text-primary">
                                    {birthStateResult}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
        
        <div className="lg:h-[70vh]">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Vista Previa del PDF</CardTitle>
              <CardDescription>
                {combinedPdfUrl ? 'Tu documento fusionado está listo abajo.' : (previewUrl ? 'Vista previa de tu documento cargado.' : 'Sube un archivo para ver la vista previa.')}
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
                        <p className="text-sm">Es posible que tu navegador no admita vistas previas incrustadas.</p>
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

    

    