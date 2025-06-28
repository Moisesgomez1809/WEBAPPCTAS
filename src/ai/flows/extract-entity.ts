// src/ai/flows/extract-entity.ts
'use server';

/**
 * @fileOverview Extracts the issuing entity from a birth certificate PDF.
 *
 * - extractIssuingEntity - A function that handles the entity extraction process.
 * - ExtractIssuingEntityInput - The input type for the extractIssuingEntity function.
 * - ExtractIssuingEntityOutput - The return type for the extractIssuingEntity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractIssuingEntityInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A birth certificate PDF, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractIssuingEntityInput = z.infer<typeof ExtractIssuingEntityInputSchema>;

const ExtractIssuingEntityOutputSchema = z.object({
  issuingEntity: z.string().describe('The identified issuing entity from the PDF.'),
});
export type ExtractIssuingEntityOutput = z.infer<typeof ExtractIssuingEntityOutputSchema>;

export async function extractIssuingEntity(input: ExtractIssuingEntityInput): Promise<ExtractIssuingEntityOutput> {
  return extractIssuingEntityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractIssuingEntityPrompt',
  input: {schema: ExtractIssuingEntityInputSchema},
  output: {schema: ExtractIssuingEntityOutputSchema},
  prompt: `You are an expert in document analysis, specializing in identifying the issuing entity of birth certificates.

  Analyze the provided PDF data and extract the issuing entity. The issuing entity is the organization or government body responsible for issuing the birth certificate.

  PDF Content: {{media url=pdfDataUri}}

  Return ONLY the name of the issuing entity.  Do not include any additional text or explanation.  If you are unsure, make your best guess.  It is very important to return a valid string.
  `,
});

const extractIssuingEntityFlow = ai.defineFlow(
  {
    name: 'extractIssuingEntityFlow',
    inputSchema: ExtractIssuingEntityInputSchema,
    outputSchema: ExtractIssuingEntityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);


