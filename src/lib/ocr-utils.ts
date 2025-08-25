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

interface OcrResult {
  extractedData: ExtractedData;
  rawText: string;
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
    const curpRegex = /([A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z\d]\d)/;
    const curpMatch = text.match(curpRegex);

    let electronicId: string | null = null;
    let issuingEntity: string | null = null;

    // Determine document type
    const isDeathCertificate = /acta\s+de\s+defunci[oó]n/i.test(text);

    if (isDeathCertificate) {
        // --- Logic for Death Certificates based on user feedback ---
        // Looks for a long number followed by the label "Identificador Electrónico"
        const idRegexDefuncion = /([0-9]{20,})\s*Identificador\s+Electrónico/;
        // Looks for a state name in uppercase right before "Entidad de Registro"
        const entidadRegexDefuncion = /([A-ZÁÉÍÓÚÑ\s]+)\s+Entidad\s+de\s+Registro/i;

        const idMatch = text.match(idRegexDefuncion);
        const entidadMatch = text.match(entidadRegexDefuncion);

        electronicId = idMatch ? idMatch[1].trim() : null;
        issuingEntity = entidadMatch ? entidadMatch[1].trim().replace(/N°\s+de\s+Certificado\s+de\s+Defunción\s+de\s+la\s+SSA/i, '').trim() : null;

    } else {
        // --- Default Logic for Birth Certificates ---
        const idRegexNacimiento = /Identificador\s+Electrónico\s*([0-9]+)/i;
        const entidadRegexNacimiento = /Entidad\s+de\s+Registro\s*(?:Acta\s+de\s+Nacimiento)?\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s{2,}|\n|DATOS)/i;
        
        const idMatch = text.match(idRegexNacimiento);
        let entidadMatch = text.match(entidadRegexNacimiento);
        
        electronicId = idMatch ? idMatch[1] : null;
        
        // Fallback for entity if the main regex fails
        if (!entidadMatch) {
           const entidadFallbackRegex = /DATOS\s+DE\s+LA\s+ENTIDAD\s+FEDERATIVA\s*([A-Z\s]+?)\s*(?:DATOS DEL ACTA|Fecha de registro)/i;
           entidadMatch = text.match(entidadFallbackRegex);
        }
        issuingEntity = entidadMatch ? entidadMatch[1].trim().replace(/(\r\n|\n|\r)/gm,"") : null;
    }
    
    return {
        curp: curpMatch ? curpMatch[1] : null,
        electronicId: electronicId,
        issuingEntity: issuingEntity
    };
}


/**
 * Main function to process a PDF Data URI, extract text, and then extract specific fields.
 * @param pdfDataUri The PDF file encoded as a a data URI.
 * @param logFullText If true, logs the full extracted text to the console for debugging.
 * @returns A promise that resolves to an object with the extracted data and the raw text.
 */
export async function extractDataFromPdf(pdfDataUri: string, logFullText = false): Promise<OcrResult> {
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

        return {
            extractedData: data,
            rawText: fullText
        };

    } catch (e) {
        console.error("Failed to process PDF for OCR", e);
        throw new Error("No se pudo procesar el PDF. El archivo puede estar dañado o en un formato no compatible.");
    }
}
