
'use server';

/**
 * @fileOverview An agent performance evaluation AI agent.
 *
 * - evaluateAgentPerformance - A function that handles the performance evaluation.
 * - EvaluateAgentPerformanceInput - The input type for the function.
 * - EvaluateAgentPerformanceOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Call } from '@/lib/types';

const EvaluateAgentPerformanceInputSchema = z.array(
    z.object({
        id: z.string(),
        direction: z.enum(['incoming', 'outgoing']),
        status: z.string(),
        duration: z.number().optional(),
        notes: z.string().optional(),
        summary: z.string().optional(),
    })
);

export type EvaluateAgentPerformanceInput = Call[];

const EvaluateAgentPerformanceOutputSchema = z.object({
  evaluation: z.string().describe('A comprehensive, yet concise, evaluation of the agent\'s performance, formatted as a professional report. Use Markdown for formatting (e.g., headings, bullet points).'),
});

export type EvaluateAgentPerformanceOutput = z.infer<typeof EvaluateAgentPerformanceOutputSchema>;

export async function evaluateAgentPerformance(
  input: EvaluateAgentPerformanceInput
): Promise<EvaluateAgentPerformanceOutput> {
  return evaluateAgentPerformanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateAgentPerformancePrompt',
  input: { schema: EvaluateAgentPerformanceInputSchema },
  output: { schema: EvaluateAgentPerformanceOutputSchema },
  prompt: `You are an expert performance analyst for a financial services company, Caprae Capital Partners. Your task is to evaluate a sales agent's performance based on their recent call logs.

Analyze the provided call data to identify trends, strengths, and areas for improvement. Focus on the quality of interactions and outcomes, not just the quantity of calls.

**Key areas to analyze:**
1.  **Call Outcomes:** Look at the distribution of call statuses ('completed', 'voicemail-dropped', 'busy', 'failed'). A high number of 'completed' calls with long durations is positive. A high number of 'failed' or 'busy' calls might indicate issues with the lead list or dialing strategy.
2.  **Conversion Quality:** Examine the 'notes' and 'summary' fields for 'completed' calls. Look for evidence of positive engagement, such as scheduled follow-ups, expressions of interest from the lead, or successful information gathering. A good agent will have detailed and positive notes.
3.  **Efficiency:** Consider the average call duration. Very short 'completed' calls might indicate the agent is not engaging leads effectively. Very long calls might be inefficient unless they consistently lead to conversions.
4.  **Communication Skills (Inferred):** Based on the AI-generated summaries and the agent's own notes, assess the clarity and effectiveness of their communication.

**Your Output:**
Provide a concise, professional evaluation in Markdown format. The evaluation should include:
- A brief overall summary of the agent's performance.
- A "Strengths" section with 2-3 bullet points.
- An "Areas for Improvement" section with 2-3 bullet points.
- A final "Recommendation" for the agent.

Here are the call logs to analyze:
{{{jsonStringify this}}}
`,
});

const evaluateAgentPerformanceFlow = ai.defineFlow(
  {
    name: 'evaluateAgentPerformanceFlow',
    inputSchema: EvaluateAgentPerformanceInputSchema,
    outputSchema: EvaluateAgentPerformanceOutputSchema,
  },
  async (input) => {
    // Filter out unnecessary fields to keep the prompt clean and focused
    const cleanInput = input.map(call => ({
        id: call.id,
        direction: call.direction,
        status: call.status,
        duration: call.duration,
        notes: call.notes,
        summary: call.summary,
    }));

    if (cleanInput.length === 0) {
        return { evaluation: "No call data available for this agent. Unable to generate an evaluation." };
    }

    const { output } = await prompt(cleanInput);
    return output!;
  }
);
