'use client';

import type { Call, Lead } from '@/lib/types';
import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useToast } from '@/hooks/use-toast';
import { Device, Call as TwilioCall } from '@twilio/voice-sdk';
import { MOCK_CALLS } from '@/lib/mock-calls';

type TwilioDeviceStatus = 'uninitialized' | 'initializing' | 'ready' | 'error';

interface CallState {
  callHistory: Call[];
  activeCall: Call | null;
  softphoneOpen: boolean;
  showIncomingCall: boolean;
  showPostCallSheetForId: string | null;
  twilioDeviceStatus: TwilioDeviceStatus;
  audioPermissionsGranted: boolean;
}

type CallAction =
  | { type: 'TOGGLE_SOFTPHONE' }
  | { type: 'SET_SOFTPHONE_OPEN'; payload: boolean }
  | { type: 'SET_TWILIO_DEVICE_STATUS'; payload: { status: TwilioDeviceStatus } }
  | { type: 'SET_AUDIO_PERMISSIONS'; payload: { granted: boolean } }
  | { type: 'SET_ACTIVE_CALL'; payload: { call: Call | null } }
  | { type: 'ADD_OR_UPDATE_CALL_HISTORY'; payload: Call }
  | { type: 'SHOW_INCOMING_CALL'; payload: boolean }
  | { type: 'UPDATE_NOTES_AND_SUMMARY'; payload: { callId: string; notes: string; summary?: string } }
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string } };

const initialState: CallState = {
  callHistory: MOCK_CALLS,
  activeCall: null,
  softphoneOpen: false,
  showIncomingCall: false,
  showPostCallSheetForId: null,
  twilioDeviceStatus: 'uninitialized',
  audioPermissionsGranted: false,
};

const CallContext = createContext<
  | {
      state: CallState;
      dispatch: React.Dispatch<CallAction>;
      fetchLeads: () => Promise<Lead[]>;
      initializeTwilio: () => Promise<void>;
      startOutgoingCall: (to: string) => void;
      acceptIncomingCall: () => void;
      rejectIncomingCall: () => void;
      endActiveCall: () => void;
      getActiveTwilioCall: () => TwilioCall | null;
    }
  | undefined
>(undefined);

