
'use server';

import { extractIssuingEntity as extractEntityFlow } from '@/ai/flows/extract-entity';
import { extractDocumentDetails as extractDetailsFlow } from '@/ai/flows/extract-details';
import { get, ref } from 'firebase/database';
import { database as getDb } from '@/lib/firebase';
import type { ReverseSideEntry } from '@/lib/types';


export async function fetchReverseSidesFromDB(): Promise<ReverseSideEntry[]> {
  try {
    const db = getDb();
    const reversosRef = ref(db, 'REVERSOS');
    const snapshot = await get(reversosRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      // Transform the object { "Estado": "link", ... } to the array format the app expects
      const entries: ReverseSideEntry[] = Object.entries(data).map(([key, value]) => ({
        'entidad de registro': key,
        'link del reverso para descarga directa': value as string,
        'link de preview': value as string, // Assuming preview and download links are the same
      }));
      return entries;
    }
    return [];
  } catch (error) {
    console.error("Firebase reverse sides fetch failed:", error);
    throw new Error("Could not fetch reverse sides database from Firebase.");
  }
}

export async function fetchFrameFromDB(): Promise<string> {
    try {
        const db = getDb();
        const frameRef = ref(db, 'MARCOS/MARCO ACTAS');
        const snapshot = await get(frameRef);
        if (snapshot.exists()) {
            return snapshot.val();
        }
        throw new Error("Frame link not found in Firebase at MARCOS/MARCO ACTAS.");
    } catch (error) {
        console.error("Firebase frame fetch failed:", error);
        throw new Error("Could not fetch frame link from Firebase.");
    }
}


// This function attempts to convert a Google Drive viewer URL to a direct download link.
// NOTE: The file in Google Drive must be shared with "Anyone with the link".
function transformGoogleDriveUrl(url: string): string {
    const regex = /drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    // Return the original URL if it doesn't match the expected format.
    return url;
}

export async function getReversePdfAsDataUri(url: string): Promise<string> {
    const downloadUrl = transformGoogleDriveUrl(url);
    try {
        const response = await fetch(downloadUrl, { cache: 'no-store' });
        if (!response.ok) {
            // Google Drive might return an HTML page on failure, let's try to get more info
            const textResponse = await response.text();
            console.error(`Failed to fetch PDF from ${downloadUrl}. Status: ${response.status}. Response: ${textResponse}`);
            throw new Error(`Failed to fetch PDF. The file might be private or the link is incorrect.`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        return `data:application/pdf;base64,${base64}`;
    } catch (error) {
        console.error("Error fetching reverse PDF:", error);
        throw new Error("Could not retrieve the reverse side PDF. The file might be private or the link is incorrect.");
    }
}


export async function backupStatToSheet(url: string, day: string, count: number): Promise<{success: boolean; error?: string}> {
  if (!url || !url.startsWith('https://script.google.com/macros/s/')) {
    return { success: false, error: 'URL de Apps Script inválida.' };
  }

  try {
    // Apps Script web apps can receive parameters via query string on POST requests.
    const backupUrl = new URL(url);
    backupUrl.searchParams.append('action', 'guardarCifraPorDia');
    backupUrl.searchParams.append('dia', day);
    backupUrl.searchParams.append('cifra', count.toString());

    // We use a POST request to signal a state change and avoid caching.
    const response = await fetch(backupUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // An empty body is fine as data is in the URL.
      body: '',
      redirect: 'follow' // This is important for Apps Script web apps which often redirect.
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Apps Script backup failed. Status:', response.status, 'Response:', errorText);
      throw new Error(`El servidor de respaldo respondió con un error. Revisa la configuración de tu script.`);
    }
    
    return { success: true };

  } catch (error: any) {
    console.error("Failed to backup to sheet:", error);
    return { success: false, error: error.message || 'No se pudo conectar con el servicio de respaldo.' };
  }
}

// Re-export AI flows for easier and consistent import on the client-side component.
export const extractIssuingEntity = extractEntityFlow;
export const extractDocumentDetails = extractDetailsFlow;
