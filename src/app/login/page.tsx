
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

const TEST_PASSWORD = 'caprare@123';

export default function LoginPage() {
  const { fetchAgents, loginAsAgent, state } = useCall();
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (state.currentAgent) {
      router.replace('/');
    }
  }, [state.currentAgent, router]);

  useEffect(() => {
    const getAgents = async () => {
      setIsLoading(true);
      const fetchedData = await fetchAgents();
      const fetchedAgents = fetchedData || [];

      const validAgents = fetchedAgents.filter(
        (agent) => agent.id !== undefined && agent.id !== null
      );

      if (process.env.NODE_ENV === 'development') {
        if (validAgents.length !== fetchedAgents.length) {
          console.warn(
            `[Data Warning] Removed ${
              fetchedAgents.length - validAgents.length
            } agent(s) with invalid ID.`
          );
        }
      }

      setAgents(validAgents);

      if (validAgents.length > 0) {
        setSelectedId(String(validAgents[0].id));
      } else {
        setSelectedId('');
      }

      setIsLoading(false);
    };
    getAgents();
  }, [fetchAgents]);

  const handleLogin = () => {
    if (password !== TEST_PASSWORD) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Incorrect password. Please try again.',
      });
      return;
    }

    const agentToLogin = agents.find((agent) => String(agent.id) === selectedId);

    if (agentToLogin) {
      loginAsAgent(agentToLogin);
      router.push('/');
    }
  };

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
          <CardDescription>Select an agent to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agent-select">Agent</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger id="agent-select">
                    <SelectValue placeholder="Select an agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={String(agent.id)}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={!selectedId || !password}
              >
                Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
