"use client";

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Download, Loader2, FileCheck2, AlertCircle, Sparkles, RefreshCcw } from 'lucide-react';
import { extractIssuingEntity, getReversePdfAsDataUri, extractDocumentDetails } from './actions';
import { mergePdfsClient, modifyReversePdfClient } from '@/lib/pdf-utils';
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReverseSideEntry } from '@/lib/types';
import { useRouter } from 'next/navigation';

type Status = 'idle' | 'loading' | 'success' | 'error';
type LoadingStep = 'idle' | 'extracting' | 'extractingDetails' | 'matching' | 'modifying' | 'merging' | 'done';

const loadingMessages: Record<LoadingStep, string> = {
  idle: 'Waiting to start...',
  extracting: 'Analyzing document to identify issuing entity...',
  extractingDetails: 'Extracting CURP and Electronic ID...',
  matching: 'Searching for the correct reverse side in your database...',
  modifying: 'Replacing QR code on reverse side...',
  merging: 'Fusing the documents into a single PDF...',
  done: 'Your document is ready!',
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

export default function ActaFusionClient() {
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
  
  const { toast } = useToast();
  const router = useRouter();


  useEffect(() => {
    // This runs on client, after the guard has passed.
    try {
      const dbString = localStorage.getItem('reverse-sides-db');
      if (dbString) {
        const parsedDb = JSON.parse(dbString) as ReverseSideEntry[];
        setDb(parsedDb);
        const states = parsedDb.map(e => e['entidad de registro']).sort();
        setAvailableStates(states);
      } else {
        // This should not happen due to the guard, but as a fallback.
        toast({ title: 'Database not found', description: 'Redirecting to upload page.', variant: 'destructive' });
        router.replace('/upload');
      }
    } catch (e) {
      console.error("Failed to load database from localStorage", e);
      toast({ title: 'Database corrupted', description: 'Please upload the database file again.', variant: 'destructive' });
      localStorage.removeItem('reverse-sides-db');
      router.replace('/upload');
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
  }, [previewUrl]);

  const handleFileChange = (file: File | null) => {
    if (file && file.type === 'application/pdf') {
      handleReset();
      setOriginalFile(file);
      
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalPdfUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    } else {
      setError('Please upload a valid PDF file.');
      toast({
        title: "Invalid File Type",
        description: "Please upload a valid PDF file.",
        variant: "destructive",
      })
    }
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

  const processFusion = async (entityToUse: string, isAuto: boolean) => {
    if (!originalPdfUrl) return;

    setStatus('loading');
    setLoadingStep(isAuto ? 'extracting' : 'matching');
    setError(null);
    setEntity(null);

    try {
      let finalEntity = entityToUse;

      setLoadingStep('extractingDetails');
      const detailsPromise = extractDocumentDetails({ pdfDataUri: originalPdfUrl });
      
      let entityPromise;
      if (isAuto) {
          setLoadingStep('extracting');
          entityPromise = extractIssuingEntity({ pdfDataUri: originalPdfUrl });
      } else {
          entityPromise = Promise.resolve({ issuingEntity: entityToUse });
      }

      const [detailsResult, entityResult] = await Promise.all([detailsPromise, entityPromise]);
      
      finalEntity = entityResult.issuingEntity;
      const { curp, electronicId } = detailsResult;
      
      if (!curp || !electronicId) {
          throw new Error("Could not extract CURP or Electronic Identifier. Please ensure the document is clear.");
      }
      setEntity(finalEntity);
      setLoadingStep('matching');
      
      const reverseSideEntry = findReverseSide(finalEntity, db);
      if (!reverseSideEntry) {
          throw new Error(`Could not find a matching reverse side for "${finalEntity}" in your database.`);
      }

      const reverseSideUrl = reverseSideEntry['link del reverso para descarga directa'];
      const reversePdfDataUri = await getReversePdfAsDataUri(reverseSideUrl);

      setLoadingStep('modifying');
      const modifiedReversePdfUri = await modifyReversePdfClient(reversePdfDataUri, curp, electronicId);

      setLoadingStep('merging');
      const mergedPdf = await mergePdfsClient(originalPdfUrl, modifiedReversePdfUri);

      setCombinedPdfUrl(mergedPdf);
      await setMergedPreview(mergedPdf);

      setLoadingStep('done');
      setStatus('success');
      toast({
        title: "Success!",
        description: "Your PDF has been created with the new QR code.",
      });
    } catch (e: any) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Processing failed: ${errorMessage}`);
      setStatus('error');
      toast({
        title: "Processing Failed",
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
      <h3 className="text-xl font-semibold text-foreground">Drag & drop your birth certificate</h3>
      <p className="text-muted-foreground mt-2">or click to select a PDF file</p>
      <input id="file-upload" type="file" className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} />
    </div>
  );

  const renderProcessingState = () => (
    <Card>
      <CardHeader>
        <CardTitle>File Information</CardTitle>
        <CardDescription>{originalFile?.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === 'loading' ? (
          <div className="flex flex-col items-center justify-center space-y-4 p-8 bg-background rounded-lg">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-medium text-foreground">{loadingMessages[loadingStep]}</p>
            {entity && <p className="text-sm text-muted-foreground">Processing for: {entity}</p>}
          </div>
        ) : (
          <Tabs defaultValue="automatic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="automatic">Automatic (AI)</TabsTrigger>
              <TabsTrigger value="manual">Manual Selection</TabsTrigger>
            </TabsList>
            <TabsContent value="automatic" className="pt-4">
               <p className="text-sm text-muted-foreground mb-4">Let AI analyze your document to find the correct reverse side.</p>
               <Button onClick={() => processFusion('', true)} className="w-full">
                <Sparkles className="mr-2 h-4 w-4" /> Fuse with AI
              </Button>
            </TabsContent>
            <TabsContent value="manual" className="pt-4 space-y-4">
              <p className="text-sm text-muted-foreground">If the AI fails or identifies the wrong state, you can select it manually.</p>
               <Select onValueChange={setManualEntity} value={manualEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a state..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => processFusion(manualEntity, false)} disabled={!manualEntity} className="w-full">
                <Sparkles className="mr-2 h-4 w-4" /> Fuse with Selected State
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {status === 'success' && combinedPdfUrl && (
          <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            <a href={combinedPdfUrl} download="acta-fusionada.pdf">
              <Download className="mr-2 h-4 w-4" /> Download Fused PDF
            </a>
          </Button>
        )}
      </CardContent>
      <CardFooter className="flex-col sm:flex-row gap-2 justify-between items-center">
         {entity && status !== 'loading' && (
            <p className="text-sm text-muted-foreground">Identified Entity: <strong>{entity}</strong></p>
         )}
         <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto mt-2 sm:mt-0 ml-auto">
            <RefreshCcw className="mr-2 h-4 w-4" /> Start Over
          </Button>
      </CardFooter>
    </Card>
  );

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col items-center">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-bold text-primary font-headline">Acta Fusion</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Easily combine your birth certificate with its official reverse side.
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
              <CardTitle>PDF Preview</CardTitle>
              <CardDescription>
                {combinedPdfUrl ? 'Your fused document is ready below.' : (previewUrl ? 'Preview of your uploaded document.' : 'Upload a file to see the preview.')}
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
                        <p className="font-semibold">Unable to display PDF preview.</p>
                        <p className="text-sm">Your browser may not support embedded previews. You can still process and download the file.</p>
                      </div>
                  </object>
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    <FileCheck2 className="w-20 h-20 mx-auto mb-4"/>
                    <p>Preview will appear here</p>
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
