
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (credentials: { email: string; password?: string }) => Promise<any>;
}

export default function CredentialsDialog({
  open,
  onClose,
  onConfirm,
}: CredentialsDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!email || !password) {
      toast({
        title: 'Missing Fields',
        description: 'Please enter both email and password.',
        variant: 'destructive',
      });
      return;
    }

    setIsConfirming(true);
    await onConfirm({ email, password });
    setIsConfirming(false);
    // The dialog will be closed by the context on successful confirmation
  };

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen && !isConfirming) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sassquatch Authentication</DialogTitle>
          <DialogDescription>
            Please enter your credentials to fetch favorite lead drafts.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="col-span-3"
              placeholder="you@example.com"
              disabled={isConfirming}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" name="password" className="text-right">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="col-span-3"
              disabled={isConfirming}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirming}>
            {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm & Fetch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    