
'use client';

import {
  Grid3x3,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  CircleDotDashed,
  Move,
  Upload,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCall } from '@/contexts/call-context';
import { cn, formatDuration } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import type { CallStatus, Lead } from '@/lib/types';
import LeadsDialog from './leads-dialog';


const DialpadButton = ({
  digit,
  letters,
  onPress,
}: {
  digit: string;
  letters: string;
  onPress: (digit: string) => void;
}) => (
  <Button
    variant="ghost"
    className="h-16 w-16 rounded-full text-2xl flex flex-col items-center justify-center"
    onClick={() => onPress(digit)}
  >
    <span>{digit}</span>
    <span className="text-xs font-normal tracking-widest">{letters}</span>
  </Button>
);

const DialpadView = ({ onCall, onBack }: { onCall: (number: string) => void; onBack: () => void }) => {
  const [number, setNumber] = useState('');

  const handleKeyPress = (digit: string) => {
    setNumber(number + digit);
  };
  
  const handleCall = () => {
    if (number) {
      onCall(number);
      setNumber('');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <Input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="(555) 123-4567"
        className="text-center text-lg h-12"
      />
      <div className="grid grid-cols-3 gap-2">
        <DialpadButton digit="1" letters="" onPress={handleKeyPress} />
        <DialpadButton digit="2" letters="ABC" onPress={handleKeyPress} />
        <DialpadButton digit="3" letters="DEF" onPress={handleKeyPress} />
        <DialpadButton digit="4" letters="GHI" onPress={handleKeyPress} />
        <DialpadButton digit="5" letters="JKL" onPress={handleKeyPress} />
        <DialpadButton digit="6" letters="MNO" onPress={handleKeyPress} />
        <DialpadButton digit="7" letters="PQRS" onPress={handleKeyPress} />
        <DialpadButton digit="8" letters="TUV" onPress={handleKeyPress} />
        <DialpadButton digit="9" letters="WXYZ" onPress={handleKeyPress} />
        <DialpadButton digit="*" letters="" onPress={handleKeyPress} />
        <DialpadButton digit="0" letters="+" onPress={handleKeyPress} />
        <DialpadButton digit="#" letters="" onPress={handleKeyPress} />
      </div>
      <div className="flex w-full gap-2">
         <Button
            size="lg"
            variant="secondary"
            className="flex-1 rounded-full h-14"
            onClick={onBack}
          >
            Back
          </Button>
        <Button
          size="lg"
          className="flex-1 bg-green-500 hover:bg-green-600 rounded-full h-14"
          onClick={handleCall}
          disabled={!number}
        >
          <Phone className="mr-2 h-5 w-5" /> Call
        </Button>
      </div>
    </div>
  );
};


const ChoiceView = ({ onDial }: { onDial: () => void; }) => {
    const { state } = useCall();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [showLeadsDialog, setShowLeadsDialog] = useState(false);
    const [fetchedLeads, setFetchedLeads] = useState<Lead[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseCSV = (text: string): Lead[] => {
      const rows = text.split('\n').filter(row => row.trim() !== '');
      if (rows.length < 2) return [];

      const headers = rows[0].split(',').map(h => h.trim());
      const leadData = rows.slice(1).map(row => {
        const values = row.split(',').map(v => v.trim());
        const leadObject: { [key: string]: any } = {};
        headers.forEach((header, index) => {
          leadObject[header] = values[index];
        });
        return leadObject as Lead;
      });
      return leadData;
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          try {
            const parsedLeads = parseCSV(text);
            localStorage.setItem('uploadedLeads', JSON.stringify(parsedLeads));
            setFetchedLeads(parsedLeads);
            setShowLeadsDialog(true);
            toast({ title: 'Leads Uploaded', description: `${parsedLeads.length} leads have been successfully loaded.` });
          } catch (error) {
            toast({ title: 'Upload Failed', description: 'Could not parse the CSV file.', variant: 'destructive' });
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsText(file);
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    
    // Fisher-Yates shuffle algorithm
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

    const handleUploadLeads = () => {
        if (state.activeCall) {
            toast({ title: 'Finish current call first', variant: 'destructive' });
            return;
        }

        const storedLeads = localStorage.getItem('uploadedLeads');
        if (storedLeads) {
            try {
                const leads = JSON.parse(storedLeads);
                setFetchedLeads(shuffleArray(leads));
                setShowLeadsDialog(true);
            } catch {
                localStorage.removeItem('uploadedLeads');
                fileInputRef.current?.click();
            }
        } else {
            fileInputRef.current?.click();
        }
    }


  return (
      <>
      <div className="p-4">
          <Card>
              <CardContent className="p-4">
                  <div className="flex flex-col items-center justify-center gap-4">
                      <p className="text-center sm:text-left text-muted-foreground">
                          Start a new call:
                      </p>
                      <div className="flex flex-col gap-2 w-full">
                          <Button onClick={onDial}>
                              <Phone className="mr-2" />
                              Dial Number
                          </Button>
                          <Button variant="secondary" onClick={handleUploadLeads} disabled={isProcessing || !!state.activeCall}>
                              {isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Upload className="mr-2" />}
                              Upload Leads
                          </Button>
                      </div>
                  </div>
              </CardContent>
          </Card>
      </div>
       <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".csv"
      />
      <LeadsDialog 
        open={showLeadsDialog}
        onOpenChange={setShowLeadsDialog}
        leads={fetchedLeads}
      />
      </>
  );
};


const DialerContainer = ({ onCall }: { onCall: (number: string) => void }) => {
  const [view, setView] = useState<'choice' | 'dialpad'>('choice');
  const { state } = useCall();

  if (state.twilioDeviceStatus === 'error') {
      return (
          <div className="p-4">
              <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Initialization Failed</AlertTitle>
                  <AlertDescription>
                    Could not connect to the calling service. Please try reloading the page.
                  </AlertDescription>
              </Alert>
          </div>
      )
  }

  return (
    <AnimatePresence mode="wait">
      {view === 'choice' ? (
        <motion.div
          key="choice"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.2 }}
        >
          <ChoiceView onDial={() => setView('dialpad')} />
        </motion.div>
      ) : (
        <motion.div
          key="dialpad"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.2 }}
        >
          <DialpadView onCall={onCall} onBack={() => setView('choice')} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};


const ActiveCallView = () => {
  const { state, endActiveCall, getActiveTwilioCall, closeSoftphone } = useCall();
  const { activeCall } = state;
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const twilioCall = getActiveTwilioCall();

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeCall?.status === 'in-progress' && activeCall.startTime) {
      setDuration(Math.floor((Date.now() - activeCall.startTime) / 1000));
      interval = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => {
        if(interval) clearInterval(interval);
    };
  }, [activeCall?.status, activeCall?.startTime]);
  
  useEffect(() => {
    const currentTwilioCall = getActiveTwilioCall();
    if (currentTwilioCall) {
        const handleMute = (muted: boolean) => setIsMuted(muted);
        currentTwilioCall.on('mute', handleMute);
        setIsMuted(currentTwilioCall.isMuted());
        return () => {
            currentTwilioCall.off('mute', handleMute);
        }
    }
  }, [getActiveTwilioCall, activeCall]);


  if (!activeCall) return null;
  
  const isConnecting = ['ringing-outgoing', 'queued', 'ringing-incoming'].includes(activeCall.status);
  const isCallActive = activeCall.status === 'in-progress';
  const isFetchingTranscript = activeCall.status === 'fetching-transcript';

  const handleHangup = () => {
    endActiveCall('canceled');
  };

  const handleMute = () => {
    const currentTwilioCall = getActiveTwilioCall();
    if (currentTwilioCall) {
      currentTwilioCall.mute(!isMuted);
    }
  }

  const statusTextMap: { [key in CallStatus]?: string } = {
    'ringing-outgoing': 'Ringing...',
    'in-progress': formatDuration(duration),
    'queued': 'Connecting...',
    'ringing-incoming': 'Ringing...',
    'completed': 'Call Ended',
    'busy': 'Busy',
    'failed': 'Call Failed',
    'canceled': 'Canceled',
    'voicemail-dropped': 'Voicemail Sent',
    'fetching-transcript': 'Getting transcript...',
  }

  const getStatusInfo = () => {
    const status = activeCall.status;
    const text = statusTextMap[status] || 'Connecting...';

    switch(status) {
      case 'ringing-outgoing':
      case 'queued':
      case 'ringing-incoming':
        return { text, icon: <CircleDotDashed className="animate-spin h-4 w-4 text-muted-foreground" />, color: 'text-muted-foreground' };
      case 'in-progress':
        return { text, icon: <Clock className="h-4 w-4 text-green-500" />, color: 'text-green-500' };
      case 'fetching-transcript':
        return { text, icon: <Loader2 className="animate-spin h-4 w-4 text-blue-500" />, color: 'text-blue-500' };
      case 'failed':
      case 'busy':
      case 'canceled':
        return { text, icon: <AlertCircle className="h-4 w-4 text-destructive" />, color: 'text-destructive' };
      case 'voicemail-dropped':
        return { text: 'Voicemail Sent', icon: <PhoneOff className="h-4 w-4 text-muted-foreground" />, color: 'text-muted-foreground' };
      default:
        return { text: 'Call Ended', icon: <PhoneOff className="h-4 w-4 text-muted-foreground" />, color: 'text-muted-foreground' };
    }
  };

  const statusInfo = getStatusInfo();
  
  return (
    <>
      <div className="flex flex-col items-center justify-between p-4 h-full min-h-[400px]">
        <div className="text-center mt-8">
          <p className="text-2xl font-semibold">{activeCall.direction === 'outgoing' ? activeCall.to : activeCall.from}</p>
          <div className={cn("flex items-center justify-center gap-2 mt-2 font-mono", statusInfo.color)}>
            {statusInfo.icon}
            <span>{statusInfo.text}</span>
          </div>
        </div>
        
        {!isFetchingTranscript ? (
            <>
                <div className="grid grid-cols-2 gap-4 my-8">
                    <Button variant="outline" className="h-16 w-16 rounded-full flex-col" onClick={handleMute} disabled={!isCallActive}>
                        {isMuted ? <MicOff /> : <Mic />}
                        <span className="text-xs mt-1">Mute</span>
                    </Button>
                    <Button variant="outline" className="h-16 w-16 rounded-full flex-col" disabled>
                        <Grid3x3 />
                        <span className="text-xs mt-1">Keypad</span>
                    </Button>
                </div>

                <Button
                size="lg"
                variant={(isConnecting || isCallActive) ? 'destructive' : 'secondary'}
                className="w-full rounded-full h-14"
                onClick={handleHangup}
                >
                {(isConnecting || isCallActive) ? <PhoneOff className="mr-2 h-5 w-5" /> : <X className="mr-2 h-5 w-5" />}
                {(isConnecting || isCallActive) ? 'End Call' : 'Close'}
                </Button>
            </>
        ) : (
            <div className='flex-1 flex items-center justify-center'>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )}

      </div>
    </>
  );
};


export default function Softphone() {
  const { state, dispatch, startOutgoingCall, initializeTwilio } = useCall();
  const { toast } = useToast();
  const { activeCall, softphoneOpen, audioPermissionsGranted, twilioDeviceStatus } = state;
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);
  
  const handleCall = (number: string) => {
    startOutgoingCall(number);
  };
  
  const handleToggle = async (open: boolean) => {
    if (open && twilioDeviceStatus === 'uninitialized') {
        // If we are opening and the device is not set up, try to init.
        // In the disabled state, this will just show a toast.
        initializeTwilio();
    }
    
    dispatch({ type: 'TOGGLE_SOFTPHONE' });
  }

  const getTriggerIcon = () => {
    if (activeCall?.status === 'ringing-incoming') return <PhoneIncoming className="h-6 w-6" />;
    if (activeCall) return <Phone className="h-6 w-6" />;
    return <Phone className="h-6 w-6" />;
  };
  
  const isRinging = activeCall?.status === 'ringing-outgoing' || activeCall?.status === 'ringing-incoming';

  return (
    <div ref={constraintsRef} className="fixed inset-0 pointer-events-none">
      <motion.div
        drag
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragListener={false}
        className="absolute bottom-6 right-6 z-50 pointer-events-auto"
      >
        <Popover open={softphoneOpen} onOpenChange={handleToggle}>
          <PopoverTrigger asChild>
            <Button
              className={cn(
                'h-16 w-16 rounded-full shadow-lg transition-colors duration-300',
                activeCall ? 'bg-green-500 hover:bg-green-600' : 'bg-primary text-primary-foreground hover:bg-primary/90',
                isRinging && 'animate-pulse'
              )}
              size="icon"
            >
              {getTriggerIcon()}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className="w-80 rounded-2xl shadow-2xl p-0 border-0 mb-2"
            sideOffset={16}
          >
              <Card className="border-0 shadow-none">
                <div
                  onPointerDown={(e) => dragControls.start(e)}
                  className="absolute top-2 right-2 cursor-grab active:cursor-grabbing p-2 text-muted-foreground"
                >
                  <Move className="h-4 w-4" />
                </div>
                <CardContent className="p-0">
                  <AnimatePresence mode="wait">
                    {activeCall ? (
                      <motion.div
                        key="active-call"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ActiveCallView />
                      </motion.div>
                    ) : (
                       <DialerContainer onCall={handleCall} />
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
          </PopoverContent>
        </Popover>
      </motion.div>
    </div>
  );
}

    