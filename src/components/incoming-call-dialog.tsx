'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useCall } from '@/contexts/call-context';
import type { Call } from '@/lib/types';
import { Phone, PhoneIncoming, PhoneOff } from 'lucide-react';
import React from 'react';

export default function IncomingCallDialog({ call }: { call: Call }) {
  const { acceptIncomingCall, rejectIncomingCall } = useCall();

  return (
    <AlertDialog open={true} onOpenChange={(open) => !open && rejectIncomingCall()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center justify-center text-center gap-2 text-xl">
            <PhoneIncoming className="h-6 w-6 animate-pulse" />
            Incoming Call
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-lg pt-4">
            {call.from}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center gap-4 pt-4">
          <Button
            variant="destructive"
            onClick={rejectIncomingCall}
            className="w-full sm:w-auto"
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            onClick={acceptIncomingCall}
            className="w-full sm:w-auto bg-green-500 hover:bg-green-600"
          >
            <Phone className="mr-2 h-4 w-4" />
            Accept
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
