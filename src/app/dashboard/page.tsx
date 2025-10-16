
'use client';

import { useCall } from '@/contexts/call-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import Image from 'next/image';
import type { Agent, Call } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, User, RefreshCw, BarChart, FileText, Users, Phone, Star } from 'lucide-react';
import { evaluateAgentPerformanceAction } from '@/lib/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';


interface AgentStats extends Agent {
    calls: Call[];
    evaluation: string;
    score: number;
    isEvaluating: boolean;
}

export default function DashboardPage() {
  const { state, fetchAgents, fetchAllCallHistory, logout } = useCall();
  const router = useRouter();
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!state.currentAgent || state.currentAgent.role !== 'admin') {
      router.replace('/login');
    }
  }, [state.currentAgent, router]);
  
  useEffect(() => {
    if (state.currentAgent && state.currentAgent.role === 'admin') {
      const loadData = async () => {
        setIsLoading(true);
        const agents = await fetchAgents();
        const calls = await fetchAllCallHistory();
        
        const stats: AgentStats[] = agents.map(agent => ({
          ...agent,
          calls: calls.filter((c: Call) => String(c.agentId) === String(agent.id)),
          evaluation: '',
          score: 0,
          isEvaluating: false,
        }));
        setAgentStats(stats);
        setIsLoading(false);
      }
      loadData();
    }
  }, [state.currentAgent, fetchAgents, fetchAllCallHistory]);
  
  const handleEvaluate = async (agentId: number) => {
    setAgentStats(prevStats => prevStats.map(stat => 
        stat.id === agentId ? { ...stat, isEvaluating: true } : stat
    ));

    const agentToEvaluate = agentStats.find(stat => stat.id === agentId);
    if (!agentToEvaluate) return;

    const result = await evaluateAgentPerformanceAction(agentToEvaluate.calls);
    
    setAgentStats(prevStats => prevStats.map(stat => 
        stat.id === agentId ? { 
            ...stat, 
            evaluation: result.evaluation || result.error || '', 
            score: result.score || 0,
            isEvaluating: false 
        } : stat
    ));
  };
  
  const handleLogout = () => {
    logout();
    router.replace('/login');
  }

  const totalCalls = useMemo(() => agentStats.reduce((sum, agent) => sum + agent.calls.length, 0), [agentStats]);

  if (!state.currentAgent || state.currentAgent.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-4">
            <Image
                src="/saasquatchleads_logo_notext.png" 
                alt="Caprae Capital Partners Logo"
                width={40}
                height={40}
            />
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">
                    Performance Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                    Welcome, {state.currentAgent.name}. | AI-powered agent performance analysis.
                </p>
            </div>
        </div>
        <Button onClick={handleLogout} variant="outline">Logout</Button>
      </div>

        <Card>
            <CardHeader>
                <CardTitle>Team Overview</CardTitle>
                <CardDescription>A summary of your team's performance.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
                <Card className="p-4">
                    <div className="flex items-center gap-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Total Agents</p>
                            <p className="text-2xl font-bold">{agentStats.length}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-4">
                        <Phone className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Total Calls Made</p>
                            <p className="text-2xl font-bold">{totalCalls}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-4">
                        <BarChart className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Avg Calls per Agent</p>
                            <p className="text-2xl font-bold">
                                {agentStats.length > 0 ? (totalCalls / agentStats.length).toFixed(1) : 0}
                            </p>
                        </div>
                    </div>
                </Card>
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>
            Detailed call metrics and AI-powered evaluation for each agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
        {isLoading ? (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {agentStats.map((agent) => (
              <AccordionItem value={`agent-${agent.id}`} key={agent.id}>
                <AccordionTrigger>
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarFallback><User /></AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                            <p className="font-semibold">{agent.name}</p>
                            <p className="text-sm text-muted-foreground">{agent.calls.length} calls</p>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-semibold mb-2 flex items-center gap-2"><BarChart className="h-4 w-4" /> Call Statistics</h4>
                                <Table>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium">Total Calls</TableCell>
                                            <TableCell className="text-right">{agent.calls.length}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Completed</TableCell>
                                            <TableCell className="text-right">{agent.calls.filter(c => c.status === 'completed').length}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Voicemails</TableCell>
                                            <TableCell className="text-right">{agent.calls.filter(c => c.status === 'voicemail-dropped').length}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Failed/Busy</TableCell>
                                            <TableCell className="text-right">{agent.calls.filter(c => c.status === 'failed' || c.status === 'busy').length}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Avg. Duration</TableCell>
                                            <TableCell className="text-right">
                                                {agent.calls.length > 0 ? 
                                                    `${Math.round(agent.calls.reduce((acc, c) => acc + (c.duration || 0), 0) / agent.calls.length)}s`
                                                    : 'N/A'
                                                }
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> AI Evaluation</h4>
                                    <Button size="sm" variant="outline" onClick={() => handleEvaluate(agent.id)} disabled={agent.isEvaluating || agent.calls.length === 0}>
                                        {agent.isEvaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                        Analyze
                                    </Button>
                                </div>
                                {agent.isEvaluating ? (
                                    <div className="flex items-center justify-center h-full min-h-[150px] bg-background rounded-md">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : agent.evaluation ? (
                                    <Card className="bg-background">
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
                                            <Star className="w-4 h-4 text-yellow-500" />
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-bold">{agent.score.toFixed(1)}</span>
                                                <span className="text-sm text-muted-foreground">/ 10</span>
                                            </div>
                                            <Progress value={agent.score * 10} className="w-full h-2 mt-2" />
                                            <p className="text-sm whitespace-pre-wrap mt-4">{agent.evaluation}</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="flex items-center justify-center text-sm text-muted-foreground h-full min-h-[150px] bg-background rounded-md">
                                        Click "Analyze" to generate an AI performance review for this agent.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
