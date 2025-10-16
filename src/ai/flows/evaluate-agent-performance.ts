
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

const EvaluateAgentPerformanceInputSchema = z.object({
    agentName: z.string().describe("The name of the agent being evaluated."),
    calls: z.array(
        z.object({
            id: z.string(),
            direction: z.enum(['incoming', 'outgoing']),
            status: z.string(),
            duration: z.number().optional(),
            notes: z.string().optional(),
            summary: z.string().optional(),
        })
    ),
});

export type EvaluateAgentPerformanceInput = z.infer<typeof EvaluateAgentPerformanceInputSchema>;

const EvaluateAgentPerformanceOutputSchema = z.object({
  evaluation: z.string().describe("A comprehensive, yet concise, evaluation of the agent's performance, formatted as a professional report. Use Markdown for formatting (e.g., headings, bullet points). This evaluation must explain the reasoning behind the score."),
  score: z.number().describe("A numerical score from 1 to 10 representing the agent's overall performance, where 1 is poor and 10 is excellent."),
});

export type EvaluateAgentPerformanceOutput = z.infer<typeof EvaluateAgentPerformanceOutputSchema>;

export async function evaluateAgentPerformance(
  input: EvaluateAgentPerformanceInput
): Promise<EvaluateAgentPerformanceOutput> {
  return evaluateAgentPerformanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateAgentPerformancePrompt',
  input: { schema: z.object({ agentName: z.string(), callDataJson: z.string() }) },
  output: { schema: EvaluateAgentPerformanceOutputSchema },
  prompt: `You are an expert performance analyst for a financial services company, Caprae Capital Partners. Your task is to evaluate the performance of agent '{{{agentName}}}' based on their recent call logs and provide a score out of 10.

Analyze the provided call data to identify trends, strengths, and areas for improvement. Focus on the quality of interactions and outcomes, not just the quantity of calls. A few high-quality, long 'completed' calls are better than many failed or busy calls.

**Key areas to analyze:**
1.  **Call Outcomes:** Look at the distribution of call statuses ('completed', 'voicemail-dropped', 'busy', 'failed'). A high number of 'completed' calls with long durations is very positive. A high number of 'failed' or 'busy' calls is a negative signal, indicating issues with the lead list or dialing strategy.
2.  **Conversion Quality:** Examine the 'notes' and 'summary' fields for 'completed' calls. Look for evidence of positive engagement, such as scheduled follow-ups, expressions of interest from the lead, or successful information gathering. A good agent will have detailed and positive notes. Vague notes are a negative signal.
3.  **Efficiency:** Consider the average call duration for 'completed' calls. Very short 'completed' calls might indicate the agent is not engaging leads effectively. Very long calls are only good if they consistently lead to positive outcomes noted in the summary.
4.  **Communication Skills (Inferred):** Based on the AI-generated summaries and the agent's own notes, assess the clarity and effectiveness of their communication.

**Your Output:**
1.  **Score:** Provide an overall performance score from 1 (poor) to 10 (excellent).
2.  **Evaluation:** Provide a concise, professional evaluation in Markdown. The evaluation must explain *why* you gave the score. It should include:
    - A brief overall summary of the agent's performance.
    - A "Strengths" section with 2-3 bullet points.
    - An "Areas for Improvement" section with 2-3 bullet points.
    - A final "Recommendation" for the agent.

Here are the call logs for {{{agentName}}} to analyze:
{{{callDataJson}}}
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
    const cleanCalls = input.calls.map(call => ({
        id: call.id,
        direction: call.direction,
        status: call.status,
        duration: call.duration,
        notes: call.notes,
        summary: call.summary,
    }));

    if (cleanCalls.length === 0) {
        return { evaluation: `No call data available for ${input.agentName}. Unable to generate an evaluation.`, score: 0 };
    }

    const { output } = await prompt({ agentName: input.agentName, callDataJson: JSON.stringify(cleanCalls) });
    return output!;
  }
);
