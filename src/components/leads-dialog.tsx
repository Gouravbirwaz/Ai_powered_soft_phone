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
import { Check, Mail, Phone, Voicemail, RefreshCw } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { formatRelative } from 'date-fns';
import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

const LEADS_PER_PAGE = 5;

type ActionStatus = 'idle' | 'success';

export default function LeadsDialog({
  open,
  onOpenChange,
  leads: initialLeads,
  onRefreshLeads,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  onRefreshLeads: () => void;
}) {
  const { startOutgoingCall, state, openVoicemailDialogForLead, sendMissedCallEmail } = useCall();
  const { allCallHistory, activeCall } = state;
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [actionFeedback, setActionFeedback] = useState<Record<string, { email?: ActionStatus, voicemail?: ActionStatus }>>({});
  const [leads, setLeads] = useState<Lead[]>(initialLeads);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    const handleLeadsUpdated = (event: Event) => {
        const customEvent = event as CustomEvent;
        const newLeads = customEvent.detail;

        const shuffleArray = (array: any[]) => {
            let currentIndex = array.length, randomIndex;
            while (currentIndex !== 0) {
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;
                [array[currentIndex], array[randomIndex]] = [
                    array[randomIndex], array[currentIndex]];
            }
            return array;
        }

        setLeads(shuffleArray(newLeads));
        onOpenChange(true); // Re-open the dialog
    };

    window.addEventListener('leadsUpdated', handleLeadsUpdated);

    // Update current time every minute to keep relative times fresh
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);

    return () => {
        window.removeEventListener('leadsUpdated', handleLeadsUpdated);
        clearInterval(timer);
    };
  }, [onOpenChange]);

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
    const phoneNumber = lead.companyPhone;
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
    // This is a placeholder since the flat CSV structure doesn't have owner email.
    // If you add email to your CSV, update the Lead type and this handler.
  };
  
  const handleRefresh = () => {
    onOpenChange(false);
    onRefreshLeads();
  }

  const getLeadStatus = (lead: Lead) => {
    const phoneNumber = lead.companyPhone;
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
    const phoneNumber = lead.companyPhone;
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
                      <div>{lead.website}</div>
                      <div className="text-sm text-muted-foreground">{lead.companyLinkedin}</div>
                    </TableCell>
                    <TableCell>{lead.companyPhone}</TableCell>
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
                          disabled={true}
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
        <DialogFooter className="pt-4 border-t flex justify-between w-full">
          <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Upload New CSV
            </Button>
          <div className="flex items-center justify-end space-x-2">
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
