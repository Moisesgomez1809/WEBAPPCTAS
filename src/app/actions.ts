'use server';

import { extractIssuingEntity as extractEntityFlow } from '@/ai/flows/extract-entity';
import { matchReverseSide as matchReverseSideFlow } from '@/ai/flows/match-reverse-side';

// This function attempts to convert a Google Drive viewer URL to a direct download link.
// NOTE: The file in Google Drive must be shared with "Anyone with the link".
function transformGoogleDriveUrl(url: string): string {
    const regex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
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
            throw new Error(`Failed to fetch PDF. Status: ${response.status}. Ensure the file is shared publicly in Google Drive.`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        return `data:application/pdf;base64,${base64}`;
    } catch (error) {
        console.error("Error fetching reverse PDF:", error);
        throw new Error("Could not retrieve the reverse side PDF. Please check the URL and ensure the file's sharing permissions are set to 'Anyone with the link'.");
    }
}

// Re-export AI flows for easier and consistent import on the client-side component.
export const extractIssuingEntity = extractEntityFlow;
export const matchReverseSide = matchReverseSideFlow;
