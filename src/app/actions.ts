
'use server';

import { extractIssuingEntity as extractEntityFlow } from '@/ai/flows/extract-entity';
import { extractDocumentDetails as extractDetailsFlow } from '@/ai/flows/extract-details';
import { get, ref } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { ReverseSideEntry } from '@/lib/types';


export async function verifyUser(username: string, token: string): Promise<boolean> {
  try {
    const userRef = ref(database, `USERS/${username}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const storedToken = snapshot.val();
      return storedToken === token;
    }
    return false;
  } catch (error) {
    console.error("Firebase verification failed:", error);
    return false;
  }
}

export async function fetchReverseSidesFromDB(): Promise<ReverseSideEntry[]> {
  try {
    const reversosRef = ref(database, 'REVERSOS');
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
        const frameRef = ref(database, 'MARCOS/MARCO DE ACTAS');
        const snapshot = await get(frameRef);
        if (snapshot.exists()) {
            return snapshot.val();
        }
        throw new Error("Frame link not found in Firebase at MARCOS/MARCO DE ACTAS.");
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

// Re-export AI flows for easier and consistent import on the client-side component.
export const extractIssuingEntity = extractEntityFlow;
export const extractDocumentDetails = extractDetailsFlow;
