
'use client';

import type { Call, Lead, Agent } from '@/lib/types';
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
  currentAgent: Agent | null;
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
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string; } }
  | { type: 'SET_CURRENT_AGENT'; payload: { agent: Agent | null } };

const initialState: CallState = {
  callHistory: MOCK_CALLS,
  activeCall: null,
  softphoneOpen: false,
  showIncomingCall: false,
  showPostCallSheetForId: null,
  twilioDeviceStatus: 'ready',
  audioPermissionsGranted: true,
  currentAgent: null,
};

const CallContext = createContext<
  | {
      state: CallState;
      dispatch: React.Dispatch<CallAction>;
      fetchLeads: () => Promise<Lead[]>;
      fetchAgents: () => Promise<Agent[]>;
      loginAsAgent: (agent: Agent) => void;
      logout: () => void;
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
    case 'SET_CURRENT_AGENT':
        return { ...state, currentAgent: action.payload.agent };
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
    try {
        const response = await fetch('/api/leads');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch leads. Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Fetched data:", data);

        if (data && Array.isArray(data.leads)) {
            return data.leads as Lead[];
        }
        
        if (Array.isArray(data)) {
            return data as Lead[];
        }
        
        console.error("API response is not in the expected format.", data);
        toast({
            variant: 'destructive',
            title: 'API Error',
            description: 'Received unexpected data format from the leads API.'
        });
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

  const fetchAgents = useCallback(async (): Promise<Agent[]> => {
    try {
        const response = await fetch('/api/agents');
        if (!response.ok) {
            throw new Error(`Failed to fetch agents. Status: ${response.status}`);
        }
        const data = await response.json();
        if (data && Array.isArray(data.agents)) {
            return data.agents as Agent[];
        }
        console.error("API response is not in the expected format for agents.", data);
        toast({
            variant: 'destructive',
            title: 'API Error',
            description: 'Received unexpected data format from the agents API.'
        });
        return [];
    } catch (error: any) {
        console.error("Fetch agents error:", error);
        let description = 'Could not fetch agents.';
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
  
  const loginAsAgent = useCallback((agent: Agent) => {
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent } });
    // Here you might want to initialize Twilio for the specific agent
    initializeTwilio(); 
  }, [initializeTwilio]);

  const logout = useCallback(() => {
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent: null } });
    // You might want to disconnect the Twilio device here
  }, []);

  return (
    <CallContext.Provider value={{
        state,
        dispatch,
        fetchLeads,
        fetchAgents,
        loginAsAgent,
        logout,
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
