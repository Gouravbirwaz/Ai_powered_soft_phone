
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
  | { type: 'UPDATE_ACTIVE_CALL'; payload: { call: Partial<Call> } }
  | { type: 'ADD_OR_UPDATE_CALL'; payload: { call: Call } }
  | { type: 'SET_CALL_HISTORY'; payload: Call[] }
  | { type: 'SHOW_INCOMING_CALL'; payload: boolean }
  | { type: 'UPDATE_NOTES_AND_SUMMARY'; payload: { callId: string; notes: string; summary?: string } }
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string; } }
  | { type: 'SET_CURRENT_AGENT'; payload: { agent: Agent | null } };

const initialState: CallState = {
  callHistory: [],
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
      fetchCallHistory: (agentId: string) => Promise<void>;
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
    case 'UPDATE_ACTIVE_CALL':
        if (!state.activeCall) return state;
        return { ...state, activeCall: { ...state.activeCall, ...action.payload.call } };
    case 'SHOW_INCOMING_CALL':
      return { ...state, showIncomingCall: action.payload };
    case 'SET_CALL_HISTORY':
        return { ...state, callHistory: action.payload };
    case 'ADD_OR_UPDATE_CALL': {
        const { call } = action.payload;
        const newHistory = state.callHistory.filter(c => c.id !== call.id);
        newHistory.unshift(call);
        return { ...state, callHistory: newHistory };
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
    case 'SET_CURRENT_AGENT':
        return { ...state, currentAgent: action.payload.agent };
    default:
      return state;
  }
};

