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

// Define a simplified Agent type for the component's internal state
// to ensure the 'id' is treated as a string for React keys/values.
interface AgentStringId extends Omit<Agent, 'agent_id'> {
    id: string;
    agent_id: string;
}

export default function LoginPage() {
  const { fetchAgents, loginAsAgent, state } = useCall();
  const [agents, setAgents] = useState<AgentStringId[]>([]); // Use the string ID interface
  const [selectedId, setSelectedId] = useState<string>(''); 
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
      // Ensure we access the correct key from the API response
      const fetchedAgents = fetchedData || [];
      
      // Filter out agents with invalid ID and map to ensure ID is a string
      const validAgents: AgentStringId[] = fetchedAgents
        .filter(agent => 
            agent.agent_id !== undefined && agent.agent_id !== null && String(agent.agent_id).trim() !== ''
        )
        .map(agent => ({
            ...agent,
            // CRITICAL FIX: Ensure the ID is a string for React/Select component compatibility
            id: String(agent.agent_id) 
        }));

      if (process.env.NODE_ENV === 'development') {
          if (validAgents.length !== fetchedAgents.length) {
              console.warn(`[Data Warning] Removed ${fetchedAgents.length - validAgents.length} agent(s) with invalid ID.`);
          }
      }
      
      setAgents(validAgents);
      
      if (validAgents.length > 0) {
        setSelectedId(validAgents[0].id);
      } else {
        setSelectedId('');
      }

      setIsLoading(false);
    };
    getAgents();
  }, [fetchAgents]);

  const handleLogin = () => {
    // Find the original agent object based on the selected string ID
    const agentToLogin = agents.find((agent) => agent.id === selectedId);
    
    // We assume loginAsAgent expects the original 'Agent' type, 
    // so we pass the object retrieved from our mapped list.
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
                src="https://storage.googleapis.com/aifire.appspot.com/project-assets/bigfoot-logo.png" 
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
              {/* Ensure the Select component is controlled by the string state */}
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                      <SelectItem 
                          // Both key and value must be strings
                          key={agent.id} 
                          value={agent.id}
                      >
                        {agent.name}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                onClick={handleLogin}
                // Check if a valid ID (non-empty string) is selected
                disabled={!selectedId}
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
