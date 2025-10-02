'use client';

import {
  Dialpad,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Mic,
  MicOff,
  Voicemail,
  Clock,
  CircleDotDashed,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCall } from '@/contexts/call-context';
import { cn, formatDuration } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Badge } from './ui/badge';
import { AnimatePresence, motion } from 'framer-motion';

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

const DialpadView = ({ onCall }: { onCall: (number: string) => void }) => {
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
      <Button
        size="lg"
        className="w-full bg-green-500 hover:bg-green-600 rounded-full h-14"
        onClick={handleCall}
        disabled={!number}
      >
        <Phone className="mr-2 h-5 w-5" /> Call
      </Button>
    </div>
  );
};

const ActiveCallView = () => {
  const { state, dispatch } = useCall();
  const { activeCall } = state;
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (activeCall?.status === 'in-progress') {
      const interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - activeCall.startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeCall]);

  if (!activeCall) return null;

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
    <div className="flex flex-col items-center justify-between p-4 h-full">
      <div className="text-center mt-8">
        <p className="text-2xl font-semibold">{activeCall.direction === 'outgoing' ? activeCall.to : activeCall.from}</p>
        <div className={cn("flex items-center justify-center gap-2 mt-2 font-mono", statusInfo.color)}>
          {statusInfo.icon}
          <span>{statusInfo.text}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 my-8">
        <Button variant="outline" className="h-16 w-16 rounded-full flex-col" onClick={() => setIsMuted(!isMuted)}>
          {isMuted ? <MicOff /> : <Mic />}
          <span className="text-xs mt-1">Mute</span>
        </Button>
        <Button variant="outline" className="h-16 w-16 rounded-full flex-col">
          <Dialpad />
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
  const { activeCall, softphoneOpen } = state;

  const handleCall = (number: string) => {
    dispatch({ type: 'START_OUTGOING_CALL', payload: { to: number } });
  };
  
  const handleToggle = (open: boolean) => {
    if(softphoneOpen !== open) {
      dispatch({ type: 'TOGGLE_SOFTPHONE' });
    }
  }

  const getTriggerIcon = () => {
    if (activeCall?.status === 'ringing-incoming') return <PhoneIncoming className="h-6 w-6" />;
    if (activeCall) return <Phone className="h-6 w-6" />;
    return <Dialpad className="h-6 w-6" />;
  };

  const isRinging = activeCall?.status === 'ringing-outgoing' || activeCall?.status === 'ringing-incoming';

  return (
    <Popover open={softphoneOpen} onOpenChange={handleToggle}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            'fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-50 transition-colors duration-300',
            activeCall ? 'bg-green-500 hover:bg-green-600' : 'bg-primary hover:bg-primary/90',
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
                  <motion.div
                    key="dialpad"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DialpadView onCall={handleCall} />
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
      </PopoverContent>
    </Popover>
  );
}
