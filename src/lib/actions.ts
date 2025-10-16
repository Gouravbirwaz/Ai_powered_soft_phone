
'use server';

import { summarizeCallNotes } from '@/ai/flows/summarize-call-notes';
import { evaluateAgentPerformance } from '@/ai/flows/evaluate-agent-performance';
import { z } from 'zod';
import type { Call } from './types';

const summaryResultSchema = z.object({
  summary: z.string().optional(),
  error: z.string().optional(),
});

export async function generateSummaryAction(
  notes: string,
): Promise<z.infer<typeof summaryResultSchema>> {
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


const evaluationResultSchema = z.object({
  evaluation: z.string().optional(),
  error: z.string().optional(),
});

export async function evaluateAgentPerformanceAction(
  calls: Call[],
): Promise<z.infer<typeof evaluationResultSchema>> {
  if (!calls || calls.length === 0) {
    return { evaluation: 'No call data provided for this agent.' };
  }

  try {
    const output = await evaluateAgentPerformance(calls);
    return { evaluation: output.evaluation };
  } catch (error) {
    console.error('Error evaluating performance:', error);
    return { error: 'Failed to generate performance evaluation. Please try again.' };
  }
}
