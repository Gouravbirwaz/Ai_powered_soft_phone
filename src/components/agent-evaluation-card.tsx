
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Progress } from './ui/progress';
import { Loader2, Wand2, Star, TrendingUp, TrendingDown, ClipboardCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useMemo } from 'react';

interface AgentEvaluationCardProps {
    isEvaluating: boolean;
    evaluation: string;
    score: number; // This is now the AI-suggested score
}

interface ParsedEvaluation {
    summary: string;
    strengths: string[];
    improvements: string[];
    recommendation: string;
}

// Custom renderers for ReactMarkdown
const markdownComponents = {
    h3: ({ node, ...props }: any) => <h4 className="font-semibold text-base mt-4 mb-2" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc list-inside space-y-1" {...props} />,
    li: ({ node, ...props }: any) => <li className="text-muted-foreground" {...props} />,
    p: ({ node, ...props }: any) => <p className="text-muted-foreground" {...props} />,
};

export default function AgentEvaluationCard({ isEvaluating, evaluation, score }: AgentEvaluationCardProps) {
    const parsedEvaluation = useMemo((): ParsedEvaluation | null => {
        if (!evaluation) return null;

        const sections = {
            summary: '',
            strengths: [] as string[],
            improvements: [] as string[],
            recommendation: '',
        };

        // This parsing logic is fragile and depends on the exact output format of the LLM.
        try {
            const strengthMatch = evaluation.match(/(?:\*\*Strengths\*\*|### Strengths)\s*([\s\S]*?)(?=\n\n(?:\*\*Areas for Improvement\*\*|### Areas for Improvement))/);
            if (strengthMatch && strengthMatch[1]) {
                sections.strengths = strengthMatch[1].trim().split('\n').map(s => s.replace(/^-|^\*|\s/g, ' ').trim()).filter(Boolean);
            }

            const improvementMatch = evaluation.match(/(?:\*\*Areas for Improvement\*\*|### Areas for Improvement)\s*([\s\S]*?)(?=\n\n(?:\*\*Recommendation\*\*|### Recommendation))/);
            if (improvementMatch && improvementMatch[1]) {
                sections.improvements = improvementMatch[1].trim().split('\n').map(s => s.replace(/^-|^\*|\s/g, ' ').trim()).filter(Boolean);
            }

            const recommendationMatch = evaluation.match(/(?:\*\*Recommendation\*\*|### Recommendation)\s*([\s\S]*)/);
            if (recommendationMatch && recommendationMatch[1]) {
                sections.recommendation = recommendationMatch[1].trim();
            }

            const summaryMatch = evaluation.match(/^([\s\S]*?)(?=\n\n(?:\*\*Strengths\*\*|### Strengths))/);
            if (summaryMatch && summaryMatch[1]) {
                sections.summary = summaryMatch[1].trim();
            }
            
            // If any section is empty, it might be a format we don't recognize, so return null to fall back to full markdown.
            if (sections.strengths.length === 0 && sections.improvements.length === 0) {
                return null;
            }

            return sections;
        } catch (e) {
            console.error("Failed to parse evaluation markdown:", e);
            return null; // Fallback to full markdown rendering
        }

    }, [evaluation]);

    if (isEvaluating) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-muted/50 rounded-lg border border-dashed">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Generating AI Performance Review...</p>
                <p className="text-sm text-muted-foreground/50">This may take a moment.</p>
            </div>
        );
    }
    
    if (!evaluation) {
         return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-muted/50 rounded-lg border border-dashed">
                <Wand2 className="h-8 w-8 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No evaluation available.</p>
                <p className="text-sm text-muted-foreground/50">Click "Analyze Performance" to generate a review.</p>
            </div>
        );
    }

    return (
        <Card className="bg-background/70">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-medium">AI Suggested Score</CardTitle>
                        <CardDescription>Based on call data analysis</CardDescription>
                    </div>
                    <div className="flex items-baseline gap-2 text-right">
                        <span className="text-3xl font-bold">{score.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">/ 10</span>
                    </div>
                </div>
                <Progress value={score * 10} className="w-full h-2 mt-4" />
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
                {parsedEvaluation ? (
                     <>
                        <div>
                             <h4 className="font-semibold text-base mb-2 flex items-center gap-2"><TrendingUp className="text-green-500"/> Strengths</h4>
                             <ul className="space-y-2 pl-2">
                                 {parsedEvaluation.strengths.map((item, i) => <li key={`s-${i}`} className="flex items-start gap-3"><div className="w-1 h-1 mt-2 rounded-full bg-green-500 shrink-0"></div><span className="text-sm text-muted-foreground">{item}</span></li>)}
                             </ul>
                        </div>
                        <div>
                             <h4 className="font-semibold text-base mb-2 flex items-center gap-2"><TrendingDown className="text-red-500"/> Areas for Improvement</h4>
                             <ul className="space-y-2 pl-2">
                                 {parsedEvaluation.improvements.map((item, i) => <li key={`i-${i}`} className="flex items-start gap-3"><div className="w-1 h-1 mt-2 rounded-full bg-red-500 shrink-0"></div><span className="text-sm text-muted-foreground">{item}</span></li>)}
                             </ul>
                        </div>
                        <div>
                             <h4 className="font-semibold text-base mb-2 flex items-center gap-2"><ClipboardCheck className="text-blue-500"/> Recommendation</h4>
                             <p className="text-sm text-muted-foreground pl-2">{parsedEvaluation.recommendation}</p>
                        </div>
                    </>
                ) : (
                    // Fallback for when parsing fails
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown components={markdownComponents}>{evaluation}</ReactMarkdown>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
