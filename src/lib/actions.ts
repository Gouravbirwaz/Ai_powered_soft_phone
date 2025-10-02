'use server';

import { summarizeCallNotes } from '@/ai/flows/summarize-call-notes';
import { DUMMY_AUDIO_DATA_URI } from '@/lib/utils';
import { z } from 'zod';

const resultSchema = z.object({
  summary: z.string().optional(),
  error: z.string().optional(),
});

export async function generateSummaryAction(
  notes: string
): Promise<z.infer<typeof resultSchema>> {
  if (!notes) {
    return { error: 'Notes cannot be empty.' };
  }

  try {
    const output = await summarizeCallNotes({
      notes,
      recordingDataUri: DUMMY_AUDIO_DATA_URI,
    });
    return { summary: output.summary };
  } catch (error) {
    console.error('Error generating summary:', error);
    return { error: 'Failed to generate summary. Please try again.' };
  }
}
