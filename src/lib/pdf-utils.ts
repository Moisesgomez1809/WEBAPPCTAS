"use client"
import { PDFDocument } from 'pdf-lib';

async function dataUriToUint8Array(dataUri: string): Promise<Uint8Array> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

export async function mergePdfsClient(originalPdfUri: string, reversePdfUri: string): Promise<string> {
    try {
        const originalPdfBytes = await dataUriToUint8Array(originalPdfUri);
        const reversePdfBytes = await dataUriToUint8Array(reversePdfUri);

        const originalPdfDoc = await PDFDocument.load(originalPdfBytes);
        const reversePdfDoc = await PDFDocument.load(reversePdfBytes);

        const mergedPdf = await PDFDocument.create();

        const [originalPage] = await mergedPdf.copyPages(originalPdfDoc, [0]);
        mergedPdf.addPage(originalPage);

        const [reversePage] = await mergedPdf.copyPages(reversePdfDoc, [0]);
        mergedPdf.addPage(reversePage);

        const mergedPdfBase64 = await mergedPdf.saveAsBase64({ dataUri: true });
        return mergedPdfBase64;
    } catch(error) {
        console.error("Error merging PDFs:", error);
        throw new Error("Failed to merge PDF documents.");
    }
}
