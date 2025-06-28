"use client"
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';

async function dataUriToUint8Array(dataUri: string): Promise<Uint8Array> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

export async function modifyReversePdfClient(reversePdfUri: string, curp: string, electronicId: string): Promise<string> {
    try {
        const qrCodeContent = `CURP: ${curp}\nID: ${electronicId}`;
        const qrCodeImageUri = await QRCode.toDataURL(qrCodeContent, { errorCorrectionLevel: 'M', margin: 2 });
        const qrCodeImageBytes = await dataUriToUint8Array(qrCodeImageUri);
        
        const reversePdfBytes = await dataUriToUint8Array(reversePdfUri);
        const pdfDoc = await PDFDocument.load(reversePdfBytes);
        
        const qrImage = await pdfDoc.embedPng(qrCodeImageBytes);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        const firstPage = pdfDoc.getPage(0);
        const { height } = firstPage.getSize();
        
        const qrSize = 60; 
        const qrX = 30;
        const qrY = height - qrSize - 30;
        
        // Draw a white rectangle to cover the old QR code and any text below it.
        firstPage.drawRectangle({
            x: qrX - 5,
            y: qrY - 15,
            width: qrSize + 10,
            height: qrSize + 20,
            color: rgb(1, 1, 1), 
        });

        firstPage.drawImage(qrImage, {
            x: qrX,
            y: qrY,
            width: qrSize,
            height: qrSize,
        });

        const textX = qrX;
        const textY = qrY - 12; 
        
        firstPage.drawText(curp, {
            x: textX,
            y: textY,
            font: helveticaFont,
            size: 8,
            color: rgb(0, 0, 0),
        });

        const modifiedPdfBase64 = await pdfDoc.saveAsBase64({ dataUri: true });
        return modifiedPdfBase64;

    } catch(error) {
        console.error("Error modifying reverse PDF:", error);
        throw new Error("Failed to modify reverse PDF with new QR code.");
    }
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
