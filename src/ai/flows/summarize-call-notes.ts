'use server';

/**
 * @fileOverview A call summarization AI agent.
 *
 * - summarizeCallNotes - A function that handles the call summarization process.
 * - SummarizeCallNotesInput - The input type for the summarizeCallNotes function.
 * - SummarizeCallNotesOutput - The return type for the summarizeCallNotes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeCallNotesInputSchema = z.object({
  recordingDataUri: z
    .string()
    .describe(
      "A call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  notes: z.string().describe('The notes added by the agent after the call.'),
});
export type SummarizeCallNotesInput = z.infer<typeof SummarizeCallNotesInputSchema>;

const SummarizeCallNotesOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the call.'),
});
export type SummarizeCallNotesOutput = z.infer<typeof SummarizeCallNotesOutputSchema>;

export async function summarizeCallNotes(input: SummarizeCallNotesInput): Promise<SummarizeCallNotesOutput> {
  return summarizeCallNotesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCallNotesPrompt',
  input: {schema: SummarizeCallNotesInputSchema},
  output: {schema: SummarizeCallNotesOutputSchema},
  prompt: `You are an AI assistant that summarizes phone calls between agents and customers. The agent will provide a recording of the call, and any notes they took during the call. Your job is to provide a short summary of the call, extracting the key information. The summary should be no more than 3 sentences long.

Call Recording: {{media url=recordingDataUri}}

Agent Notes: {{{notes}}}`,
});

const summarizeCallNotesFlow = ai.defineFlow(
  {
    name: 'summarizeCallNotesFlow',
    inputSchema: SummarizeCallNotesInputSchema,
    outputSchema: SummarizeCallNotesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
