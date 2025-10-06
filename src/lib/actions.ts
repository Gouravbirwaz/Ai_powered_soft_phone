'use server';

import { summarizeCallNotes } from '@/ai/flows/summarize-call-notes';
import { z } from 'zod';

const resultSchema = z.object({
  summary: z.string().optional(),
  error: z.string().optional(),
});

export async function generateSummaryAction(
  notes: string,
): Promise<z.infer<typeof resultSchema>> {
  if (!notes) {
    return { error: 'Notes/transcript cannot be empty.' };
  }

  try {
    const output = await summarizeCallNotes({
      notes,
    });
    return { summary: output.summary };
  } catch (error) {
    console.error('Error generating summary:', error);
    return { error: 'Failed to generate summary. Please try again.' };
  }
}
