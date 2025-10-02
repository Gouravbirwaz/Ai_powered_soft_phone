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
  useMemo,
} from 'react';
import { useToast } from '@/hooks/use-toast';
import { Device, Call as TwilioCall } from '@twilio/voice-sdk';
import { MOCK_CALLS } from '@/lib/mock-calls';

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
  | {
      type: 'CALL_ENDED';
      payload: { call: Call };
    }
  | { type: 'UPDATE_CALL_STATUS'; payload: { callId: string; status: CallStatus } }
  | { type: 'UPDATE_NOTES_AND_SUMMARY'; payload: { callId: string; notes: string; summary?: string } }
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string } }
  | { type: 'SET_TWILIO_DEVICE'; payload: { device: Device | null } }
  | { type: 'SET_AUDIO_PERMISSIONS'; payload: { granted: boolean } }
  | {
      type: 'SET_ACTIVE_TWILIO_CALL';
      payload: { twilioCall: TwilioCall; direction: CallDirection; to?: string; from?: string };
    };

const initialState: CallState = {
  callHistory: MOCK_CALLS,
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
       }).then(twilioCall => {
         // This doesn't immediately set the call, the connect listener does
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
            avatarUrl: `https://picsum.photos/seed/${Math.random()}/100/100`
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
    
    case 'ACCEPT_CALL': {
      if (!state.activeCall || !state.activeCall.twilioInstance) return state;
      state.activeCall.twilioInstance.accept();
      const updatedCall = { ...state.activeCall, status: 'in-progress', startTime: Date.now() } as Call;
      return {
        ...state,
        showIncomingCall: false,
        softphoneOpen: true,
        activeCall: updatedCall,
      };
    }

    case 'REJECT_CALL': {
      if (!state.activeCall || !state.activeCall.twilioInstance) return state;
      state.activeCall.twilioInstance.reject();
      // The call ending logic will be handled by the 'disconnect' event
      return { ...state, showIncomingCall: false };
    }
    
    case 'END_CALL': {
        if (!state.activeCall || !state.activeCall.twilioInstance) return state;
        state.activeCall.twilioInstance.disconnect();
        return state;
    }

    case 'CALL_ENDED': {
        const { call } = action.payload;
        return {
            ...state,
            activeCall: null,
            callHistory: [call, ...state.callHistory],
            showPostCallSheetForId: call.status === 'completed' ? call.id : null,
            softphoneOpen: call.status === 'completed'
        };
    }

    case 'UPDATE_CALL_STATUS':
      if (!state.activeCall || state.activeCall.id !== action.payload.callId) return state;
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

  // 1. Fetch token when permissions are granted
  useEffect(() => {
    if (state.audioPermissionsGranted && !token) {
      const fetchToken = async () => {
        try {
          const response = await fetch('/api/token');
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with ${response.status}`);
          }
          const data = await response.json();
          if (data.token) {
            setToken(data.token);
          } else {
            toast({ variant: 'destructive', title: 'Token Error', description: data.error || 'Could not fetch Twilio token.' });
          }
        } catch (error: any) {
          console.error('Fetch token error:', error);
          toast({ variant: 'destructive', title: 'Network Error', description: error.message || 'Could not fetch Twilio token.' });
        }
      };
      fetchToken();
    }
  }, [state.audioPermissionsGranted, token, toast]);
  
  // 2. Initialize device when token is available
  useEffect(() => {
    if (!token || state.twilioDevice) return;

    let device: Device;
    try {
        device = new Device(token, {
            codecPreferences: ['opus', 'pcmu'],
            // @ts-ignore
            debug: process.env.NODE_ENV === 'development',
        });
    } catch (e) {
        console.error("Error initializing Twilio Device:", e);
        toast({ variant: 'destructive', title: 'Twilio Error', description: "Failed to create Twilio device." });
        return;
    }


    const onReady = (d: Device) => {
        dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device: d } });
        toast({ title: 'Softphone Ready', description: 'You can now make and receive calls.' });
    };

    const onError = (error: any) => {
        console.error('Twilio Device Error:', error);
        toast({ variant: 'destructive', title: 'Twilio Error', description: error.message });
        device.destroy();
        dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device: null } });
        setToken(null); // This will trigger a re-fetch
    };

    const handleCall = (twilioCall: TwilioCall, direction: CallDirection, customParams: { to?: string; from?: string } = {}) => {
        // Centralized call event handling
        const handleDisconnect = () => {
            const finalStatus = twilioCall.status() === 'canceled' ? 'canceled' : 'completed';
            const endedCall: Call = {
                id: twilioCall.parameters.CallSid,
                direction: direction,
                from: twilioCall.parameters.From,
                to: twilioCall.parameters.To,
                startTime: state.activeCall?.startTime || Date.now(),
                endTime: Date.now(),
                duration: state.activeCall?.startTime ? Math.floor((Date.now() - state.activeCall.startTime) / 1000) : 0,
                status: finalStatus,
                avatarUrl: state.activeCall?.avatarUrl,
            };
            dispatch({ type: 'CALL_ENDED', payload: { call: endedCall }});
            
            // Clean up listeners
            twilioCall.off('disconnect', handleDisconnect);
            twilioCall.off('cancel', handleDisconnect);
            twilioCall.off('error', handleError);
        };
        
        const handleError = (err: any) => {
           toast({ variant: 'destructive', title: 'Call Error', description: err.message });
           handleDisconnect();
        };

        twilioCall.on('disconnect', handleDisconnect);
        twilioCall.on('cancel', handleDisconnect); // Also handles user rejecting/cancelling
        twilioCall.on('error', handleError);

        dispatch({
            type: 'SET_ACTIVE_TWILIO_CALL',
            payload: { twilioCall, direction, ...customParams },
        });
    };
    
    const onIncoming = (twilioCall: TwilioCall) => {
        handleCall(twilioCall, 'incoming');
    };
    
    const onOutgoing = (twilioCall: TwilioCall) => {
        handleCall(twilioCall, 'outgoing', { to: twilioCall.parameters.To });
    };

    device.on('ready', onReady);
    device.on('error', onError);
    device.on('incoming', onIncoming);
    device.on('connect', onOutgoing); // For outgoing calls

    // Set device immediately for UI feedback, though 'ready' is the true indicator
    // dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device } });

    return () => {
      device.off('ready', onReady);
      device.off('error', onError);
      device.off('incoming', onIncoming);
      device.off('connect', onOutgoing);
      device.destroy();
      dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device: null } });
    }
  }, [token, toast, state.twilioDevice, state.activeCall]); // Added dependencies
  
  const fetchLeads = useCallback(async (): Promise<Lead[]> => {
    const endpoint = process.env.NEXT_PUBLIC_LEADS_API_ENDPOINT;
    if (!endpoint) {
        toast({ variant: 'destructive', title: 'Configuration Error', description: 'Leads API endpoint is not configured.' });
        return [];
    }
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Failed to fetch leads. Status: ${response.status}`);
        }
        const data = await response.json();
        // Check if the 'leads' property exists and is an array
        if (data && Array.isArray(data.leads)) {
          return data.leads as Lead[];
        }
        // Handle cases where the API returns a success status but no 'leads' array
        return [];
    } catch (error) {
        console.error("Fetch leads error:", error);
        toast({
            variant: 'destructive',
            title: 'API Error',
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
