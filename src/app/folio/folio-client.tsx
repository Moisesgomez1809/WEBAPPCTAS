"use client";

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Download, Loader2, FileCheck2, AlertCircle, RefreshCcw, ArrowLeft, Stamp } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { addFolioToPdfClient } from '@/lib/pdf-utils';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function FolioClient() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null); // data-uri for processing
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // object-url for iframe
  const [foliatedPdfUrl, setFoliatedPdfUrl] = useState<string | null>(null); // data-uri for download
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
    setFoliatedPdfUrl(null);
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
      setError('Please upload a valid PDF file.');
      toast({
        title: "Invalid File Type",
        description: "Please upload a valid PDF file.",
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
        console.error("Failed to create preview URL for foliated PDF", e);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(dataUri); // Fallback to data URI
    }
  };

  const handleFoliate = async () => {
    if (!pdfDataUri) return;

    setStatus('loading');
    setError(null);

    try {
      const foliatedPdf = await addFolioToPdfClient(pdfDataUri);

      setFoliatedPdfUrl(foliatedPdf);
      await setPreviewFromDataUri(foliatedPdf);

      setStatus('success');
      toast({
        title: "Success!",
        description: "Your document has been successfully foliated.",
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
      <h3 className="text-xl font-semibold text-foreground">Drag & drop your document</h3>
      <p className="text-muted-foreground mt-2">or click to select a PDF file to foliate</p>
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
            <p className="text-lg font-medium text-foreground">Adding folio to your document...</p>
          </div>
        ) : (
          <Button onClick={handleFoliate} className="w-full">
            <Stamp className="mr-2 h-4 w-4" /> Foliar Documento
          </Button>
        )}

        {status === 'success' && foliatedPdfUrl && (
          <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            <a href={foliatedPdfUrl} download={`${originalFile?.name.replace('.pdf', '')}-foliado.pdf`}>
              <Download className="mr-2 h-4 w-4" /> Download Foliated PDF
            </a>
          </Button>
        )}
      </CardContent>
      <CardFooter>
         <Button onClick={handleReset} variant="outline" className="w-full">
            <RefreshCcw className="mr-2 h-4 w-4" /> Start Over
          </Button>
      </CardFooter>
    </Card>
  );

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen flex flex-col items-center">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-bold text-primary font-headline">Foliar Documento</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Add a unique folio number and barcode to your document's first page.
        </p>
        <div className="mt-6">
            <Link href="/">
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a Acta Fusion
                </Button>
            </Link>
        </div>
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
                {foliatedPdfUrl ? 'Your foliated document is ready below.' : (previewUrl ? 'Preview of your uploaded document.' : 'Upload a file to see the preview.')}
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
