
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
import { Check, Mail, Phone, Voicemail } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { formatRelative } from 'date-fns';
import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

const LEADS_PER_PAGE = 5;

type ActionStatus = 'idle' | 'success';

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
  const [actionFeedback, setActionFeedback] = useState<Record<string, { email?: ActionStatus, voicemail?: ActionStatus }>>({});

  useEffect(() => {
    // Update current time every minute to keep relative times fresh
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Reset to first page when dialog is opened or leads change
    setCurrentPage(1);
    // Also reset action feedback
    setActionFeedback({});
  }, [open, leads]);

  const totalPages = Math.ceil(leads.length / LEADS_PER_PAGE);

  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
    const endIndex = startIndex + LEADS_PER_PAGE;
    return leads.slice(startIndex, endIndex);
  }, [leads, currentPage]);

  const showActionFeedback = (leadId: string, action: 'email' | 'voicemail') => {
      setActionFeedback(prev => ({
          ...prev,
          [leadId]: { ...prev[leadId], [action]: 'success' }
      }));
      setTimeout(() => {
          setActionFeedback(prev => ({
              ...prev,
              [leadId]: { ...prev[leadId], [action]: 'idle' }
          }));
      }, 3000); // Reset after 3 seconds
  }

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
      showActionFeedback(lead.lead_id, 'voicemail');
      onOpenChange(false);
    }
  };

  const handleEmail = async (lead: Lead) => {
    if (sendMissedCallEmail) {
      const success = await sendMissedCallEmail(lead);
      if (success) {
        showActionFeedback(lead.lead_id, 'email');
      }
    }
  };

  const getLeadStatus = (lead: Lead) => {
    const phoneNumber = lead.phone || lead.company_phone;
    if (activeCall?.to === phoneNumber) {
      return (
        <div className="flex flex-col items-start justify-center">
            <Badge className="bg-green-500">In Call</Badge>
        </div>
      )
    }
    
    const leadInteractions = allCallHistory
        .filter(c => c.leadId === lead.lead_id || c.to === phoneNumber || c.from === phoneNumber)
        .sort((a,b) => (b.startTime || 0) - (a.startTime || 0));

    const lastInteraction = leadInteractions[0];
      
    if (lastInteraction) {
        return (
            <div className="flex flex-col items-start justify-center">
                <Badge variant="secondary">Contacted</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                    {formatRelative(new Date(lastInteraction.startTime), currentTime)}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-start justify-center">
            <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Available</Badge>
            <p className="text-xs text-muted-foreground mt-1">&nbsp;</p>
        </div>
    );
  };
  
  const isActionable = (lead: Lead) => {
    const phoneNumber = lead.phone || lead.company_phone;
    return !!phoneNumber && !activeCall;
  }

  const ActionButton = ({ lead, action, icon: Icon, label, onClick, disabled }: { lead: Lead, action: 'email' | 'voicemail', icon: React.ElementType, label: string, onClick: () => void, disabled: boolean }) => {
    const feedback = actionFeedback[lead.lead_id]?.[action];
    
    return (
        <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            disabled={disabled || feedback === 'success'}
            className={cn("whitespace-nowrap", feedback === 'success' && 'bg-green-100 dark:bg-green-900 border-green-500')}
        >
            {feedback === 'success' ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Icon className="mr-2 h-4 w-4" />}
            {label}
        </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col pt-4">
        <DialogHeader>
          <DialogTitle>Available Leads</DialogTitle>
          <DialogDescription>
            Select a lead from the list to initiate an action.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
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
                  <TableRow key={lead.lead_id} className="h-16">
                    <TableCell>
                      <div className="font-medium">{lead.company}</div>
                      <div className="text-sm text-muted-foreground">
                        {lead.industry}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.owner_first_name} {lead.owner_last_name}
                    </TableCell>
                    <TableCell>{lead.phone || lead.company_phone}</TableCell>
                    <TableCell>{getLeadStatus(lead)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCall(lead)}
                          disabled={!isActionable(lead)}
                          className="whitespace-nowrap"
                        >
                          <Phone className="mr-2 h-4 w-4" />
                          Call
                        </Button>
                        <ActionButton
                          lead={lead}
                          action="voicemail"
                          icon={Voicemail}
                          label="Voicemail"
                          onClick={() => handleVoicemail(lead)}
                          disabled={!isActionable(lead)}
                        />
                        <ActionButton
                          lead={lead}
                          action="email"
                          icon={Mail}
                          label="Email"
                          onClick={() => handleEmail(lead)}
                          disabled={!lead.owner_email}
                        />
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
        </div>
        <DialogFooter className="pt-4 border-t">
          <div className="flex w-full items-center justify-end space-x-2">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages > 0 ? totalPages : 1}
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
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    