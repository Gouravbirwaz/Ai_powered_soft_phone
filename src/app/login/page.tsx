
'use client';

import { useEffect, useState, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MAX_FETCH_ATTEMPTS = 10;

function AgentLoginTab() {
  const { loginAsAgent, state, fetchAgents } = useCall();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState<number | null>(null); // Store agentId
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [fetchAttempt, setFetchAttempt] = useState(0);

  useEffect(() => {
    if (state.currentAgent && state.currentAgent.role === 'agent') {
      router.replace('/');
    }
  }, [state.currentAgent, router]);

  useEffect(() => {
    const loadAgents = async () => {
      if (fetchAttempt >= MAX_FETCH_ATTEMPTS) {
        setError('No agents found. Please check the backend connection or add agents.');
        setIsLoading(false);
        return;
      }
      
      const fetchedAgents = await fetchAgents();

      if (fetchedAgents && fetchedAgents.length > 0) {
        const filteredAgents = fetchedAgents.filter(a => a.role !== 'admin');
        if (filteredAgents.length > 0) {
            setAgents(filteredAgents);
            setIsLoading(false);
        } else {
             // Found only admins, try again in case agents are still loading
             setTimeout(() => setFetchAttempt(prev => prev + 1), 1000);
        }
      } else {
        // No agents found, try again
        setTimeout(() => setFetchAttempt(prev => prev + 1), 1000);
      }
    };

    if (isLoading) {
        loadAgents();
    }
  }, [fetchAgents, fetchAttempt, isLoading]);

  const handleLogin = async (agent: Agent) => {
    setIsLoggingIn(agent.id);
    await loginAsAgent(agent, 'agent');
    // Navigation is handled by the main page useEffect
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground mt-2">
            Connecting to agent service... (Attempt {fetchAttempt + 1}/{MAX_FETCH_ATTEMPTS})
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-muted-foreground text-center p-4 flex items-center gap-2 justify-center">
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
  const { loginAsAgent, state, fetchAgents } = useCall();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.currentAgent && state.currentAgent.role === 'admin') {
      router.replace('/dashboard');
    }
  }, [state.currentAgent, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);
    
    // Fetch agents to find the admin user
    const allAgents = await fetchAgents();
    const adminUser = allAgents.find(a => a.role === 'admin' && a.email.toLowerCase() === email.toLowerCase());

    // This is a simplified, insecure password check for demo purposes.
    // In a real app, you would send the credentials to a backend for verification.
    if (adminUser && password === `${adminUser.name.split(' ')[0].toLowerCase()}@caprae123`) {
      await loginAsAgent(adminUser, 'admin');
    } else {
      setError('Invalid email or password.');
      setIsLoggingIn(false);
    }
  };
  
  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="admin@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoggingIn}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoggingIn}
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p>{error}</p>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={isLoggingIn}>
        {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Login as Admin'}
      </Button>
    </form>
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