const callReducer = (state: CallState, action: CallAction): CallState => {
  switch (action.type) {
    case 'TOGGLE_SOFTPHONE':
      return { ...state, softphoneOpen: !state.softphoneOpen };
    case 'SET_SOFTPHONE_OPEN':
      return { ...state, softphoneOpen: action.payload };
    case 'SET_TWILIO_DEVICE_STATUS':
      return { ...state, twilioDeviceStatus: action.payload.status };
    case 'SET_AUDIO_PERMISSIONS':
      return { ...state, audioPermissionsGranted: action.payload.granted };
    case 'SET_ACTIVE_CALL':
      return { ...state, activeCall: action.payload.call };
    case 'SHOW_INCOMING_CALL':
      return { ...state, showIncomingCall: action.payload };
    case 'ADD_OR_UPDATE_CALL_HISTORY': {
      const callExists = state.callHistory.some(c => c.id === action.payload.id);
      return {
        ...state,
        callHistory: callExists
          ? state.callHistory.map(c => c.id === action.payload.id ? action.payload : c)
          : [action.payload, ...state.callHistory],
      };
    }
    case 'UPDATE_NOTES_AND_SUMMARY':
      return {
        ...state,
        callHistory: state.callHistory.map((call) =>
          call.id === action.payload.callId
            ? { ...call, notes: action.payload.notes, summary: action.payload.summary }
            : call
        ),
      };
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
  const twilioDeviceRef = useRef<Device | null>(null);
  const activeTwilioCallRef = useRef<TwilioCall | null>(null);


  const handleCallEnded = useCallback((call: Call) => {
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    dispatch({ type: 'ADD_OR_UPDATE_CALL_HISTORY', payload: call });
    
    if (call.status === 'completed') {
      dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: call.id } });
    }
  }, []);

  const createCallObjectFromTwilio = useCallback((twilioCall: TwilioCall): Call => {
    const direction = twilioCall.direction() === 'incoming' ? 'incoming' : 'outgoing';
    return {
      id: twilioCall.parameters.CallSid,
      direction: direction,
      to: twilioCall.parameters.To,
      from: twilioCall.parameters.From,
      startTime: Date.now(),
      duration: 0,
      status: direction === 'incoming' ? 'ringing-incoming' : 'ringing-outgoing',
      avatarUrl: `https://picsum.photos/seed/${Math.random()}/100/100`,
    };
  }, []);

  const setupTwilioListeners = useCallback((device: Device) => {
    device.on('ready', () => {
      console.log('Twilio Device is ready!');
      dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'ready' } });
      toast({ title: 'Softphone Ready', description: 'You can now make and receive calls.' });
    });

    device.on('error', (error: any) => {
      console.error('Twilio Device Error:', error);
      toast({ variant: 'destructive', title: 'Twilio Error', description: error.message });
      dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'error' } });
    });

    device.on('incoming', (twilioCall: TwilioCall) => {
      console.log('Incoming call from:', twilioCall.parameters.From);
      activeTwilioCallRef.current = twilioCall;
      const newCall = createCallObjectFromTwilio(twilioCall);
      
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: newCall } });
      dispatch({ type: 'ADD_OR_UPDATE_CALL_HISTORY', payload: newCall });
      dispatch({ type: 'SHOW_INCOMING_CALL', payload: true });
      
      twilioCall.on('disconnect', () => {
        console.log('Incoming call disconnected');
        const finalCall = {
          ...newCall,
          status: 'completed' as const,
          duration: Math.floor((Date.now() - newCall.startTime) / 1000),
        };
        activeTwilioCallRef.current = null;
        handleCallEnded(finalCall);
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
      });

      twilioCall.on('cancel', () => {
        console.log('Incoming call canceled');
        const finalCall = { ...newCall, status: 'canceled' as const, duration: 0 };
        activeTwilioCallRef.current = null;
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        dispatch({ type: 'ADD_OR_UPDATE_CALL_HISTORY', payload: finalCall });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
      });
    });

  }, [toast, createCallObjectFromTwilio, handleCallEnded]);

  const initializeTwilio = useCallback(async () => {
    if (twilioDeviceRef.current || state.twilioDeviceStatus === 'initializing' || state.twilioDeviceStatus === 'ready') {
      return;
    }
    
    try {
      console.log('Initializing Twilio...');
      dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'initializing' } });
      
      const tokenRes = await fetch('/api/token');
      if (!tokenRes.ok) throw new Error('Failed to fetch Twilio token.');
      const { token } = await tokenRes.json();
      
      const device = new Device(token, { codecPreferences: ['opus', 'pcmu'] });
      setupTwilioListeners(device);
      twilioDeviceRef.current = device;
      
    } catch (error: any) {
      console.error("Twilio initialization error:", error);
      toast({ variant: 'destructive', title: 'Initialization Error', description: error.message || 'Could not connect to call service.' });
      dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'error' } });
    }
  }, [state.twilioDeviceStatus, setupTwilioListeners, toast]);

  const startOutgoingCall = useCallback(async (to: string) => {
    if (!twilioDeviceRef.current || state.twilioDeviceStatus !== 'ready') {
      toast({ title: 'Softphone not ready', variant: 'destructive' });
      return;
    }
    try {
      const twilioCall = await twilioDeviceRef.current.connect({ params: { To: to } });
      activeTwilioCallRef.current = twilioCall;

      const newCall = createCallObjectFromTwilio(twilioCall);
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: newCall } });
      dispatch({ type: 'ADD_OR_UPDATE_CALL_HISTORY', payload: newCall });
      dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });

      twilioCall.on('accept', () => {
        console.log('Outgoing call accepted');
        const acceptedCall = { ...newCall, status: 'in-progress' as const, startTime: Date.now() };
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: acceptedCall } });
        dispatch({ type: 'ADD_OR_UPDATE_CALL_HISTORY', payload: acceptedCall });
      });
      
      twilioCall.on('disconnect', () => {
        console.log('Outgoing call disconnected');
        const finalCall = {
            ...newCall,
            status: 'completed' as const,
            duration: Math.floor((Date.now() - newCall.startTime) / 1000)
        };
        activeTwilioCallRef.current = null;
        handleCallEnded(finalCall);
      });

      twilioCall.on('error', (err) => {
        console.error('Outgoing call error', err);
        const finalCall = { ...newCall, status: 'failed' as const, duration: 0 };
        activeTwilioCallRef.current = null;
        handleCallEnded(finalCall);
      })

    } catch (error) {
        console.error("Error starting outgoing call:", error);
        toast({ title: 'Failed to start call', variant: 'destructive' });
    }
  }, [state.twilioDeviceStatus, toast, createCallObjectFromTwilio, handleCallEnded]);

  const acceptIncomingCall = useCallback(() => {
    if (!activeTwilioCallRef.current || !state.activeCall) return;
    activeTwilioCallRef.current.accept();
    const acceptedCall = { ...state.activeCall, status: 'in-progress' as const, startTime: Date.now() };
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: acceptedCall } });
    dispatch({ type: 'ADD_OR_UPDATE_CALL_HISTORY', payload: acceptedCall });
    dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });
  }, [state.activeCall]);

  const rejectIncomingCall = useCallback(() => {
    if (!activeTwilioCallRef.current || !state.activeCall) return;
    activeTwilioCallRef.current.reject();
    const rejectedCall = { ...state.activeCall, status: 'canceled' as const };
    activeTwilioCallRef.current = null;
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    dispatch({ type: 'ADD_OR_UPDATE_CALL_HISTORY', payload: rejectedCall });
    dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
  }, [state.activeCall]);
  
  const endActiveCall = useCallback(() => {
    if (!activeTwilioCallRef.current) return;
    activeTwilioCallRef.current.disconnect();
  }, []);

  const getActiveTwilioCall = useCallback(() => activeTwilioCallRef.current, []);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      twilioDeviceRef.current?.destroy();
    }
  }, []);
  
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
        const text = await response.text();
        
        try {
            const data = JSON.parse(text);
             if (data && Array.isArray(data.leads)) {
                return data.leads as Lead[];
            }
        } catch (e) {
             if (e instanceof SyntaxError) {
                const errorDetail = `Unexpected token '<', which suggests an HTML error page was returned instead of valid JSON.`
                console.error("Fetch leads error: SyntaxError: " + e.message, "Response was:", text);
                toast({
                    variant: 'destructive',
                    title: 'API Error',
                    description: errorDetail
                });
                return [];
             }
             throw e;
        }

        return [];
    } catch (error: any) {
        console.error("Fetch leads error:", error);
        
        let description = 'Could not fetch leads.';
        if (error instanceof Error) {
            description = error.message;
        }

        toast({
            variant: 'destructive',
            title: 'API Error',
            description: description
        });
        return [];
    }
  }, [toast]);

  return (
    <CallContext.Provider value={{
        state,
        dispatch,
        fetchLeads,
        initializeTwilio,
        startOutgoingCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endActiveCall,
        getActiveTwilioCall,
    }}>
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
