'use server';

/**
 * @fileOverview Extracts CURP and Electronic Identifier from a birth certificate.
 *
 * - extractDocumentDetails - A function that handles the detail extraction process.
 * - ExtractDetailsInput - The input type for the extractDocumentDetails function.
 * - ExtractDetailsOutput - The return type for the extractDocumentDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractDetailsInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A birth certificate PDF, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractDetailsInput = z.infer<typeof ExtractDetailsInputSchema>;

const ExtractDetailsOutputSchema = z.object({
  curp: z.string().describe('The CURP (Clave Única de Registro de Población) found in the document.'),
  electronicId: z.string().describe('The Electronic Identifier (Identificador Electrónico) found in the document.'),
});
export type ExtractDetailsOutput = z.infer<typeof ExtractDetailsOutputSchema>;

export async function extractDocumentDetails(input: ExtractDetailsInput): Promise<ExtractDetailsOutput> {
  return extractDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractDocumentDetailsPrompt',
  input: {schema: ExtractDetailsInputSchema},
  output: {schema: ExtractDetailsOutputSchema},
  prompt: `You are an expert in analyzing official Mexican documents.
  
  Analyze the provided birth certificate PDF and extract the following two values:
  1. The CURP (Clave Única de Registro de Población).
  2. The Electronic Identifier (Identificador Electrónico).

  PDF Content: {{media url=pdfDataUri}}

  Return ONLY the extracted values in the specified JSON format. It is very important that you find and return both values accurately.
  `,
});

const extractDetailsFlow = ai.defineFlow(
  {
    name: 'extractDetailsFlow',
    inputSchema: ExtractDetailsInputSchema,
    outputSchema: ExtractDetailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
