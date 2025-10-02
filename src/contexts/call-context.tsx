'use client';

import type { Call, CallDirection, CallStatus, Lead } from '@/lib/types';
import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useToast } from '@/hooks/use-toast';
import { Device, Call as TwilioCall } from '@twilio/voice-sdk';

interface CallState {
  callHistory: Call[];
  activeCall: Call | null;
  softphoneOpen: boolean;
  showIncomingCall: boolean;
  showPostCallSheetForId: string | null;
  twilioDevice: Device | null;
  audioPermissionsGranted: boolean;
}

type CallAction =
  | { type: 'TOGGLE_SOFTPHONE' }
  | { type: 'START_OUTGOING_CALL'; payload: { to: string } }
  | { type: 'ACCEPT_CALL' }
  | { type: 'REJECT_CALL' }
  | { type: 'END_CALL' }
  | { type: 'UPDATE_CALL_STATUS'; payload: { status: CallStatus } }
  | { type: 'UPDATE_NOTES_AND_SUMMARY'; payload: { callId: string; notes: string; summary?: string } }
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string } }
  | { type: 'SET_TWILIO_DEVICE'; payload: { device: Device | null } }
  | { type: 'SET_AUDIO_PERMISSIONS'; payload: { granted: boolean } }
  | { type: 'SET_ACTIVE_TWILIO_CALL'; payload: { twilioCall: TwilioCall, direction: CallDirection, to?: string, from?: string } };

const initialState: CallState = {
  callHistory: [],
  activeCall: null,
  softphoneOpen: false,
  showIncomingCall: false,
  showPostCallSheetForId: null,
  twilioDevice: null,
  audioPermissionsGranted: false,
};

const CallContext = createContext<
  | {
      state: CallState;
      dispatch: React.Dispatch<CallAction>;
      fetchLeads: () => Promise<Lead[]>;
    }
  | undefined
>(undefined);

