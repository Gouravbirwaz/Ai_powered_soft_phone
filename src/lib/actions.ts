'use server';

import { summarizeCallNotes } from '@/ai/flows/summarize-call-notes';
import { z } from 'zod';

const resultSchema = z.object({
  summary: z.string().optional(),
  error: z.string().optional(),
});

export async function generateSummaryAction(
  notes: string,
  recordingDataUri: string
): Promise<z.infer<typeof resultSchema>> {
  if (!notes) {
    return { error: 'Notes cannot be empty.' };
  }

  if (!recordingDataUri) {
    return { error: 'Call recording is not available to generate a summary.' }
  }

  try {
    const output = await summarizeCallNotes({
      notes,
      recordingDataUri: recordingDataUri,
    });
    return { summary: output.summary };
  } catch (error) {
    console.error('Error generating summary:', error);
    return { error: 'Failed to generate summary. Please try again.' };
  }
}
