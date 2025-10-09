
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { formatRelative } from 'date-fns';
import { useEffect, useState, useMemo } from 'react';

const LEADS_PER_PAGE = 10;

export default function LeadsDialog({
  open,
  onOpenChange,
  leads,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
}) {
  const { startOutgoingCall, state, openVoicemailDialogForLead, sendMissedCallEmail } = useCall();
  const { allCallHistory, activeCall } = state;
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // Update current time every minute to keep relative times fresh
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Reset to first page when dialog is opened or leads change
    setCurrentPage(1);
  }, [open, leads]);

  const totalPages = Math.ceil(leads.length / LEADS_PER_PAGE);

  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
    const endIndex = startIndex + LEADS_PER_PAGE;
    return leads.slice(startIndex, endIndex);
  }, [leads, currentPage]);

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
    if (sendMissedCallEmail) {
      sendMissedCallEmail(lead);
      // We no longer open the mailto link, just trigger the backend API
    }
  };

  const getLeadStatus = (lead: Lead) => {
    const phoneNumber = lead.phone || lead.company_phone;
    if (activeCall?.to === phoneNumber) {
      return <Badge className="bg-green-500">In Call</Badge>;
    }
    
    const leadInteractions = allCallHistory
        .filter(c => c.leadId === lead.lead_id || c.to === phoneNumber || c.from === phoneNumber)
        .sort((a,b) => (b.startTime || 0) - (a.startTime || 0));

    const lastInteraction = leadInteractions[0];
      
    if (lastInteraction) {
        return (
            <div>
                <Badge variant="secondary">Contacted</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                    {formatRelative(new Date(lastInteraction.startTime), currentTime)}
                </p>
            </div>
        );
    }

    return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Available</Badge>;
  };
  
  const isActionable = (lead: Lead) => {
    const phoneNumber = lead.phone || lead.company_phone;
    return !!phoneNumber && !activeCall;
  }

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
                {paginatedLeads.length > 0 ? (
                    paginatedLeads.map((lead) => (
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
                                disabled={!isActionable(lead)}
                            >
                                <Phone className="mr-2 h-4 w-4" />
                                Call
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVoicemail(lead)}
                                disabled={!isActionable(lead)}
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
        <DialogFooter>
          <div className="flex items-center justify-end space-x-2">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
