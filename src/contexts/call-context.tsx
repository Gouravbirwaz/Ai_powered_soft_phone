
'use client';

import type { Call, Lead, Agent, CallStatus } from '@/lib/types';
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
  twilioDeviceStatus: 'uninitialized',
  audioPermissionsGranted: false,
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
      startOutgoingCall: (to: string, leadId?: string) => void;
      acceptIncomingCall: () => void;
      rejectIncomingCall: () => void;
      endActiveCall: (status?: CallStatus) => void;
      getActiveTwilioCall: () => TwilioCall | null;
      closeSoftphone: () => void;
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
        const updatedHistory = state.callHistory.map((call) =>
            call.id === action.payload.callId
            ? { ...call, notes: action.payload.notes, summary: action.payload.summary }
            : call
        );
        const callToLog = updatedHistory.find(c => c.id === action.payload.callId);
        if (callToLog) {
            logCall(callToLog);
        }
        return {
            ...state,
            callHistory: updatedHistory,
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

const logCall = async (call: Call) => {
    if (!call.leadId || !call.agentId) {
        console.warn('Cannot log call without leadId and agentId.', call);
        return;
    }
    try {
        const response = await fetch('/api/twilio/call_logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_id: call.leadId,
                agent_id: call.agentId,
                phone_number: call.to,
                started_at: call.startTime ? new Date(call.startTime).toISOString() : undefined,
                ended_at: call.endTime ? new Date(call.endTime).toISOString() : undefined,
                duration: call.duration,
                notes: call.notes,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to log call:', errorData);
        } else {
            console.log('Call logged successfully');
        }
    } catch (error) {
        console.error('Error logging call:', error);
    }
};


export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { toast } = useToast();
  const twilioDeviceRef = useRef<Device | null>(null);
  const activeTwilioCallRef = useRef<TwilioCall | null>(null);

  const cleanupTwilio = useCallback(() => {
    twilioDeviceRef.current?.destroy();
    twilioDeviceRef.current = null;
    activeTwilioCallRef.current = null;
    dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'uninitialized' } });
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
  }, []);

  const handleCallStateChange = useCallback((twilioCall: TwilioCall | null, callData: Partial<Call>) => {
    if (!twilioCall && !callData.id) return;
    const callId = callData.id || twilioCall?.parameters.CallSid;

    if(!callId) return;

    const existingCall = state.callHistory.find(c => c.id === callId);

    const updatedCall: Call = {
        id: callId,
        direction: callData.direction || (twilioCall?.direction === 'incoming' ? 'incoming' : 'outgoing'),
        from: twilioCall?.parameters.From || state.currentAgent?.phone || 'Unknown',
        to: twilioCall?.parameters.To || callData.to || 'Unknown',
        startTime: callData.startTime || Date.now(),
        duration: 0,
        status: 'queued',
        agentId: state.currentAgent?.id,
        ...existingCall,
        ...callData,
    };
    
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: updatedCall } });
    dispatch({ type: 'ADD_OR_UPDATE_CALL_HISTORY', payload: updatedCall });

  }, [state.currentAgent, state.callHistory]);

  const endActiveCall = useCallback((status: CallStatus = 'completed') => {
    const twilioCall = activeTwilioCallRef.current;
    if (!twilioCall) {
        if(state.activeCall) {
             handleCallStateChange(null, { ...state.activeCall, status, endTime: Date.now() });
        }
        return;
    }

    const callId = twilioCall.parameters.CallSid;
    const existingCall = state.callHistory.find(c => c.id === callId);

    if (existingCall) {
        const endTime = Date.now();
        const duration = Math.round((endTime - existingCall.startTime) / 1000);
        const finalCallState: Call = {
            ...existingCall,
            status,
            endTime,
            duration,
        }
        handleCallStateChange(twilioCall, finalCallState);
        logCall(finalCallState);

        if (status === 'completed') {
            dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId } });
        }
    }
    
    twilioCall.disconnect();
    activeTwilioCallRef.current = null;
    
    // Only close the softphone if the call was actually completed.
    // Otherwise, keep it open for voicemail, etc.
    if (status === 'completed') {
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
      dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
      dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: false });
    }
  }, [state.activeCall, state.callHistory, handleCallStateChange]);
  
  const closeSoftphone = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: false });
  }, []);


  const initializeTwilio = useCallback(async () => {
    if (twilioDeviceRef.current || state.twilioDeviceStatus === 'initializing' || !state.currentAgent) {
        return;
    }
    
    dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'initializing' } });
    
    try {
        const response = await fetch(`/api/twilio/token?identity=${state.currentAgent.id}`);
        if (!response.ok) {
            throw new Error(`Failed to get a token from the server. Status: ${response.status}.`);
        }
        const { token } = await response.json();

        if (typeof token !== 'string') {
          throw new Error('Received invalid token from server.');
        }
        
        const device = new Device(token, {
            codecPreferences: ['opus', 'pcmu'],
            logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
        });
        
        device.on('ready', () => {
            console.log('Twilio Device is ready.');
            dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'ready' } });
            dispatch({ type: 'SET_AUDIO_PERMISSIONS', payload: { granted: true } });
        });

        device.on('error', (error) => {
            console.error('Twilio Device Error:', error);
            dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'error' } });
            toast({ title: 'Softphone Error', description: error.message, variant: 'destructive' });
            cleanupTwilio();
        });

        device.on('incoming', (twilioCall) => {
            console.log('Incoming call from', twilioCall.parameters.From);
            activeTwilioCallRef.current = twilioCall;

            const callData = {
                id: twilioCall.parameters.CallSid,
                from: twilioCall.parameters.From,
                to: twilioCall.parameters.To,
                direction: 'incoming' as const,
                status: 'ringing-incoming' as const,
                startTime: Date.now(),
            };
            
            handleCallStateChange(twilioCall, callData);

            dispatch({ type: 'SHOW_INCOMING_CALL', payload: true });
            dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });

            twilioCall.on('disconnect', () => endActiveCall('completed'));
            twilioCall.on('cancel', () => endActiveCall('canceled'));
        });

        await device.register();
        twilioDeviceRef.current = device;

    } catch (error: any) {
        console.error('Error initializing Twilio:', error);
        dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'error' } });
        toast({ title: 'Initialization Failed', description: error.message || 'Could not get a token from the server.', variant: 'destructive' });
    }
  }, [state.currentAgent, state.twilioDeviceStatus, toast, cleanupTwilio, handleCallStateChange, endActiveCall]);


  const startOutgoingCall = useCallback(async (to: string, leadId?: string) => {
    if (!state.currentAgent) {
        toast({ title: 'Softphone Not Ready', description: 'The softphone is not connected. Please login again.', variant: 'destructive' });
        return;
    }
    
    try {
        const makeCallResponse = await fetch(`/api/twilio/make_call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: state.currentAgent.id,
            to: to,
          }),
        });

        if (!makeCallResponse.ok) {
          const errorBody = await makeCallResponse.text();
          throw new Error(`Backend failed to initiate call. Status: ${makeCallResponse.status}. Body: ${errorBody}`);
        }

        const { conference, customer_call_sid } = await makeCallResponse.json();

        const tempCallId = customer_call_sid || `temp_${Date.now()}`;
        const callData: Partial<Call> = {
            id: tempCallId,
            from: state.currentAgent.phone,
            to: to,
            direction: 'outgoing',
            status: 'ringing-outgoing',
            startTime: Date.now(),
            leadId: leadId,
        };

        handleCallStateChange(null, callData);
        
        if (!twilioDeviceRef.current) {
            throw new Error("Twilio Device not initialized.");
        }

        const twilioCall = await twilioDeviceRef.current.connect({
            params: { To: `room:${conference}` },
        });

        activeTwilioCallRef.current = twilioCall;
        
        // This process feels a bit clunky. Maybe there's a better way.
        // We create a temporary call, then update it.
        const existingCall = state.callHistory.find(c => c.id === tempCallId);
        const finalCallData: Partial<Call> = {
            ...existingCall, // get existing data
            id: twilioCall.parameters.CallSid, // Overwrite with final SID
        };
        handleCallStateChange(twilioCall, finalCallData);
        
        // Remove the temporary call from history, if it's still there.
        // This is a bit of a hack.
        dispatch({
            type: 'ADD_OR_UPDATE_CALL_HISTORY',
            payload: { ...state.activeCall!, ...finalCallData }
        })


        twilioCall.on('accept', () => handleCallStateChange(twilioCall, { status: 'in-progress' }));
        twilioCall.on('disconnect', () => endActiveCall('completed'));
        twilioCall.on('cancel', () => endActiveCall('canceled'));
        twilioCall.on('reject', () => endActiveCall('busy'));
        twilioCall.on('error', (e) => {
          console.error("Twilio call error", e);
          endActiveCall('failed');
        });

    } catch (error: any) {
        console.error('Error starting outgoing call:', error);
        toast({ title: 'Call Failed', description: error.message || 'Could not start the call.', variant: 'destructive' });
        if (state.activeCall) {
            handleCallStateChange(null, { ...state.activeCall, status: 'failed' });
        }
    }
  }, [state.currentAgent, state.activeCall, state.callHistory, toast, handleCallStateChange, endActiveCall]);

  const acceptIncomingCall = useCallback(() => {
    const twilioCall = activeTwilioCallRef.current;
    if (twilioCall && twilioCall.direction === 'incoming') {
      twilioCall.accept();
      handleCallStateChange(twilioCall, { status: 'in-progress' });
      dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    }
  }, [handleCallStateChange]);

  const rejectIncomingCall = useCallback(() => {
    const twilioCall = activeTwilioCallRef.current;
    if (twilioCall && twilioCall.direction === 'incoming') {
      twilioCall.reject();
      // Use endActiveCall to centralize state updates
      endActiveCall('canceled');
      dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
      activeTwilioCallRef.current = null;
    }
  }, [endActiveCall]);
  
  const getActiveTwilioCall = useCallback(() => {
    return activeTwilioCallRef.current;
  }, []);
  
  const fetchLeads = useCallback(async (): Promise<Lead[]> => {
    try {
        const response = await fetch('/api/leads');
        if (!response.ok) {
            throw new Error(`Failed to fetch leads. Status: ${response.status}`);
        }
        const data = await response.json();
        return (data.leads || []) as Lead[];
    } catch (error: any) {
        console.error("Fetch leads error:", error);
        toast({
            variant: 'destructive',
            title: 'API Error',
            description: error.message || 'Could not fetch leads.'
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
        return (data.agents || []) as Agent[];
    } catch (error: any) {
        console.error("Fetch agents error:", error);
        toast({
            variant: 'destructive',
            title: 'API Error',
            description: error.message || 'Could not fetch agents.'
        });
        return [];
    }
  }, [toast]);
  
  const loginAsAgent = useCallback((agent: Agent) => {
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent } });
  }, []);
  
  useEffect(() => {
    if (state.currentAgent && state.twilioDeviceStatus === 'uninitialized') {
        initializeTwilio();
    }
  }, [state.currentAgent, state.twilioDeviceStatus, initializeTwilio]);


  const logout = useCallback(() => {
    cleanupTwilio();
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent: null } });
  }, [cleanupTwilio]);

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
        closeSoftphone,
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
