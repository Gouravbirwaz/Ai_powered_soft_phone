'use client';

import {
  Grid3x3,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Mic,
  MicOff,
  Voicemail,
  Clock,
  CircleDotDashed,
  Move,
  List,
  AlertCircle,
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
import { Call as TwilioCall, Device } from '@twilio/voice-sdk';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

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


const ChoiceView = ({ onDial, onFetchLead }: { onDial: () => void; onFetchLead: () => void }) => {
    const { state, fetchLeads, dispatch } = useCall();
    const { toast } = useToast();
    
    const handleFetchAndCall = async () => {
        if (state.activeCall) {
            toast({ title: 'Already in a call', variant: 'destructive' });
            return;
        }
        const leads = await fetchLeads();
        if(leads && leads.length > 0) {
            const lead = leads[0];
            const phoneNumber = lead.phone || lead.company_phone;
            if (phoneNumber) {
                dispatch({ type: 'START_OUTGOING_CALL', payload: { to: phoneNumber } });
            } else {
                toast({ title: 'No phone number for lead', variant: 'destructive' });
            }
        } else {
            toast({ title: 'No leads available', variant: 'destructive' });
        }
    }


  return (
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
                          <Button variant="secondary" onClick={handleFetchAndCall}>
                              <List className="mr-2" />
                              Fetch Next Lead
                          </Button>
                      </div>
                  </div>
              </CardContent>
          </Card>
      </div>
  );
};


const DialerContainer = ({ onCall }: { onCall: (number: string) => void }) => {
  const [view, setView] = useState<'choice' | 'dialpad'>('choice');
  const { state } = useCall();

  if (!state.twilioDevice && !state.audioPermissionsGranted) {
    return (
        <div className="p-4">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Microphone Access Required</AlertTitle>
                <AlertDescription>
                    Please grant microphone permissions to enable the softphone. You may need to refresh and try again.
                </AlertDescription>
            </Alert>
        </div>
    )
  }
  
  if (!state.twilioDevice && state.audioPermissionsGranted) {
      return (
          <div className="p-4">
              <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Softphone Initializing...</AlertTitle>
                  <AlertDescription>
                      The softphone is getting ready. Please wait a moment.
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
          <ChoiceView onDial={() => setView('dialpad')} onFetchLead={() => {}} />
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
  const { state, dispatch } = useCall();
  const { activeCall } = state;
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeCall?.status === 'in-progress' && activeCall.startTime) {
      interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - activeCall.startTime) / 1000));
      }, 1000);
    }
    return () => {
        if(interval) clearInterval(interval);
    };
  }, [activeCall]);

  if (!activeCall) return null;
  
  const twilioCall = activeCall.twilioInstance;
  const isMuted = twilioCall?.isMuted();

  const handleMute = () => {
    if (twilioCall) {
        twilioCall.mute(!isMuted);
    }
  }

  const getStatusInfo = () => {
    switch(activeCall.status) {
      case 'ringing-outgoing':
        return { text: 'Ringing...', icon: <CircleDotDashed className="animate-spin h-4 w-4 text-muted-foreground" />, color: 'text-muted-foreground' };
      case 'in-progress':
        return { text: formatDuration(duration), icon: <Clock className="h-4 w-4 text-green-500" />, color: 'text-green-500' };
      default:
        return { text: 'Connecting...', icon: <CircleDotDashed className="animate-spin h-4 w-4 text-muted-foreground" />, color: 'text-muted-foreground' };
    }
  };

  const statusInfo = getStatusInfo();
  
  return (
    <div className="flex flex-col items-center justify-between p-4 h-full min-h-[500px]">
      <div className="text-center mt-8">
        <p className="text-2xl font-semibold">{activeCall.direction === 'outgoing' ? activeCall.to : activeCall.from}</p>
        <div className={cn("flex items-center justify-center gap-2 mt-2 font-mono", statusInfo.color)}>
          {statusInfo.icon}
          <span>{statusInfo.text}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 my-8">
        <Button variant="outline" className="h-16 w-16 rounded-full flex-col" onClick={handleMute}>
          {isMuted ? <MicOff /> : <Mic />}
          <span className="text-xs mt-1">Mute</span>
        </Button>
        <Button variant="outline" className="h-16 w-16 rounded-full flex-col">
          <Grid3x3 />
          <span className="text-xs mt-1">Keypad</span>
        </Button>
        <Button variant="outline" className="h-16 w-16 rounded-full flex-col">
          <Voicemail />
          <span className="text-xs mt-1">Voicemail</span>
        </Button>
      </div>

      <Button
        size="lg"
        variant="destructive"
        className="w-full rounded-full h-14"
        onClick={() => dispatch({ type: 'END_CALL' })}
      >
        <PhoneOff className="mr-2 h-5 w-5" /> End Call
      </Button>
    </div>
  );
};


export default function Softphone() {
  const { state, dispatch } = useCall();
  const { toast } = useToast();
  const { activeCall, softphoneOpen, audioPermissionsGranted } = state;
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);
  
  // Local state to track if we've attempted to get permissions
  const [permissionRequested, setPermissionRequested] = useState(false);

  const handleCall = (number: string) => {
    dispatch({ type: 'START_OUTGOING_CALL', payload: { to: number } });
  };
  
  const handleToggle = async (open: boolean) => {
    // Only request permissions if opening and haven't requested yet.
    if (open && !audioPermissionsGranted && !permissionRequested) {
        setPermissionRequested(true);
        try {
            // This is the simplest way to request audio permissions and initialize
            // the audio context, which is required by browsers.
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            dispatch({ type: 'SET_AUDIO_PERMISSIONS', payload: { granted: true }});
            toast({ title: 'Microphone Enabled', description: 'Audio permissions have been granted.' });
        } catch (err) {
            console.error('Error getting audio permissions:', err);
            toast({
                variant: 'destructive',
                title: 'Permission Denied',
                description: 'Microphone access is required. Please enable it in your browser settings and refresh the page.'
            });
            dispatch({ type: 'SET_AUDIO_PERMISSIONS', payload: { granted: false }});
            // Don't open the softphone if permissions are denied, but allow re-trying
            setPermissionRequested(false); 
            return;
        }
    }
    
    if(softphoneOpen !== open) {
      dispatch({ type: 'TOGGLE_SOFTPHONE' });
    }
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
