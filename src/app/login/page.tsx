
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
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

// NOTE: Since the backend is hardcoded for 'agent_1', we use a default agent here.
const DEFAULT_AGENT: Agent = {
  id: 'agent_1',
  name: 'Zackary Beckham',
  email: 'zackary.beckham@capraecapital.com',
  phone: '+14805182592', 
  status: 'available',
};

export default function LoginPage() {
  const { loginAsAgent, state } = useCall();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.currentAgent) {
      router.replace('/');
    }
  }, [state.currentAgent, router]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    // Directly log in as the default agent.
    await loginAsAgent(DEFAULT_AGENT);
    // The router push will be handled by the effect.
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
          <CardDescription>Ready to start your session?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                 <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Login as {DEFAULT_AGENT.name}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