const logCall = async (call: Call) => {
    if (!call.agentId) {
        console.warn('Cannot log call without agentId.', call);
        return;
    }

    // Backend requires lead_id for logging. For now, we only log outgoing calls with a leadId.
    // Incoming calls do not have a leadId and are not logged.
    if (!call.leadId) {
        console.warn('Cannot log call without leadId.', call);
        return;
    }

    try {
        const phoneNumber = call.direction === 'outgoing' ? call.to : call.from;

        const response = await fetch('/api/twilio/call_logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_id: call.leadId,
                agent_id: call.agentId,
                phone_number: phoneNumber,
                started_at: call.startTime ? new Date(call.startTime).toISOString() : null,
                ended_at: call.endTime ? new Date(call.endTime).toISOString() : null,
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

  const fetchCallHistory = useCallback(async (agentId: string) => {
    try {
        const response = await fetch(`/api/twilio/call_logs?agent_id=${agentId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch call history. Status: ${response.status}`);
        }
        const data = await response.json();
        const formattedCalls: Call[] = (data.call_logs || []).map((log: any) => ({
            id: log.call_log_id,
            direction: 'outgoing', 
            from: state.currentAgent?.phone || 'Unknown',
            to: log.phone_number,
            startTime: new Date(log.started_at).getTime(),
            endTime: log.ended_at ? new Date(log.ended_at).getTime() : undefined,
            duration: log.duration || 0,
            status: 'completed',
            notes: log.notes,
            summary: log.summary,
            agentId: String(log.agent_id),
            leadId: log.lead_id,
        }));
        dispatch({ type: 'SET_CALL_HISTORY', payload: formattedCalls.sort((a, b) => b.startTime - a.startTime) });
    } catch (error: any) {
        console.error("Fetch call history error:", error);
        toast({
            variant: 'destructive',
            title: 'API Error',
            description: error.message || 'Could not fetch call history.'
        });
    }
  }, [toast, state.currentAgent]);

  const cleanupTwilio = useCallback(() => {
    twilioDeviceRef.current?.destroy();
    twilioDeviceRef.current = null;
    activeTwilioCallRef.current = null;
    dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'uninitialized' } });
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
  }, []);

  const endActiveCall = useCallback(async (status: CallStatus = 'completed') => {
    const twilioCall = activeTwilioCallRef.current;
    const activeCall = state.activeCall;

    if (!activeCall) return;

    const endTime = Date.now();
    const duration = Math.round((endTime - activeCall.startTime) / 1000);

    const finalCallState: Call = {
      ...activeCall,
      status,
      endTime,
      duration,
    };

    dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status, endTime, duration } }});

    await logCall(finalCallState);
    
    if (state.currentAgent) {
        // Refetch history to get the latest state from the DB
        await fetchCallHistory(state.currentAgent.id);
    }

    if (status === 'completed' && finalCallState.leadId) {
        dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: finalCallState.id } });
    } else if (['busy', 'failed', 'canceled'].includes(status)) {
        // Keep softphone open for failed calls
    } else {
       dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
       dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
       dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: false });
    }
    
    twilioCall?.disconnect();
    activeTwilioCallRef.current = null;

  }, [state.activeCall, state.currentAgent, fetchCallHistory]);
  
  const closeSoftphone = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: false });
  }, []);

  const handleIncomingCall = useCallback((twilioCall: TwilioCall) => {
    console.log('Incoming call from', twilioCall.parameters.From);
    activeTwilioCallRef.current = twilioCall;

    const callData: Call = {
        id: twilioCall.parameters.CallSid,
        from: twilioCall.parameters.From,
        to: twilioCall.parameters.To,
        direction: 'incoming',
        status: 'ringing-incoming',
        startTime: Date.now(),
        duration: 0,
        agentId: state.currentAgent?.id,
    };
    
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
    dispatch({ type: 'SHOW_INCOMING_CALL', payload: true });
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });

    twilioCall.on('disconnect', () => endActiveCall('completed'));
    twilioCall.on('cancel', () => endActiveCall('canceled'));
  }, [state.currentAgent, endActiveCall]);

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

        device.on('incoming', handleIncomingCall);

        await device.register();
        twilioDeviceRef.current = device;

    } catch (error: any) {
        console.error('Error initializing Twilio:', error);
        dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'error' } });
        toast({ title: 'Initialization Failed', description: error.message || 'Could not get a token from the server.', variant: 'destructive' });
    }
  }, [state.currentAgent, state.twilioDeviceStatus, toast, cleanupTwilio, handleIncomingCall]);


  const startOutgoingCall = useCallback(async (to: string, leadId?: string) => {
    if (!state.currentAgent || !twilioDeviceRef.current) {
        toast({ title: 'Softphone Not Ready', description: 'The softphone is not connected. Please login again.', variant: 'destructive' });
        return;
    }
    
    const callData: Call = {
        id: `temp_${Date.now()}`,
        from: state.currentAgent.phone,
        to: to,
        direction: 'outgoing',
        status: 'ringing-outgoing',
        startTime: Date.now(),
        duration: 0,
        agentId: state.currentAgent.id,
        leadId: leadId,
    };
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
    
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

        const { conference } = await makeCallResponse.json();
        
        const twilioCall = await twilioDeviceRef.current.connect({
            params: { To: `room:${conference}` },
        });

        activeTwilioCallRef.current = twilioCall;
        
        const permanentCall = { ...callData, id: twilioCall.parameters.CallSid };
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: permanentCall } });

        twilioCall.on('accept', () => {
          dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'in-progress' } } });
        });

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
        endActiveCall('failed');
    }
  }, [state.currentAgent, toast, endActiveCall]);

  const acceptIncomingCall = useCallback(() => {
    const twilioCall = activeTwilioCallRef.current;
    if (twilioCall && twilioCall.direction === 'incoming' && state.activeCall) {
      twilioCall.accept();
      const updatedCall = { ...state.activeCall, status: 'in-progress' as CallStatus };
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: updatedCall } });
      dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    }
  }, [state.activeCall]);

  const rejectIncomingCall = useCallback(() => {
    const twilioCall = activeTwilioCallRef.current;
    if (twilioCall && twilioCall.direction === 'incoming') {
      twilioCall.reject();
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
    if(agent) {
        fetchCallHistory(agent.id);
    }
  }, [fetchCallHistory]);
  
  useEffect(() => {
    if (state.currentAgent && state.twilioDeviceStatus === 'uninitialized') {
        initializeTwilio();
    }
  }, [state.currentAgent, state.twilioDeviceStatus, initializeTwilio]);


  const logout = useCallback(() => {
    cleanupTwilio();
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent: null } });
    dispatch({ type: 'SET_CALL_HISTORY', payload: [] });
  }, [cleanupTwilio]);

  const updateNotesAndSummary = useCallback(async (payload: { callId: string; notes: string; summary?: string }) => {
    dispatch({ type: 'UPDATE_NOTES_AND_SUMMARY', payload });
    const callToLog = state.callHistory.find(c => c.id === payload.callId);
    if(callToLog) {
        // We need to re-log the call with the updated notes.
        await logCall({ ...callToLog, notes: payload.notes, summary: payload.summary });
        if (state.currentAgent) {
            // Refetch to ensure UI is consistent with DB
            await fetchCallHistory(state.currentAgent.id);
        }
    }
  }, [state.callHistory, state.currentAgent, fetchCallHistory]);

  return (
    <CallContext.Provider value={{
        state,
        dispatch: (action: CallAction) => {
            if (action.type === 'UPDATE_NOTES_AND_SUMMARY') {
                updateNotesAndSummary(action.payload);
            } else {
                dispatch(action);
            }
        },
        fetchLeads,
        fetchAgents,
        fetchCallHistory,
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

    