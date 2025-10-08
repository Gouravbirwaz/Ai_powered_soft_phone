
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
import { Mail, Phone, Voicemail } from 'lucide-react';
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
  const { startOutgoingCall, state, openVoicemailDialogForLead, logEmailInteraction } = useCall();
  const { allCallHistory, activeCall } = state;

  const handleCall = (lead: Lead) => {
    const phoneNumber = lead.phone || lead.company_phone;
    if (phoneNumber) {
      startOutgoingCall(phoneNumber, lead.lead_id);
      onOpenChange(false);
    }
  };

  const handleVoicemail = (lead: Lead) => {
    if (openVoicemailDialogForLead) {
      openVoicemailDialogForLead(lead);
      onOpenChange(false);
    }
  };

  const handleEmail = (lead: Lead) => {
    if (logEmailInteraction && lead.owner_email) {
      logEmailInteraction(lead);
      window.location.href = `mailto:${lead.owner_email}`;
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
      c => c.leadId === lead.lead_id || c.to === phoneNumber || c.from === phoneNumber
    );
      
    if (hasBeenContacted) {
        return <Badge variant="secondary">Contacted</Badge>;
    }

    return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Available</Badge>;
  };
  
  const isCallable = (lead: Lead) => {
    const phoneNumber = lead.phone || lead.company_phone;
    return !!phoneNumber && !activeCall;
  }

  const hasPhoneNumber = (lead: Lead) => !!(lead.phone || lead.company_phone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Available Leads</DialogTitle>
          <DialogDescription>
            Select a lead from the list to initiate an action.
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
                    <TableHead className="text-right">Actions</TableHead>
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
                          <div className='flex gap-2 justify-end'>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCall(lead)}
                                disabled={!isCallable(lead)}
                            >
                                <Phone className="mr-2 h-4 w-4" />
                                Call
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVoicemail(lead)}
                                disabled={!hasPhoneNumber(lead)}
                            >
                                <Voicemail className="mr-2 h-4 w-4" />
                                Voicemail
                            </Button>
                             <Button
                                variant="outline"
                                size="sm"
                                disabled={!lead.owner_email}
                                onClick={() => handleEmail(lead)}
                            >
                                <Mail className="mr-2 h-4 w-4" />
                                Email
                            </Button>
                          </div>
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
