'use client';

import { useCall } from '@/contexts/call-context';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { List, Phone, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LeadActions() {
  const { dispatch } = useCall();
  const { toast } = useToast();

  const handleDial = () => {
    dispatch({ type: 'TOGGLE_SOFTPHONE' });
  };

  const handleFetchLead = () => {
    // This is where we will fetch from the database in the future.
    // For now, it will just show a placeholder message.
    toast({
      title: 'Feature Coming Soon',
      description: 'Fetching leads from a database is not yet implemented.',
    });
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-center sm:text-left text-muted-foreground">
            Start a new call:
          </p>
          <div className="flex gap-2">
            <Button onClick={handleDial}>
              <Phone className="mr-2" />
              Dial Number
            </Button>
            <Button variant="secondary" onClick={handleFetchLead}>
              <List className="mr-2" />
              Fetch Next Lead
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