const callReducer = (state: CallState, action: CallAction): CallState => {
  switch (action.type) {
    case 'TOGGLE_SOFTPHONE':
      return { ...state, softphoneOpen: !state.softphoneOpen };

    case 'SET_TWILIO_DEVICE':
        return { ...state, twilioDevice: action.payload.device };
        
    case 'SET_AUDIO_PERMISSIONS':
        return { ...state, audioPermissionsGranted: action.payload.granted };

    case 'START_OUTGOING_CALL': {
      if (state.activeCall || !state.twilioDevice) return state;
       state.twilioDevice.connect({
           params: { To: action.payload.to, From: process.env.NEXT_PUBLIC_TWILIO_CALLER_ID || '' },
       });
      return { ...state, softphoneOpen: true };
    }
    
    case 'SET_ACTIVE_TWILIO_CALL': {
        const { twilioCall, direction, to, from } = action.payload;
        const newCall: Call = {
            id: twilioCall.parameters.CallSid,
            direction: direction,
            to: direction === 'outgoing' ? (to || twilioCall.parameters.To) : 'You',
            from: direction === 'incoming' ? (from || twilioCall.parameters.From) : 'You',
            startTime: Date.now(),
            duration: 0,
            status: direction === 'incoming' ? 'ringing-incoming' : 'ringing-outgoing',
            twilioInstance: twilioCall,
        };

        const newState: CallState = {
            ...state,
            activeCall: newCall,
            softphoneOpen: true,
        };

        if (direction === 'incoming') {
            newState.showIncomingCall = true;
        }

        return newState;
    }
    
    case 'ACCEPT_CALL':
      if (!state.activeCall || !state.activeCall.twilioInstance) return state;
      state.activeCall.twilioInstance.accept();
      return {
        ...state,
        showIncomingCall: false,
        softphoneOpen: true,
        activeCall: { ...state.activeCall, status: 'in-progress' },
      };

    case 'REJECT_CALL': {
      if (!state.activeCall || !state.activeCall.twilioInstance) return state;
      state.activeCall.twilioInstance.reject();
      const rejectedCall: Call = {
        ...state.activeCall,
        status: 'voicemail-dropping', // We'll simulate this for now
        endTime: Date.now(),
      };
      return {
        ...state,
        activeCall: null,
        showIncomingCall: false,
        callHistory: [rejectedCall, ...state.callHistory],
      };
    }
    
    case 'END_CALL': {
        if (!state.activeCall || !state.activeCall.twilioInstance) return state;
        state.activeCall.twilioInstance.disconnect();
        // The rest of the logic is handled by the 'disconnect' event listener on the Twilio call object
        return state;
    }

    case 'UPDATE_CALL_STATUS':
      if (!state.activeCall) return state;
      return {
        ...state,
        activeCall: { ...state.activeCall, status: action.payload.status },
      };

    case 'UPDATE_NOTES_AND_SUMMARY': {
      return {
        ...state,
        callHistory: state.callHistory.map((call) =>
          call.id === action.payload.callId
            ? { ...call, notes: action.payload.notes, summary: action.payload.summary }
            : call
        ),
      };
    }

    case 'CLOSE_POST_CALL_SHEET':
        return { ...state, showPostCallSheetForId: null };

    case 'OPEN_POST_CALL_SHEET':
        return { ...state, showPostCallSheetForId: action.payload.callId };

    default:
      return state;
  }
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
        try {
            const response = await fetch('/api/token');
            const data = await response.json();
            if (data.token) {
                setToken(data.token);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch Twilio token.' });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch Twilio token.' });
        }
    };
    if (state.audioPermissionsGranted) {
        fetchToken();
    }
  }, [state.audioPermissionsGranted, toast]);
  
  useEffect(() => {
    if (token && state.audioPermissionsGranted) {
        const device = new Device(token, {
            codecPreferences: ['opus', 'pcmu'],
            // WORKAROUND: Surpress `Twilio.Device is not a constructor` error
            // @ts-ignore
            debug: process.env.NODE_ENV === 'development',
        });

        device.on('error', (error) => {
            console.error('Twilio Device Error:', error);
            toast({ variant: 'destructive', title: 'Twilio Error', description: error.message });
        });

        device.on('ready', (d) => {
            dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device: d } });
            toast({ title: 'Softphone Ready', description: 'You can now make and receive calls.' });
        });
        
        device.on('incoming', (twilioCall) => {
            dispatch({ type: 'SET_ACTIVE_TWILIO_CALL', payload: { twilioCall, direction: 'incoming' } });
        });

        const currentDevice = device;

        return () => {
            currentDevice.destroy();
            dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device: null } });
        }
    }
  }, [token, state.audioPermissionsGranted, toast]);

  const handleTwilioCallEvents = useCallback((twilioCall: TwilioCall) => {
    const callSid = twilioCall.parameters.CallSid;
    
    twilioCall.on('accept', () => {
        dispatch({ type: 'UPDATE_CALL_STATUS', payload: { status: 'in-progress' } });
    });

    twilioCall.on('disconnect', () => {
        const { activeCall, callHistory } = state;
        if (activeCall && activeCall.id === callSid) {
            const endedCall: Call = {
                ...activeCall,
                status: 'completed',
                endTime: Date.now(),
                duration: Math.floor((Date.now() - activeCall.startTime) / 1000),
            };

            // This is a direct state update which is not ideal, but necessary
            // to avoid complex reducer logic with async operations.
            // A better approach would be to use a state management library like Redux Toolkit.
            (state as any).activeCall = null;
            (state as any).showPostCallSheetForId = endedCall.id;
            (state as any).callHistory = [endedCall, ...callHistory];
            // Force re-render
            dispatch({ type: 'TOGGLE_SOFTPHONE' });
            dispatch({ type: 'TOGGLE_SOFTPHONE' });
        }
    });

    twilioCall.on('cancel', () => {
         const { activeCall, callHistory } = state;
         if (activeCall && activeCall.id === callSid) {
            const canceledCall = { ...activeCall, status: 'canceled', endTime: Date.now() };
            (state as any).activeCall = null;
            (state as any).callHistory = [canceledCall, ...callHistory];
            dispatch({ type: 'TOGGLE_SOFTPHONE' });
            dispatch({ type: 'TOGGLE_SOFTPHONE' });
         }
    });

  }, [state]);


  useEffect(() => {
    if (state.activeCall?.twilioInstance) {
        handleTwilioCallEvents(state.activeCall.twilioInstance);
    }
  }, [state.activeCall, handleTwilioCallEvents]);
  
  const fetchLeads = useCallback(async (): Promise<Lead[]> => {
    try {
        const response = await fetch(process.env.NEXT_PUBLIC_LEADS_API_ENDPOINT!);
        if (!response.ok) {
            throw new Error('Failed to fetch leads');
        }
        const data = await response.json();
        return data.leads as Lead[];
    } catch (error) {
        console.error(error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: (error as Error).message || 'Could not fetch leads.'
        });
        return [];
    }
  }, [toast]);

  return (
    <CallContext.Provider value={{ state, dispatch, fetchLeads }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
