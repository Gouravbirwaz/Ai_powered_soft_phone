
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
import { Mail, Phone, Voicemail, RefreshCw } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

const LEADS_PER_PAGE = 5;

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
  const { startOutgoingCall, state, openVoicemailDialogForLead } = useCall();
  const [currentPage, setCurrentPage] = useState(1);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const { toast } = useToast();

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);
  
  useEffect(() => {
    if(open) {
      setCurrentPage(1);
    }
  }, [open, leads]);

  const totalPages = Math.ceil(leads.length / LEADS_PER_PAGE);

  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
    const endIndex = startIndex + LEADS_PER_PAGE;
    return leads.slice(startIndex, endIndex);
  }, [leads, currentPage]);

  const handleCall = (lead: Lead) => {
    const phoneNumber = lead.companyPhone;
    
    if (phoneNumber && /^\+?\d+$/.test(phoneNumber.replace(/[\s()-]/g, ''))) {
      startOutgoingCall(phoneNumber, lead.lead_id);
      onOpenChange(false);
    } else {
        toast({ 
            title: "Invalid or Missing Phone Number", 
            description: "A valid 'companyPhone' is required to make a call.", 
            variant: "destructive" 
        });
    }
  };

  const handleVoicemail = (lead: Lead) => {
    if (openVoicemailDialogForLead) {
      openVoicemailDialogForLead(lead);
      onOpenChange(false);
    }
  };

  const handleRefresh = () => {
    onRefreshLeads();
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
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.length > 0 ? (
                paginatedLeads.map((lead) => (
                  <TableRow key={lead.lead_id} className="h-16">
                    <TableCell>
                      <div className="font-medium">{lead.company}</div>
                      <div className="text-sm text-muted-foreground">{lead.website}</div>
                    </TableCell>
                    <TableCell>{lead.companyPhone}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCall(lead)}
                          disabled={!!state.activeCall || !lead.companyPhone}
                          className="whitespace-nowrap"
                        >
                          <Phone className="mr-2 h-4 w-4" />
                          Call
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVoicemail(lead)}
                           disabled={!!state.activeCall || !lead.companyPhone}
                          className="whitespace-nowrap"
                        >
                          <Voicemail className="mr-2 h-4 w-4" />
                          Voicemail
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
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
