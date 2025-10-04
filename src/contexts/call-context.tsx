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
  | { type: 'ADD_OR_UPDATE_CALL_IN_HISTORY'; payload: { call: Call } }
  | { type: 'REPLACE_CALL_IN_HISTORY'; payload: { tempId: string, finalCall: Call } }
  | { type: 'SET_CALL_HISTORY'; payload: Call[] }
  | { type: 'UPDATE_NOTES_AND_SUMMARY'; payload: { callId: string; notes: string; summary?: string } }
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string; } }
  | { type: 'SET_CURRENT_AGENT'; payload: { agent: Agent | null } }
  | { type: 'SHOW_INCOMING_CALL'; payload: boolean };

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
    case 'UPDATE_ACTIVE_CALL': {
        if (!state.activeCall) return state;
        const updatedCall = { ...state.activeCall, ...action.payload.call };
        return {
            ...state,
            activeCall: updatedCall,
        };
    }
    case 'ADD_OR_UPDATE_CALL_IN_HISTORY': {
      const { call } = action.payload;
      const historyWithoutCall = state.callHistory.filter(c => c.id !== call.id);
      const newHistory = [call, ...historyWithoutCall];
      return {
        ...state,
        callHistory: newHistory.sort((a,b) => b.startTime - a.startTime),
      };
    }
    case 'REPLACE_CALL_IN_HISTORY': {
        const { tempId, finalCall } = action.payload;
        const newHistory = state.callHistory.map(c => c.id === tempId ? finalCall : c);
        return {
            ...state,
            callHistory: newHistory.sort((a,b) => b.startTime - a.startTime),
        }
    }
    case 'SET_CALL_HISTORY':
        return { ...state, callHistory: action.payload };

    case 'UPDATE_NOTES_AND_SUMMARY': {
        const { callId, notes, summary } = action.payload;
        const updatedHistory = state.callHistory.map((call) =>
            call.id === callId ? { ...call, notes, summary } : call
        );
        return {
            ...state,
            callHistory: updatedHistory,
        };
    }
    case 'CLOSE_POST_CALL_SHEET':
      return { ...state, showPostCallSheetForId: null };
    case 'OPEN_POST_CALL_SHEET':
      return { ...state, showPostCallSheetForId: action.payload.callId };
    case 'SET_CURRENT_AGENT':
        return { ...state, currentAgent: action.payload.agent };
    case 'SHOW_INCOMING_CALL':
      return { ...state, showIncomingCall: action.payload };
    default:
      return state;
  }
};

// Create the context here
const CallContext = createContext<any>(null);


