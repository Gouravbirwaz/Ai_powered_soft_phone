'use client';

import type { Call, CallDirection, CallStatus, Lead } from '@/lib/types';
import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useCallback,
  useEffect,
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
  | { type: 'CALL_ENDED'; payload: { callId: string, finalStatus: CallStatus, duration: number } }
  | { type: 'UPDATE_CALL_STATUS'; payload: { callId: string; status: CallStatus } }
  | { type: 'UPDATE_NOTES_AND_SUMMARY'; payload: { callId: string; notes: string; summary?: string } }
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string } }
  | { type: 'SET_TWILIO_DEVICE'; payload: { device: Device | null } }
  | { type: 'SET_AUDIO_PERMISSIONS'; payload: { granted: boolean } }
  | { type: 'SET_ACTIVE_CALL'; payload: { call: Call } };

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
      const params = { To: action.payload.to };
      // The `connect` event will be handled by the device listener to create the active call
      state.twilioDevice.connect({ params });
      return { ...state, softphoneOpen: true };
    }
    
    case 'SET_ACTIVE_CALL': {
        const { call } = action.payload;
        return {
            ...state,
            activeCall: call,
            softphoneOpen: true,
            showIncomingCall: call.direction === 'incoming' && call.status === 'ringing-incoming',
            callHistory: state.callHistory.find(c => c.id === call.id) ? state.callHistory : [call, ...state.callHistory],
        };
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
        callHistory: state.callHistory.map(c => c.id === updatedCall.id ? updatedCall : c),
      };
    }

    case 'REJECT_CALL': {
      if (!state.activeCall || !state.activeCall.twilioInstance) return state;
      state.activeCall.twilioInstance.reject();
      // The disconnect handler will manage cleanup
      return { ...state, showIncomingCall: false, activeCall: null };
    }
    
    case 'END_CALL': {
        if (!state.activeCall || !state.activeCall.twilioInstance) return state;
        state.activeCall.twilioInstance.disconnect();
        // The disconnect handler will manage cleanup
        return state;
    }

    case 'CALL_ENDED': {
        const { callId, finalStatus, duration } = action.payload;
        const callToEnd = state.callHistory.find(c => c.id === callId);
        if (!callToEnd) return state;

        const updatedCall = { ...callToEnd, status: finalStatus, duration };
        const newHistory = state.callHistory.map(c => c.id === callId ? updatedCall : c);

        const shouldOpenSheet = finalStatus === 'completed';

        return {
            ...state,
            activeCall: state.activeCall?.id === callId ? null : state.activeCall,
            callHistory: newHistory,
            showPostCallSheetForId: shouldOpenSheet ? callId : null,
            softphoneOpen: shouldOpenSheet ? true : state.softphoneOpen,
        };
    }

    case 'UPDATE_CALL_STATUS': {
      const { callId, status } = action.payload;
      const updatedActiveCall = state.activeCall?.id === callId ? { ...state.activeCall, status } : state.activeCall;
      const newHistory = state.callHistory.map(c => c.id === callId ? { ...c, status } : c);
      
      return {
        ...state,
        activeCall: updatedActiveCall,
        callHistory: newHistory,
      };
    }

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

let twilioDevice: Device | null = null;

const setupTwilioDevice = async (token: string, dispatch: React.Dispatch<CallAction>, toast: (args: any) => void) => {
    if (twilioDevice) {
        twilioDevice.destroy();
        twilioDevice = null;
    }

    try {
        twilioDevice = new Device(token, {
            codecPreferences: ['opus', 'pcmu'],
            edge: ['ashburn', 'frankfurt'],
        });

        twilioDevice.on('ready', () => {
            dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device: twilioDevice } });
            toast({ title: 'Softphone Ready', description: 'You can now make and receive calls.' });
        });

        twilioDevice.on('error', (error: any) => {
            console.error('Twilio Device Error:', error);
            toast({ variant: 'destructive', title: 'Twilio Error', description: error.message });
            dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device: null } });
        });

        const handleCallLifecycle = (twilioCall: TwilioCall) => {
            const callId = twilioCall.parameters.CallSid;
            const direction = twilioCall.direction() === 'incoming' ? 'incoming' : 'outgoing';
            
            const newCall: Call = {
                id: callId,
                direction: direction,
                to: twilioCall.parameters.To,
                from: twilioCall.parameters.From,
                startTime: Date.now(),
                duration: 0,
                status: direction === 'incoming' ? 'ringing-incoming' : 'ringing-outgoing',
                twilioInstance: twilioCall,
                avatarUrl: `https://picsum.photos/seed/${Math.random()}/100/100`,
            };
            dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: newCall }});
            
            twilioCall.on('accept', () => {
                dispatch({ type: 'UPDATE_CALL_STATUS', payload: { callId, status: 'in-progress' } });
            });

            const handleDisconnect = () => {
                const duration = Math.floor((Date.now() - newCall.startTime) / 1000);
                dispatch({ type: 'CALL_ENDED', payload: { callId, finalStatus: 'completed', duration } });
            };

            twilioCall.on('disconnect', handleDisconnect);
            twilioCall.on('cancel', () => dispatch({ type: 'CALL_ENDED', payload: { callId, finalStatus: 'canceled', duration: 0 } }));
            twilioCall.on('reject', () => dispatch({ type: 'CALL_ENDED', payload: { callId, finalStatus: 'canceled', duration: 0 } }));
            
            twilioCall.on('error', (err) => {
              toast({ variant: 'destructive', title: 'Call Error', description: err.message });
              dispatch({ type: 'CALL_ENDED', payload: { callId, finalStatus: 'failed', duration: 0 } });
            });
        };

        twilioDevice.on('incoming', handleCallLifecycle);
        twilioDevice.on('connect', handleCallLifecycle);

    } catch (error) {
        console.error("Failed to setup Twilio Device", error);
        toast({ variant: 'destructive', title: 'Initialization Failed', description: 'Could not set up the softphone.' });
    }
};


export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { toast } = useToast();
  
  useEffect(() => {
    const initialize = async () => {
        if (state.audioPermissionsGranted && !state.twilioDevice) {
            try {
                const response = await fetch('/api/token');
                if (!response.ok) throw new Error('Failed to fetch token');
                const data = await response.json();
                if (data.token) {
                    await setupTwilioDevice(data.token, dispatch, toast);
                } else {
                    throw new Error('Token not found in response');
                }
            } catch (error: any) {
                console.error("Initialization error:", error);
                toast({ variant: 'destructive', title: 'Initialization Error', description: error.message || 'Could not connect to the call service.' });
            }
        }
    };
    initialize();

    return () => {
      if (twilioDevice) {
        twilioDevice.destroy();
        dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device: null } });
      }
    };
  }, [state.audioPermissionsGranted, toast]);
  
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
                console.error("Fetch leads error: SyntaxError: " + e.message, "Response was:", text);
                throw new SyntaxError(`Unexpected token '<', which suggests an HTML error page was returned instead of valid JSON.`);
             }
             throw e;
        }

        return [];
    } catch (error: any) {
        console.error("Fetch leads error:", error);
        
        let description = 'Could not fetch leads.';
        if (error.message.includes("Unexpected token '<'")) {
            description = "Failed to parse server response. The API might be down or returning an HTML error page instead of JSON.";
        } else if (error instanceof Error) {
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
