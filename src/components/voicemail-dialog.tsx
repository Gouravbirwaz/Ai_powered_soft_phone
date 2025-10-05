
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCall } from '@/contexts/call-context';
import type { Call } from '@/lib/types';
import { useState } from 'react';
import { Loader2, Voicemail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_VOICEMAIL_SCRIPT = `Hello, this is Zackary Beckham from Caprae Capital Partners.
I’m reaching out because we’ve identified opportunities that may help your business grow through strategic funding and advisory support.
I’d be happy to share more details at your convenience.
You can reach me directly at 480-518-2592, or reply to this message, and we’ll schedule a quick call.
Once again, this is Zackary Beckham with Caprae Capital Partners. Thank you, and I look forward to connecting.`;

export default function VoicemailDialog({
  open,
  onOpenChange,
  call,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  call: Call | null;
}) {
  const { sendVoicemail } = useCall();
  const { toast } = useToast();
  const [script, setScript] = useState(DEFAULT_VOICEMAIL_SCRIPT);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!call || !script) {
      toast({
        title: 'Error',
        description: 'Cannot send voicemail without a call and a script.',
        variant: 'destructive',
      });
      return;
    }
    setIsSending(true);
    const success = await sendVoicemail(call.to, script, call.id);
    if (success) {
      toast({
        title: 'Voicemail Sent',
        description: `Voicemail has been sent to ${call.to}.`,
      });
      onOpenChange(false);
    } else {
      toast({
        title: 'Failed to Send',
        description: 'The voicemail could not be sent. Please try again.',
        variant: 'destructive',
      });
    }
    setIsSending(false);
  };

  if (!call) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Voicemail</DialogTitle>
          <DialogDescription>
            Edit the script below and send it as a voicemail to {call.to}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="min-h-[200px]"
            placeholder="Enter your voicemail script..."
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !script}>
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Voicemail className="mr-2 h-4 w-4" />
            )}
            Send Voicemail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