export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { toast } = useToast();
  const twilioDeviceRef = useRef<Device | null>(null);
  const activeTwilioCallRef = useRef<TwilioCall | null>(null);

  const updateCallOnBackend = useCallback(async (call: Call) => {
    if (!state.currentAgent?.id) {
      console.warn('Cannot log call without an agentId.', call);
      return;
    }

    if (call.direction === 'outgoing' && !call.leadId) {
      console.log('Not logging manually dialed call without a leadId to backend.', call);
      return;
    }
    
    try {
        const phoneNumber = call.direction === 'outgoing' ? call.to : call.from;
        
        const body = {
            lead_id: call.leadId,
            agent_id: state.currentAgent.id,
            phone_number: phoneNumber,
            started_at: call.startTime ? new Date(call.startTime).toISOString() : null,
            ended_at: call.endTime ? new Date(call.endTime).toISOString() : null,
            duration: call.duration,
            notes: call.notes,
            summary: call.summary,
        };

        const response = await fetch('/api/twilio/call_logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from logCall API.' }));
            console.error('Failed to log call:', errorData);
            toast({ title: 'Logging Error', description: `Failed to save call log: ${errorData.error || response.statusText}`, variant: 'destructive'});
        } else {
            console.log('Call log saved successfully for call:', call.id);
            fetchCallHistory(state.currentAgent.id);
        }
    } catch (error) {
        console.error('Error in updateCallOnBackend function:', error);
        toast({ title: 'Logging Error', description: 'An unexpected error occurred while saving the call log.', variant: 'destructive'});
    }
  }, [toast, state.currentAgent]);

  const fetchCallHistory = useCallback(async (agentId: string) => {
    try {
        const response = await fetch(`/api/twilio/call_logs?agent_id=${agentId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch call history. Status: ${response.status}`);
        }
        const data = await response.json();
        const formattedCalls: Call[] = (data.call_logs || []).map((log: any) => ({
            id: log.call_log_id,
            direction: log.direction || 'outgoing', 
            from: log.direction === 'incoming' ? log.phone_number : (state.currentAgent?.phone || 'Unknown'),
            to: log.direction === 'outgoing' ? log.phone_number : (state.currentAgent?.phone || 'Unknown'),
            startTime: new Date(log.started_at).getTime(),
            endTime: log.ended_at ? new Date(log.ended_at).getTime() : undefined,
            duration: log.duration || 0,
            status: 'completed', // Assuming logs retrieved from DB are completed
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
    
    await updateCallOnBackend(finalCallState);
    
    // Update local UI state
    dispatch({ type: 'ADD_OR_UPDATE_CALL_IN_HISTORY', payload: { call: finalCallState }});
    
    // Open notes if the call was completed and had a lead
    if (status === 'completed' && finalCallState.leadId) {
        dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: finalCallState.id } });
    } else {
       dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    }
    
    dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    
    twilioCall?.disconnect();
    activeTwilioCallRef.current = null;

  }, [state.activeCall, updateCallOnBackend]);
  
  const closeSoftphone = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: false });
  }, []);

  const handleIncomingCall = useCallback((twilioCall: TwilioCall) => {
    console.log('Incoming call from', twilioCall.parameters.From);
    activeTwilioCallRef.current = twilioCall;

    const fromNumber = twilioCall.parameters.From;

    const callData: Call = {
        id: twilioCall.parameters.CallSid,
        from: fromNumber,
        to: twilioCall.parameters.To,
        direction: 'incoming',
        status: 'ringing-incoming',
        startTime: Date.now(),
        duration: 0,
        agentId: state.currentAgent?.id,
    };
    
    dispatch({ type: 'ADD_OR_UPDATE_CALL_IN_HISTORY', payload: { call: callData } });
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
    
    const tempId = `temp_${Date.now()}`;
    const callData: Call = {
        id: tempId,
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
    dispatch({ type: 'ADD_OR_UPDATE_CALL_IN_HISTORY', payload: { call: callData } });

    
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
        
        const permanentCall = { ...callData, id: twilioCall.parameters.CallSid, status: 'ringing-outgoing' as CallStatus };

        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: permanentCall } });
        dispatch({ type: 'REPLACE_CALL_IN_HISTORY', payload: { tempId: tempId, finalCall: permanentCall } });

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
      dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'in-progress' } } });
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
  }, []);

  const handleUpdateNotesAndSummary = useCallback((callId: string, notes: string, summary?: string) => {
    dispatch({ type: 'UPDATE_NOTES_AND_SUMMARY', payload: { callId, notes, summary }});
    const callToUpdate = state.callHistory.find(c => c.id === callId);
    if(callToUpdate && state.currentAgent) {
        updateCallOnBackend({ ...callToUpdate, notes, summary });
    }
  }, [state.callHistory, state.currentAgent, updateCallOnBackend]);

  useEffect(() => {
    if (state.currentAgent && state.twilioDeviceStatus === 'uninitialized') {
        initializeTwilio();
        fetchCallHistory(state.currentAgent.id);
    }
  }, [state.currentAgent, state.twilioDeviceStatus, initializeTwilio, fetchCallHistory]);


  const logout = useCallback(() => {
    cleanupTwilio();
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent: null } });
    dispatch({ type: 'SET_CALL_HISTORY', payload: [] });
  }, [cleanupTwilio]);

  return (
    <CallContext.Provider value={{
        state,
        dispatch,
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
        updateNotesAndSummary: handleUpdateNotesAndSummary,
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
  return context as Omit<typeof context, 'dispatch'> & { dispatch?: React.Dispatch<CallAction>, updateNotesAndSummary: (callId: string, notes: string, summary?: string) => void };
};
