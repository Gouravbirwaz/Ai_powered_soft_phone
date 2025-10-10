

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
import { useState, useEffect } from 'react';
import { Loader2, Voicemail as VoicemailIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_VOICEMAIL_SCRIPT = `Hello, this is Zackary Beckham from Caprae Capital Partners.
I’m reaching out because we’ve identified opportunities that may help your business grow through strategic funding and advisory support.
I’d be happy to share more details at your convenience.
You can reach me directly at 480-518-2592, or reply to this message, and we’ll schedule a quick call.
Once again, this is Zackary Beckham with Caprae Capital Partners. Thank you, and I look forward to connecting.`;

export default function VoicemailDialog() {
  const { sendVoicemail, state, dispatch } = useCall();
  const { toast } = useToast();
  const [script, setScript] = useState(DEFAULT_VOICEMAIL_SCRIPT);
  const [isSending, setIsSending] = useState(false);

  const { voicemailLeadTarget } = state;

  useEffect(() => {
    // Reset script if the target changes, including the lead's name.
    if (voicemailLeadTarget) {
      setScript(DEFAULT_VOICEMAIL_SCRIPT.replace('Hello,', `Hello ${voicemailLeadTarget?.company || ''},`));
    } else {
      setScript(DEFAULT_VOICEMAIL_SCRIPT);
    }
  }, [voicemailLeadTarget]);

  const handleClose = () => {
    if (dispatch) {
      dispatch({ type: 'CLOSE_VOICEMAIL_DIALOG' });
    }
  };

  const handleSend = async () => {
    if (!voicemailLeadTarget || !script) {
      toast({
        title: 'Error',
        description: 'Cannot send voicemail without a target lead and a script.',
        variant: 'destructive',
      });
      return;
    }
    setIsSending(true);
    const phoneNumber = voicemailLeadTarget.companyPhone;
    if (!phoneNumber) {
        toast({ title: 'No Phone Number', description: 'This lead does not have a phone number.', variant: 'destructive' });
        setIsSending(false);
        return;
    }

    // Pass the exact script from the textarea to the context function
    const success = await sendVoicemail(voicemailLeadTarget, script);
    if (success) {
      // Toast is handled in context
      handleClose();
    }
    // Error toast is handled inside the context's sendVoicemail function
    setIsSending(false);
  };

  if (!voicemailLeadTarget) return null;

  const phoneNumber = voicemailLeadTarget.companyPhone;
  const leadName = voicemailLeadTarget.company;

  return (
    <Dialog open={!!voicemailLeadTarget} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Voicemail</DialogTitle>
          <DialogDescription>
            Edit the script below and send it as a voicemail to {leadName} at {phoneNumber}. This action will be logged.
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
            onClick={handleClose}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !script || !phoneNumber}>
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <VoicemailIcon className="mr-2 h-4 w-4" />
            )}
            Send & Log Voicemail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
