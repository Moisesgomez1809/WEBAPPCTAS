
"use client"
import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import * as QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

async function dataUriToUint8Array(dataUri: string): Promise<Uint8Array> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

export async function modifyReversePdfClient(reversePdfUri: string, curp: string, electronicId: string): Promise<string> {
    try {
        const qrCodeContent = `CURP: ${curp}\nIDENTIFICADOR ELECTRONICO: ${electronicId}`;
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
        const textSize = 4.5;
        const textYOffset = 5;
        
        // A single white rectangle to act as a background for both the QR code and the text
        firstPage.drawRectangle({
            x: qrX - 5,
            y: qrY - textSize - (textYOffset + 2), // Adjusted y to include space for text
            width: qrSize + 10,
            height: qrSize + textSize + (textYOffset + 4), // Adjusted height
            color: rgb(1, 1, 1), 
        });

        // Draw the new QR code
        firstPage.drawImage(qrImage, {
            x: qrX,
            y: qrY,
            width: qrSize,
            height: qrSize,
        });
        
        // Draw the CURP text just below the QR code
        const textX = qrX + 3;
        const textY = qrY - textYOffset; 

        firstPage.drawText(curp, {
            x: textX,
            y: textY,
            font: helveticaFont,
            size: textSize,
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

function generateRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function addFolioToPdfClient(pdfUri: string): Promise<string> {
    try {
        const pdfBytes = await dataUriToUint8Array(pdfUri);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        const g = generateRandomNumber(10, 99);
        const c = generateRandomNumber(1000000, 9999999);
        const folioText = `A${g} ${c}`;
        const barcodeData = `A${g}${c}`;

        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const firstPage = pdfDoc.getPage(0);
        const { height } = firstPage.getSize();
        const yPos = height - 50;

        firstPage.drawText("FOLIO", {
            x: 85,
            y: yPos,
            size: 10,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0)
        });

        firstPage.drawText(folioText, {
            x: 70,
            y: yPos - 10,
            size: 10,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0)
        });

        const canvas = document.createElement("canvas");
        JsBarcode(canvas, barcodeData, {
            format: "CODE128",
            displayValue: false,
            height: 25,
            background: "transparent",
            lineColor: "black",
            margin: 0,
        });

        const barcodeImageBytes = await dataUriToUint8Array(canvas.toDataURL("image/png"));
        const barcodeImage = await pdfDoc.embedPng(barcodeImageBytes);
        const barcodeDims = barcodeImage.scale(0.5);

        firstPage.drawImage(barcodeImage, {
            x: 40,
            y: yPos - 30,
            width: barcodeDims.width,
            height: barcodeDims.height,
        });

        const modifiedPdfBase64 = await pdfDoc.saveAsBase64({ dataUri: true });
        return modifiedPdfBase64;

    } catch (error) {
        console.error("Error adding folio to PDF:", error);
        throw new Error("Failed to add folio and barcode to the document.");
    }
}


export async function framePdfClient(originalPdfUri: string, framePdfUri: string): Promise<string> {
    try {
        const originalPdfBytes = await dataUriToUint8Array(originalPdfUri);
        const framePdfBytes = await dataUriToUint8Array(framePdfUri);

        const frameDoc = await PDFDocument.load(framePdfBytes);
        const originalDoc = await PDFDocument.load(originalPdfBytes);

        const framePage = frameDoc.getPage(0);
        
        const originalPage = originalDoc.getPage(0);

        const embeddedPage = await frameDoc.embedPage(originalPage);

        const { width: frameWidth, height: frameHeight } = framePage.getSize();
        
        // **AQUÍ PUEDES AJUSTAR**
        // Reducir los valores de los márgenes hará el documento MÁS GRANDE.
        // Aumentar los valores de los márgenes hará el documento MÁS PEQUEÑO.
        const pageMargin = { top: 20, bottom: 18, left: 5, right: 9 };

        const embedWidth = frameWidth - pageMargin.left - pageMargin.right;
        const embedHeight = frameHeight - pageMargin.top - pageMargin.bottom;

        // **Y AQUÍ TAMBIÉN**
        // Para subir o bajar el documento, ajusta `pageMargin.bottom`.
        // Un valor más alto en `y` mueve el documento hacia arriba.
        // Un valor más bajo en `y` mueve el documento hacia abajo.
        framePage.drawPage(embeddedPage, {
            x: pageMargin.left,
            y: pageMargin.bottom + 7, // Le sumé 10 para subirlo un poco
            width: embedWidth,
            height: embedHeight,
        });

        const modifiedPdfBase64 = await frameDoc.saveAsBase64({ dataUri: true });
        return modifiedPdfBase64;
    } catch (error) {
        console.error("Error framing PDF:", error);
        throw new Error("Failed to frame the PDF document. Ensure the frame PDF is valid.");
    }
}

export async function modifyMetadataAndResizeClient(pdfUri: string): Promise<string> {
    try {
        const pdfBytes = await dataUriToUint8Array(pdfUri);
        const originalDoc = await PDFDocument.load(pdfBytes);
        
        const newDoc = await PDFDocument.create();

        // Clear metadata and set specific producer
        newDoc.setTitle('');
        newDoc.setAuthor('');
        newDoc.setSubject('');
        newDoc.setKeywords([]);
        newDoc.setCreator('');
        newDoc.setProducer('Oracle XML Publisher 5.6.2');
        const fixedDate = new Date('1970-01-01T00:00:00.000Z');
        newDoc.setCreationDate(fixedDate);
        newDoc.setModificationDate(fixedDate);

        const letterSize = PageSizes.Letter; // [612, 792] points
        
        const originalPages = originalDoc.getPages();
        for (const originalPage of originalPages) {
            const embeddedPage = await newDoc.embedPage(originalPage);
            const { width: origWidth, height: origHeight } = originalPage.getSize();
            
            // Calculate scale to fit and preserve aspect ratio, then increase it slightly.
            let scale = Math.min(letterSize[0] / origWidth, letterSize[1] / origHeight);
            scale *= 1.03; // Make it 3% larger

            const scaledWidth = origWidth * scale;
            const scaledHeight = origHeight * scale;

            // Calculate position to center the content
            const x = (letterSize[0] - scaledWidth) / 2;
            const y = (letterSize[1] - scaledHeight) / 2;
            
            const newPage = newDoc.addPage(letterSize);
            
            newPage.drawPage(embeddedPage, {
                x,
                y,
                width: scaledWidth,
                height: scaledHeight,
            });
        }

        const modifiedPdfBase64 = await newDoc.saveAsBase64({ dataUri: true });
        return modifiedPdfBase64;

    } catch (error) {
        console.error("Error modifying metadata and resizing PDF:", error);
        throw new Error("No se pudo modificar la metadata y redimensionar el PDF. El archivo puede estar corrupto.");
    }
}
