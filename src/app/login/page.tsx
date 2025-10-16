
'use client';

import { useEffect, useState } from 'react';
import { useCall } from '@/contexts/call-context';
import type { Agent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Loader2, User, AlertCircle, ShieldCheck, Phone } from 'lucide-react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

function AgentLoginTab() {
  const { loginAsAgent, state, fetchAgents, initializeTwilio } = useCall();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState<number | null>(null); // Store agentId
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.currentAgent && state.currentAgent.role === 'agent') {
      router.replace('/');
    }
  }, [state.currentAgent, router]);

  useEffect(() => {
    const loadAgents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedAgents = await fetchAgents();
        if (fetchedAgents && fetchedAgents.length > 0) {
          setAgents(fetchedAgents.filter(a => a.name !== 'Zackary Beckham' && a.name !== 'Kevin Hong'));
        } else {
          setError('No agents found. Please check the backend configuration.');
        }
      } catch (e: any) {
        setError(e.message || 'Failed to fetch agents.');
      } finally {
        setIsLoading(false);
      }
    };
    loadAgents();
  }, [fetchAgents]);

  const handleLogin = async (agent: Agent) => {
    setIsLoggingIn(agent.id);
    await loginAsAgent(agent, 'agent');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-center p-4 flex items-center gap-2 justify-center">
        <AlertCircle className="h-5 w-5" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-64">
      <div className="space-y-2 pr-4">
        {agents.map((agent) => (
          <Card key={agent.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Avatar>
                  <AvatarFallback>
                      <User />
                  </AvatarFallback>
                 </Avatar>
                 <div>
                     <p className="font-semibold">{agent.name}</p>
                     <p className="text-sm text-muted-foreground">{agent.email}</p>
                 </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleLogin(agent)}
                disabled={isLoggingIn !== null}
                className="w-24"
              >
                {isLoggingIn === agent.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Login'
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}


function AdminLoginTab() {
  const { loginAsAgent, state } = useCall();
  
  const [admins] = useState<Agent[]>([
    { id: 999, name: 'Zackary Beckham', email: 'zack@capraecapital.com', phone: '', status: 'admin' },
    { id: 998, name: 'Kevin Hong', email: 'kevin@capraecapital.com', phone: '', status: 'admin' }
  ]);
  
  const [isLoggingIn, setIsLoggingIn] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.currentAgent && state.currentAgent.role === 'admin') {
      router.replace('/dashboard');
    }
  }, [state.currentAgent, router]);

  const handleLogin = async (agent: Agent) => {
    setIsLoggingIn(agent.id);
    await loginAsAgent({ ...agent, role: 'admin' }, 'admin');
  };
  
  return (
    <ScrollArea className="h-64">
      <div className="space-y-2 pr-4">
        {admins.map((agent) => (
          <Card key={agent.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Avatar>
                  <AvatarFallback>
                      <ShieldCheck />
                  </AvatarFallback>
                 </Avatar>
                 <div>
                     <p className="font-semibold">{agent.name}</p>
                     <p className="text-sm text-muted-foreground">{agent.email}</p>
                 </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleLogin(agent)}
                disabled={isLoggingIn !== null}
                className="w-24"
              >
                {isLoggingIn === agent.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Login'
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

export default function LoginPage() {
  const { state } = useCall();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (state.currentAgent) {
      if (state.currentAgent.role === 'admin') {
        router.replace('/dashboard');
      } else {
        router.replace('/');
      }
    }
  }, [state.currentAgent, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image
            src="/saasquatchleads_logo_notext.png"
            alt="Caprae Capital Partners Logo"
            width={50}
            height={50}
            className="mb-2"
            unoptimized
          />
          <CardTitle className="text-2xl">Caprae Capital Partners</CardTitle>
          <CardDescription>Select your role to start your session</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="agent" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="agent">
                <Phone className="mr-2 h-4 w-4" /> Agent
              </TabsTrigger>
              <TabsTrigger value="admin">
                <ShieldCheck className="mr-2 h-4 w-4" /> Admin
              </TabsTrigger>
            </TabsList>
            <TabsContent value="agent" className="pt-4">
                <AgentLoginTab />
            </TabsContent>
            <TabsContent value="admin" className="pt-4">
                <AdminLoginTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
