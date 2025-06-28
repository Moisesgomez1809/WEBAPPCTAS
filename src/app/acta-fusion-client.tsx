"use client";

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Download, Loader2, FileCheck2, AlertCircle, Sparkles, RefreshCcw } from 'lucide-react';
import { extractIssuingEntity, matchReverseSide, getReversePdfAsDataUri } from './actions';
import { mergePdfsClient } from '@/lib/pdf-utils';
import { useToast } from "@/hooks/use-toast"

type Status = 'idle' | 'loading' | 'success' | 'error';
type LoadingStep = 'idle' | 'extracting' | 'matching' | 'merging' | 'done';

const loadingMessages: Record<LoadingStep, string> = {
  idle: 'Waiting to start...',
  extracting: 'Analyzing document to identify issuing entity...',
  matching: 'Searching for the correct reverse side...',
  merging: 'Fusing the documents into a single PDF...',
  done: 'Your document is ready!',
};

export default function ActaFusionClient() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalPdfUrl, setOriginalPdfUrl] = useState<string | null>(null);
  const [combinedPdfUrl, setCombinedPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (file: File | null) => {
    if (file && file.type === 'application/pdf') {
      handleReset();
      setOriginalFile(file);
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

  const handleProcess = async () => {
    if (!originalPdfUrl) return;

    setStatus('loading');
    setLoadingStep('extracting');
    setError(null);
    setEntity(null);

    try {
      const entityResult = await extractIssuingEntity({ pdfDataUri: originalPdfUrl });
      setEntity(entityResult.issuingEntity);
      setLoadingStep('matching');

      const reverseSideResult = await matchReverseSide({ entity: entityResult.issuingEntity });
      setLoadingStep('merging');

      const reversePdfDataUri = await getReversePdfAsDataUri(reverseSideResult.reverseSidePdfUrl);
      const mergedPdf = await mergePdfsClient(originalPdfUrl, reversePdfDataUri);

      setCombinedPdfUrl(mergedPdf);
      setLoadingStep('done');
      setStatus('success');
      toast({
        title: "Success!",
        description: "Your PDF has been successfully created.",
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

  const handleReset = () => {
    setOriginalFile(null);
    setOriginalPdfUrl(null);
    setCombinedPdfUrl(null);
    setStatus('idle');
    setLoadingStep('idle');
    setError(null);
    setEntity(null);
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };


  const renderDropzone = () => (
     <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={`relative flex flex-col items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ease-in-out ${
        isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70 hover:bg-secondary'
      }`}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <FileUp className="w-16 h-16 text-primary mb-4" />
      <h3 className="text-xl font-semibold text-foreground">Drag & drop your birth certificate</h3>
      <p className="text-muted-foreground mt-2">or click to select a PDF file</p>
      <input
        id="file-upload"
        type="file"
        className="hidden"
        accept="application/pdf"
        onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
      />
    </div>
  );

  const renderProcessingState = () => (
    <Card>
      <CardHeader>
        <CardTitle>File Information</CardTitle>
        <CardDescription>{originalFile?.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center space-y-4 p-8 bg-background rounded-lg">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-medium text-foreground">{loadingMessages[loadingStep]}</p>
            {entity && <p className="text-sm text-muted-foreground">Identified Entity: {entity}</p>}
          </div>
        )}
        {status !== 'loading' && (
          <div className="flex flex-col sm:flex-row gap-4">
             <Button onClick={handleProcess} className="w-full sm:w-auto flex-grow" disabled={status === 'loading'}>
              <Sparkles className="mr-2 h-4 w-4" /> Fuse PDF
            </Button>
            <Button onClick={handleReset} variant="outline" className="w-full sm:w-auto">
              <RefreshCcw className="mr-2 h-4 w-4" /> Start Over
            </Button>
          </div>
        )}

        {status === 'success' && combinedPdfUrl && (
          <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            <a href={combinedPdfUrl} download="acta-fusionada.pdf">
              <Download className="mr-2 h-4 w-4" /> Download Fused PDF
            </a>
          </Button>
        )}
      </CardContent>
      {entity && status !== 'loading' && (
        <CardFooter>
          <p className="text-sm text-muted-foreground w-full text-center">Identified Entity: <strong>{entity}</strong></p>
        </CardFooter>
      )}
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
                {combinedPdfUrl ? 'Your fused document is ready below.' : (originalPdfUrl ? 'Preview of your uploaded document.' : 'Upload a file to see the preview.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="w-full h-full bg-secondary rounded-lg flex items-center justify-center">
                {originalPdfUrl ? (
                  <iframe
                    src={combinedPdfUrl || originalPdfUrl}
                    className="w-full h-full border-0 rounded-lg"
                    title="PDF Preview"
                  />
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
