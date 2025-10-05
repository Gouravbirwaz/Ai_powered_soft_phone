
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from './ui/button';
import { ArrowDown, ArrowUp, Edit, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { useCall } from '@/contexts/call-context';
import type { Call, CallDirection, CallStatus } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { format, formatRelative, isValid } from 'date-fns';

const StatusBadge = ({ status }: { status: CallStatus }) => {
  const variant: { [key in CallStatus]?: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    completed: 'default',
    'in-progress': 'default',
    'voicemail-dropped': 'outline',
    busy: 'secondary',
    failed: 'destructive',
    canceled: 'destructive',
  };

  const text: { [key in CallStatus]?: string } = {
    'ringing-outgoing': 'Ringing',
    'ringing-incoming': 'Ringing',
    'in-progress': 'In Progress',
    'voicemail-dropping': 'Voicemail Left',
    'voicemail-dropped': 'Voicemail Left',
  }

  return (
    <Badge variant={variant[status] || 'secondary'} className="capitalize">
      {text[status] || status}
    </Badge>
  );
};

export default function CallHistoryTable() {
  const { state, dispatch, fetchCallHistory } = useCall();
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState<CallDirection | 'all'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Call, direction: 'asc' | 'desc' } | null>({ key: 'startTime', direction: 'desc' });

  useEffect(() => {
    if (state.currentAgent) {
      fetchCallHistory();
    }
  }, [state.currentAgent, fetchCallHistory]);


  const handleSort = (key: keyof Call) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handleEditNotes = (callId: string) => {
    dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId } });
  }

  const filteredAndSortedCalls = useMemo(() => {
    if (!state.currentAgent) return [];
    
    let filtered = state.callHistory.filter(call => call.agentId === state.currentAgent?.id);

    if (statusFilter !== 'all') {
      filtered = filtered.filter((call) => call.status === statusFilter);
    }
    if (directionFilter !== 'all') {
      filtered = filtered.filter((call) => call.direction === directionFilter);
    }
    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key] || 0;
        const valB = b[sortConfig.key] || 0;
        if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [state.callHistory, state.currentAgent, statusFilter, directionFilter, sortConfig]);

  const allStatuses = useMemo(() => {
    if (!state.currentAgent) return ['all'];
    const agentCalls = state.callHistory.filter(call => call.agentId === state.currentAgent?.id);
    return ['all', ...Array.from(new Set(agentCalls.map(c => c.status)))];
  }, [state.callHistory, state.currentAgent]);


  const SortableHeader = ({ tkey, label }: { tkey: keyof Call; label: string }) => (
    <TableHead onClick={() => handleSort(tkey)} className="cursor-pointer">
      <div className="flex items-center gap-2">
        {label}
        {sortConfig?.key === tkey && (sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {allStatuses.map((status, index) => (
              <SelectItem key={`${status}-${index}`} value={status} className="capitalize">{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v as CallDirection | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="incoming">Incoming</SelectItem>
            <SelectItem value="outgoing">Outgoing</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Type</TableHead>
              <TableHead>Contact</TableHead>
              <SortableHeader tkey="status" label="Status" />
              <SortableHeader tkey="duration" label="Duration" />
              <SortableHeader tkey="startTime" label="Timestamp" />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCalls.length > 0 ? (
              filteredAndSortedCalls.map((call) => {
                const callDate = call.startTime ? new Date(call.startTime) : null;
                const isDateValid = callDate && isValid(callDate);
                const contactNumber = call.direction === 'incoming' ? call.from : call.to;

                return (
                  <TableRow key={call.id}>
                    <TableCell>
                      {call.direction === 'incoming' ? (
                        <PhoneIncoming className="h-5 w-5 text-blue-500" />
                      ) : (
                        <PhoneOutgoing className="h-5 w-5 text-green-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={call.avatarUrl} alt="Contact" data-ai-hint="person face" />
                          <AvatarFallback>{contactNumber?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{contactNumber}</div>
                          {call.notes && <p className="text-sm text-muted-foreground truncate max-w-xs">{call.notes}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={call.status} />
                    </TableCell>
                    <TableCell>{formatDuration(call.duration || 0)}</TableCell>
                    <TableCell>
                      {isDateValid ? (
                        <div className="flex flex-col">
                          <span className='font-medium'>{formatRelative(callDate, new Date())}</span>
                          <span className='text-sm text-muted-foreground'>{format(callDate, 'p')}</span>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Invalid date</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditNotes(call.id)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit Notes</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow key="no-calls-row">
                <TableCell colSpan={6} className="h-24 text-center">
                  No calls found for this agent.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
