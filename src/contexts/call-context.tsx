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
  // Disable initialization by default
  twilioDeviceStatus: 'ready',
  audioPermissionsGranted: true,
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
  const activeTwilioCallRef = useRef<TwilioCall | null>(null);

  const initializeTwilio = useCallback(async () => {
    console.log('Twilio initialization is disabled.');
    toast({ title: 'Softphone Disabled', description: 'Call functionality is currently turned off.' });
  }, [toast]);

  const startOutgoingCall = useCallback(async (to: string) => {
    console.log('Cannot start outgoing call: Twilio initialization is disabled.');
    toast({ title: 'Softphone Disabled', description: `Cannot call ${to}.`, variant: 'destructive'});
  }, [toast]);

  const acceptIncomingCall = useCallback(() => {
    console.log('Cannot accept incoming call: Twilio initialization is disabled.');
    toast({ title: 'Softphone Disabled', variant: 'destructive'});
  }, [toast]);

  const rejectIncomingCall = useCallback(() => {
    console.log('Cannot reject incoming call: Twilio initialization is disabled.');
    toast({ title: 'Softphone Disabled', variant: 'destructive'});
  }, [toast]);
  
  const endActiveCall = useCallback(() => {
    console.log('Cannot end active call: Twilio initialization is disabled.');
    toast({ title: 'Softphone Disabled', variant: 'destructive'});
  }, [toast]);

  const getActiveTwilioCall = useCallback(() => {
    console.log('Cannot get active Twilio call: Twilio initialization is disabled.');
    return null;
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
            console.log("Fetched data:", data); // Log the data to see what we received

            if (data && Array.isArray(data.leads)) {
                return data.leads as Lead[];
            }
            // This handles cases where the API might just return an array of leads directly
            if (Array.isArray(data)) {
                return data as Lead[];
            }
        } catch (e) {
             if (e instanceof SyntaxError) {
                const errorDetail = text.includes("<!DOCTYPE")
                    ? `The API returned an HTML page instead of JSON. This might be an ngrok error page. Please check if your local server and ngrok tunnel are running correctly.`
                    : `An unexpected error occurred while parsing the server response.`;
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
