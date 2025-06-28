'use server';

/**
 * @fileOverview Automatically selects the correct reverse side PDF from Google Drive based on the identified issuing entity.
 *
 * - matchReverseSide - A function that handles the matching process.
 * - MatchReverseSideInput - The input type for the matchReverseSide function.
 * - MatchReverseSideOutput - The return type for the matchReverseSide function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MatchReverseSideInputSchema = z.object({
  entity: z.string().describe('The identified issuing entity from the birth certificate PDF.'),
});
export type MatchReverseSideInput = z.infer<typeof MatchReverseSideInputSchema>;

const MatchReverseSideOutputSchema = z.object({
  reverseSidePdfUrl: z
    .string()
    .describe(
      'The URL of the corresponding reverse side PDF in the Google Drive folder.'
    ),
});
export type MatchReverseSideOutput = z.infer<typeof MatchReverseSideOutputSchema>;

export async function matchReverseSide(input: MatchReverseSideInput): Promise<MatchReverseSideOutput> {
  return matchReverseSideFlow(input);
}

const prompt = ai.definePrompt({
  name: 'matchReverseSidePrompt',
  input: {schema: MatchReverseSideInputSchema},
  output: {schema: MatchReverseSideOutputSchema},
  prompt: `You are an expert in document management and information retrieval.

You are provided with the name of an entity, and you must return the URL of the corresponding reverse side PDF in the following Google Drive folder: https://drive.google.com/drive/folders/1XUWhogphvvamI3r8EAitrrRbpL2HN9uo?usp=sharing.

Entity: {{{entity}}}

Ensure that the URL you return is a valid URL.
`,
});

const matchReverseSideFlow = ai.defineFlow(
  {
    name: 'matchReverseSideFlow',
    inputSchema: MatchReverseSideInputSchema,
    outputSchema: MatchReverseSideOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
