
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ShieldCheck, Phone } from 'lucide-react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

function AgentLoginTab() {
  const { loginWithPassword } = useCall();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setError(null);

    const success = await loginWithPassword(email, password);
    
    if (success) {
        toast({ title: "Login Successful", description: "Welcome back!" });
        // The context will handle navigation via useEffect
    } else {
        setError('Invalid credentials or agent not found.');
        setIsLoggingIn(false);
    }
  };

  return (
     <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="agent-email">Email</Label>
        <Input
          id="agent-email"
          type="email"
          placeholder="agent@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoggingIn}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="agent-password">Password</Label>
        <Input
          id="agent-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoggingIn}
        />
      </div>
      {error && (
        <div className="text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={isLoggingIn}>
        {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Login as Agent
      </Button>
    </form>
  );
}


function AdminLoginTab() {
  const { loginAsAgent, state } = useCall();
  
  const hardcodedAdmins: Agent[] = [
    { id: 999, name: 'Zackary Beckham', email: 'zack@capraecapital.com', phone: '', status: 'admin', role: 'admin' },
    { id: 998, name: 'Kevin Hong', email: 'kevin@capraecapital.com', phone: '', status: 'admin', role: 'admin' }
  ];
  const adminCredentials: { [email: string]: string } = {
    'zack@capraecapital.com': 'zack@caprae123',
    'kevin@capraecapital.com': 'kevin@caprae123',
  };
  
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

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setError(null);

    const lowerCaseEmail = email.toLowerCase();
    const expectedPassword = adminCredentials[lowerCaseEmail];

    if (expectedPassword && password === expectedPassword) {
      const adminUser = hardcodedAdmins.find(a => a.email.toLowerCase() === lowerCaseEmail);
      if (adminUser) {
        await loginAsAgent(adminUser, 'admin');
        // useEffect will handle navigation
      } else {
        // This case should theoretically not happen if credentials are correct
        setError('An unexpected error occurred. Admin profile mismatch.');
        setIsLoggingIn(false);
      }
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
        <div className="text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={isLoggingIn}>
        {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Login as Admin
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
      <Card className="w-full max-w-md">
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
