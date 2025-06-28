"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as xlsx from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function UploadDatabasePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file) {
      setError("Please select a file.");
      return;
    }

    if (!file.name.endsWith('.xlsx')) {
      setError("Please upload a valid .xlsx file.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(worksheet);

      if (json.length === 0) {
        throw new Error("The XLSX file is empty or could not be parsed correctly.");
      }

      // Validate columns
      const firstRow: any = json[0];
      const requiredColumns = ['entidad de registro', 'link del reverso para descarga directa', 'link de preview'];
      for (const col of requiredColumns) {
        if (!firstRow.hasOwnProperty(col)) {
           throw new Error(`Missing required column: "${col}". Please check your XLSX file.`);
        }
      }

      localStorage.setItem('reverse-sides-db', JSON.stringify(json));
      toast({
        title: "Database loaded successfully!",
        description: `Loaded ${json.length} entries. You will now be redirected.`,
      });
      router.push('/');

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An error occurred while processing the file.');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-secondary p-8">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <UploadCloud className="mx-auto h-16 w-16 text-primary" />
          <CardTitle className="text-3xl font-bold">Upload Reverse Sides Database</CardTitle>
          <CardDescription>
            Please upload the XLSX file containing the links to the reverse sides of the birth certificates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex w-full items-center justify-center">
            <label htmlFor="file-upload" className="w-full">
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  if (e.target.files) {
                    handleFile(e.target.files[0]);
                  }
                }}
                disabled={loading}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary/10 file:text-primary
                  hover:file:bg-primary/20 cursor-pointer"
              />
            </label>
          </div>
          
          {loading && (
            <div className="flex justify-center items-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Processing file...</span>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="text-xs text-muted-foreground p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">XLSX File Requirements:</h4>
            <p>Your file must be in .xlsx format and contain the following columns:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>entidad de registro</li>
              <li>link del reverso para descarga directa</li>
              <li>link de preview</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
