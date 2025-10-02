
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
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const { fetchAgents, loginAsAgent, state } = useCall();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
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
      const fetchedAgents = await fetchAgents();
      setAgents(fetchedAgents);
      if (fetchedAgents.length > 0) {
        // Pre-select the first agent if desired, or leave empty
        // setSelectedAgentId(fetchedAgents[0].agent_id);
      }
      setIsLoading(false);
    };
    getAgents();
  }, [fetchAgents]);

  const handleLogin = () => {
    const agentToLogin = agents.find((agent) => agent.agent_id === selectedAgentId);
    if (agentToLogin) {
      loginAsAgent(agentToLogin);
      router.push('/');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
            <Image src="https://storage.googleapis.com/aifire.appspot.com/project-assets/bigfoot-logo.png" alt="Caprae Capital Partners Logo" width={50} height={50} className="mb-2"/>
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
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.agent_id} value={agent.agent_id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={!selectedAgentId}
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
