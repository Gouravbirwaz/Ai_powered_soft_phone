
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useCall } from '@/contexts/call-context';
import type { Lead } from '@/lib/types';
import { Badge } from './ui/badge';
import { Phone } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

export default function LeadsDialog({
  open,
  onOpenChange,
  leads,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
}) {
  const { startOutgoingCall, state } = useCall();
  const { allCallHistory, activeCall } = state;

  const handleCall = (lead: Lead) => {
    const phoneNumber = lead.phone || lead.company_phone;
    if (phoneNumber) {
      startOutgoingCall(phoneNumber, lead.lead_id);
      onOpenChange(false);
    }
  };

  const getLeadStatus = (lead: Lead) => {
    const phoneNumber = lead.phone || lead.company_phone;
    if (!phoneNumber) {
      return <Badge variant="destructive">No Number</Badge>;
    }

    if (activeCall?.to === phoneNumber) {
      return <Badge className="bg-green-500">In Call</Badge>;
    }

    const hasBeenContacted = allCallHistory.some(
      (call) => (call.to === phoneNumber || call.from === phoneNumber) && call.status === 'completed'
    );
    if (hasBeenContacted) {
      return <Badge variant="secondary">Contacted</Badge>;
    }
    
    // Check for a recent non-completed call to avoid re-calling too soon
    const recentlyAttempted = allCallHistory.some(
        (call) => (call.to === phoneNumber || call.from === phoneNumber) && (Date.now() - call.startTime < 3600 * 1000)
    );

    if (recentlyAttempted) {
        return <Badge variant="outline">Recently Attempted</Badge>
    }

    return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Available</Badge>;
  };
  
  const isCallable = (lead: Lead) => {
    const phoneNumber = lead.phone || lead.company_phone;
    if (!phoneNumber || activeCall) return false;
    
    const hasBeenContacted = allCallHistory.some(call => (call.to === phoneNumber || call.from === phoneNumber) && call.status === 'completed');
    return !hasBeenContacted;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Available Leads</DialogTitle>
          <DialogDescription>
            Select a lead from the list to initiate a call.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 relative">
            <ScrollArea className="absolute inset-0">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {leads.length > 0 ? (
                    leads.map((lead) => (
                    <TableRow key={lead.lead_id}>
                        <TableCell>
                            <div className="font-medium">{lead.company}</div>
                            <div className="text-sm text-muted-foreground">{lead.industry}</div>
                        </TableCell>
                        <TableCell>{lead.owner_first_name} {lead.owner_last_name}</TableCell>
                        <TableCell>{lead.phone || lead.company_phone}</TableCell>
                        <TableCell>
                            {getLeadStatus(lead)}
                        </TableCell>
                        <TableCell className="text-right">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCall(lead)}
                            disabled={!isCallable(lead)}
                        >
                            <Phone className="mr-2 h-4 w-4" />
                            Call
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No leads found.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
