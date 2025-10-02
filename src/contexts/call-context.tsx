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
      const params = { To: action.payload.to, From: process.env.NEXT_PUBLIC_TWILIO_CALLER_ID || '' };
      state.twilioDevice.connect({ params });
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
      return { ...state, showIncomingCall: false, activeCall: null }; // Assume it ends immediately
    }
    
    case 'END_CALL': {
        if (!state.activeCall || !state.activeCall.twilioInstance) return state;
        state.activeCall.twilioInstance.disconnect();
        return state;
    }

    case 'CALL_ENDED': {
        const { call } = action.payload;
        const callExists = state.callHistory.some(c => c.id === call.id);
        
        const newHistory = state.callHistory.map(c => c.id === call.id ? call : c);
        if (!callExists) {
            newHistory.unshift(call);
        }
        
        return {
            ...state,
            activeCall: null,
            callHistory: newHistory,
            showPostCallSheetForId: call.status === 'completed' ? call.id : null,
            softphoneOpen: call.status === 'completed'
        };
    }

    case 'UPDATE_CALL_STATUS': {
      if (!state.activeCall || state.activeCall.id !== action.payload.callId) return state;
      const updatedActiveCall = { ...state.activeCall, status: action.payload.status };
      return {
        ...state,
        activeCall: updatedActiveCall,
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

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { toast } = useToast();
  
  const fetchToken = useCallback(async () => {
    try {
      const response = await fetch('/api/token');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }
      const data = await response.json();
      if (data.token) {
        return data.token;
      } else {
        toast({ variant: 'destructive', title: 'Token Error', description: data.error || 'Could not fetch Twilio token.' });
        return null;
      }
    } catch (error: any) {
      console.error('Fetch token error:', error);
      toast({ variant: 'destructive', title: 'Network Error', description: error.message || 'Could not fetch Twilio token.' });
      return null;
    }
  }, [toast]);
  
  useEffect(() => {
    let device: Device | null = null;
    const setupTwilio = async () => {
      if (!state.audioPermissionsGranted) {
        return;
      }
      
      const token = await fetchToken();
      if (!token) {
        console.error("Failed to fetch Twilio token. Cannot initialize device.");
        return;
      }

      device = new Device(token, {
        codecPreferences: ['opus', 'pcmu'],
      });

      device.on('ready', () => {
        dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device } });
        toast({ title: 'Softphone Ready', description: 'You can now make and receive calls.' });
      });

      device.on('error', (error: any) => {
        console.error('Twilio Device Error:', error);
        toast({ variant: 'destructive', title: 'Twilio Error', description: error.message });
      });

      const handleCall = (twilioCall: TwilioCall) => {
        const direction = twilioCall.direction() === 'incoming' ? 'incoming' : 'outgoing';
        
        const handleDisconnect = () => {
          let currentCallState = null;
          // Use a function with reducer to get latest state
          dispatch((prevState) => {
            const callInHistory = prevState.callHistory.find(c => c.id === twilioCall.parameters.CallSid);
            const activeCall = prevState.activeCall?.id === twilioCall.parameters.CallSid ? prevState.activeCall : null;
            currentCallState = activeCall || callInHistory;
            return prevState;
          });

          const endedCall: Call = {
            id: twilioCall.parameters.CallSid,
            direction,
            from: twilioCall.parameters.From,
            to: twilioCall.parameters.To,
            startTime: (currentCallState as Call | null)?.startTime || Date.now(),
            endTime: Date.now(),
            duration: (currentCallState as Call | null)?.startTime ? Math.floor((Date.now() - (currentCallState as Call).startTime) / 1000) : 0,
            status: twilioCall.status() as CallStatus,
            avatarUrl: (currentCallState as Call | null)?.avatarUrl || `https://picsum.photos/seed/${Math.random()}/100/100`,
          };

          if(endedCall.status !== 'in-progress'){
             dispatch({ type: 'CALL_ENDED', payload: { call: {...endedCall, status: 'completed'} }});
          }
        };

        twilioCall.on('disconnect', handleDisconnect);
        twilioCall.on('cancel', handleDisconnect);
        twilioCall.on('reject', handleDisconnect);
        twilioCall.on('error', (err) => {
          toast({ variant: 'destructive', title: 'Call Error', description: err.message });
          handleDisconnect();
        });
        
        twilioCall.on('accept', () => {
             dispatch({type: 'UPDATE_CALL_STATUS', payload: { callId: twilioCall.parameters.CallSid, status: 'in-progress'}});
        });

        dispatch({
          type: 'SET_ACTIVE_TWILIO_CALL',
          payload: { twilioCall, direction, to: twilioCall.parameters.To, from: twilioCall.parameters.From },
        });
      };

      device.on('incoming', handleCall);

      device.on('connect', (twilioCall: TwilioCall) => {
        // This handles outgoing calls once they are established
        handleCall(twilioCall);
        // We can immediately set outgoing calls to 'in-progress' upon connection
        dispatch({type: 'UPDATE_CALL_STATUS', payload: { callId: twilioCall.parameters.CallSid, status: 'in-progress'}});
      });
    };

    setupTwilio();

    return () => {
      if (device) {
        device.destroy();
      }
      dispatch({ type: 'SET_TWILIO_DEVICE', payload: { device: null } });
    };
}, [state.audioPermissionsGranted, fetchToken, toast]);


  
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
                throw new SyntaxError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`);
             }
             throw e;
        }

        return [];
    } catch (error: any) {
        console.error("Fetch leads error:", error);
        
        let description = 'Could not fetch leads.';
        if (error.message.includes("not valid JSON")) {
            description = "Failed to parse server response. The API might be down or returning an HTML error page.";
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

    