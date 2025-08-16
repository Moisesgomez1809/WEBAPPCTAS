// src/lib/ocr-utils.ts
"use client";

import * as pdfjsLib from "pdfjs-dist";

// This is the correct way for Next.js to avoid CDN and CORS issues,
// especially in modern bundler environments.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface ExtractedData {
  curp: string | null;
  electronicId: string | null;
  issuingEntity: string | null;
}

async function dataUriToArrayBuffer(dataUri: string): Promise<ArrayBuffer> {
    const response = await fetch(dataUri);
    return response.arrayBuffer();
}

/**
 * Extracts specific data fields from the text content of a PDF.
 * @param text The full text extracted from the PDF.
 * @returns An object containing the extracted data.
 */
async function extractFieldsFromText(text: string): Promise<ExtractedData> {
    // Regex for CURP (standard format)
    const curpRegex = /([A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z\d]\d)/;
    
    // Regex for Electronic ID: Looks for the label (with variations) and captures the following number sequence.
    // \s* handles any spaces or newlines between the label and the number.
    const idRegex = /Identificador\s+Electrónico\s*([0-9]+)/i;

    // Regex for Issuing Entity: Looks for the label, skips any junk text in between (like "Acta de Nacimiento"), 
    // and captures the state name in caps.
    const entidadRegex = /Entidad\s+de\s+Registro\s*(?:Acta\s+de\s+Nacimiento)?\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s{2,}|\n|DATOS)/i;
    
    const curpMatch = text.match(curpRegex);
    const idMatch = text.match(idRegex);
    let entidadMatch = text.match(entidadRegex);

    // Fallback for entity if the main regex fails, for cases where the structure is different
    if (!entidadMatch) {
       const entidadFallbackRegex = /DATOS\s+DE\s+LA\s+ENTIDAD\s+FEDERATIVA\s*([A-Z\s]+?)\s*(?:DATOS DEL ACTA|Fecha de registro)/i;
       entidadMatch = text.match(entidadFallbackRegex);
    }
    
    return {
        curp: curpMatch ? curpMatch[1] : null,
        electronicId: idMatch ? idMatch[1] : null,
        issuingEntity: entidadMatch ? entidadMatch[1].trim().replace(/(\r\n|\n|\r)/gm,"") : null
    };
}


/**
 * Main function to process a PDF Data URI, extract text, and then extract specific fields.
 * @param pdfDataUri The PDF file encoded as a a data URI.
 * @param logFullText If true, logs the full extracted text to the console for debugging.
 * @returns A promise that resolves to an object with the extracted data.
 */
export async function extractDataFromPdf(pdfDataUri: string, logFullText = false): Promise<ExtractedData> {
    try {
        const arrayBuffer = await dataUriToArrayBuffer(pdfDataUri);
        const typedarray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // We use a space to join items, as newlines can sometimes be inconsistent.
            // The regexes are built to handle variable whitespace.
            fullText += textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
        }
        
        if (logFullText) {
            console.log("--- Full Extracted OCR Text ---");
            console.log(fullText);
            console.log("-------------------------------");
        }
        
        const data = await extractFieldsFromText(fullText);

        return data;

    } catch (e) {
        console.error("Failed to process PDF for OCR", e);
        throw new Error("No se pudo procesar el PDF. El archivo puede estar dañado o en un formato no compatible.");
    }
}

    