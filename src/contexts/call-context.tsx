
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
        return { ...state, callHistory: action.payload.sort((a,b) => (b.startTime || 0) - (a.startTime || 0)) };

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

const CallContext = createContext<any>(null);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { toast } = useToast();
  const twilioDeviceRef = useRef<Device | null>(null);
  const activeTwilioCallRef = useRef<TwilioCall | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const currentAgentRef = useRef<Agent | null>(null);

  useEffect(() => {
    activeCallRef.current = state.activeCall;
  }, [state.activeCall]);

  useEffect(() => {
    currentAgentRef.current = state.currentAgent;
  }, [state.currentAgent]);

  const fetchCallHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/twilio/call_logs');
      if (!response.ok) {
        throw new Error(`Failed to fetch call history. Status: ${response.status}`);
      }
      const data = await response.json();
      const formattedCalls: Call[] = (data.call_logs || []).map((log: any) => ({
        id: log.call_log_id,
        direction: log.direction || 'outgoing', 
        from: log.direction === 'incoming' ? log.phone_number : (log.agent_phone || 'Unknown'),
        to: log.direction === 'outgoing' ? log.phone_number : (log.agent_phone || 'Unknown'),
        startTime: new Date(log.started_at).getTime(),
        endTime: log.ended_at ? new Date(log.ended_at).getTime() : undefined,
        duration: log.duration || 0,
        status: log.status || 'completed',
        notes: log.notes,
        summary: log.summary,
        agentId: String(log.agent_id),
        leadId: log.lead_id,
        followUpRequired: log.follow_up_required || false,
        callAttemptNumber: log.call_attempt_number || 1,
      }));
      dispatch({ type: 'SET_CALL_HISTORY', payload: formattedCalls });
    } catch (error: any) {
      console.error("Fetch call history error:", error);
      toast({
        variant: 'destructive',
        title: 'API Error',
        description: error.message || 'Could not fetch call history.'
      });
    }
  }, [toast]);

  const createCallOnBackend = useCallback(async (call: Partial<Call>) => {
    try {
      const phoneNumber = call.direction === 'outgoing' ? call.to : call.from;
      
      const body = {
        call_log_id: call.id,
        lead_id: call.leadId,
        agent_id: call.agentId,
        phone_number: phoneNumber,
        started_at: call.startTime ? new Date(call.startTime).toISOString() : new Date().toISOString(),
        status: call.status,
      };

      const response = await fetch('/api/twilio/call_logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from logCall API.' }));
        console.error('Failed to create call log:', errorData);
        toast({ 
          title: 'Logging Error', 
          description: `Failed to save call log: ${errorData.details || response.statusText}`, 
          variant: 'destructive'
        });
        return null;
      } else {
        const responseData = await response.json();
        console.log('Call log created successfully:', responseData.call_log);
        return responseData.call_log as Call;
      }
    } catch (error) {
      console.error('Error in createCallOnBackend function:', error);
      toast({ 
        title: 'Logging Error', 
        description: 'An unexpected error occurred while creating the call log.', 
        variant: 'destructive' 
      });
      return null;
    }
  }, [toast]);

  const updateCallOnBackend = useCallback(async (call: Call) => {
    try {
        const response = await fetch('/api/twilio/call_logs', {
            method: 'POST', // Using POST to update as well, backend should handle upsert
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                call_log_id: call.id,
                notes: call.notes,
                summary: call.summary,
                ended_at: call.endTime ? new Date(call.endTime).toISOString() : undefined,
                duration: call.duration,
                status: call.status,
                // Always include required fields for backend validation
                lead_id: call.leadId,
                agent_id: call.agentId,
                phone_number: call.direction === 'outgoing' ? call.to : call.from,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from updateCall API.' }));
            console.error('Failed to update call log:', errorData);
            toast({
                title: 'Update Error',
                description: `Failed to update call log: ${errorData.details || response.statusText}`,
                variant: 'destructive',
            });
        } else {
            console.log('Call log updated successfully for call:', call.id);
            if (call.notes || call.summary) {
              toast({ title: 'Notes Saved', description: 'Your call notes have been saved.' });
            }
        }
    } catch (error) {
        console.error('Error in updateCallOnBackend function:', error);
        toast({
            title: 'Update Error',
            description: 'An unexpected error occurred while updating the call log.',
            variant: 'destructive',
        });
    }
  }, [toast]);


  const cleanupTwilio = useCallback(() => {
    twilioDeviceRef.current?.destroy();
    twilioDeviceRef.current = null;
    activeTwilioCallRef.current = null;
    dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'uninitialized' } });
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
  }, []);
  
  const handleCallDisconnect = useCallback((twilioCall: TwilioCall | null, status: CallStatus = 'completed') => {
    const call = activeCallRef.current;
    
    if (!call) {
        console.warn('handleCallDisconnect called but no active call in ref.');
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
        activeTwilioCallRef.current = null;
        return;
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - call.startTime) / 1000);

    const finalCallState: Call = {
      ...call,
      status,
      endTime,
      duration,
    };
    
    updateCallOnBackend(finalCallState).then(() => {
        dispatch({ type: 'ADD_OR_UPDATE_CALL_IN_HISTORY', payload: { call: finalCallState } });
        if (status === 'completed') {
            dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: finalCallState.id } });
        } else {
            dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        }
    });

    dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    activeTwilioCallRef.current = null;
  }, [updateCallOnBackend]);


  const endActiveCall = useCallback((status: CallStatus = 'completed') => {
    const twilioCall = activeTwilioCallRef.current;
    
    if (twilioCall) {
      twilioCall.disconnect();
    } else {
      const call = activeCallRef.current;
      if (call) {
        handleCallDisconnect(null, status);
      }
    }
  }, [handleCallDisconnect]);
  
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
      agentId: currentAgentRef.current?.id,
      followUpRequired: false,
      callAttemptNumber: 1,
      // We likely don't have a leadId for an incoming call initially
    };
    
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
    dispatch({ type: 'SHOW_INCOMING_CALL', payload: true });
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });
    
    // Create the call log immediately
    createCallOnBackend(callData).then(createdCall => {
      if (createdCall) {
        dispatch({ type: 'ADD_OR_UPDATE_CALL_IN_HISTORY', payload: { call: createdCall } });
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: createdCall } });
      }
    });

    twilioCall.on('disconnect', (call) => handleCallDisconnect(call, 'completed'));
    twilioCall.on('cancel', (call) => handleCallDisconnect(call, 'canceled'));
    twilioCall.on('reject', (call) => handleCallDisconnect(call, 'busy'));

  }, [handleCallDisconnect, createCallOnBackend]);

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
      toast({ 
        title: 'Initialization Failed', 
        description: error.message || 'Could not get a token from the server.', 
        variant: 'destructive' 
      });
    }
  }, [state.currentAgent, state.twilioDeviceStatus, toast, cleanupTwilio, handleIncomingCall]);

  const startOutgoingCall = useCallback(async (to: string, leadId?: string) => {
    if (!state.currentAgent || !twilioDeviceRef.current) {
      toast({ 
        title: 'Softphone Not Ready', 
        description: 'The softphone is not connected. Please login again.', 
        variant: 'destructive' 
      });
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
      followUpRequired: false,
      callAttemptNumber: 1,
    };
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
    
    // Immediately create a call log on the backend
    createCallOnBackend(callData).then(createdCall => {
      if(createdCall) {
          dispatch({ type: 'ADD_OR_UPDATE_CALL_IN_HISTORY', payload: { call: createdCall } });
      }
    });

    try {
      const makeCallResponse = await fetch(`/api/twilio/make_call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: String(state.currentAgent.id),
          to: to,
        }),
      });

      if (!makeCallResponse.ok) {
        const errorBody = await makeCallResponse.text();
        throw new Error(`Backend failed to initiate call. Status: ${makeCallResponse.status}. Body: ${errorBody}`);
      }

      // The conference SID is not directly available here, we need the TwilioCall object later.
      // We will create the log immediately with a temporary ID.
      
      const twilioCall = await twilioDeviceRef.current.connect({
        params: { To: to },
      });

      activeTwilioCallRef.current = twilioCall;
      
      const permanentCall: Call = { 
        ...callData, 
        id: twilioCall.parameters.CallSid, 
      };
      
      // Create the call log on the backend as soon as we have the SID
      createCallOnBackend(permanentCall).then(createdCall => {
        if(createdCall) {
            dispatch({ type: 'REPLACE_CALL_IN_HISTORY', payload: { tempId: tempId, finalCall: createdCall } });
            dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: createdCall } });
        }
      });
      dispatch({ type: 'ADD_OR_UPDATE_CALL_IN_HISTORY', payload: { call: permanentCall } });
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: permanentCall } });

      twilioCall.on('accept', () => {
        const acceptedCall = { ...activeCallRef.current, status: 'in-progress' } as Call;
        dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'in-progress' } } });
        updateCallOnBackend(acceptedCall);
        dispatch({ type: 'ADD_OR_UPDATE_CALL_IN_HISTORY', payload: { call: acceptedCall } });

      });

      twilioCall.on('disconnect', (call) => handleCallDisconnect(call, 'completed'));
      twilioCall.on('cancel', (call) => handleCallDisconnect(call, 'canceled'));
      twilioCall.on('reject', (call) => handleCallDisconnect(call, 'busy'));
      twilioCall.on('error', (e) => {
        console.error("Twilio call error", e);
        handleCallDisconnect(null as any, 'failed');
      });

    } catch (error: any) {
      console.error('Error starting outgoing call:', error);
      toast({ 
        title: 'Call Failed', 
        description: error.message || 'Could not start the call.', 
        variant: 'destructive' 
      });
      endActiveCall('failed');
    }
  }, [state.currentAgent, toast, endActiveCall, handleCallDisconnect, createCallOnBackend, updateCallOnBackend]);

  const acceptIncomingCall = useCallback(() => {
    const twilioCall = activeTwilioCallRef.current;
    if (twilioCall && twilioCall.direction === 'incoming' && state.activeCall) {
      twilioCall.accept();
      const acceptedCall = { ...state.activeCall, status: 'in-progress' } as Call;
      dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'in-progress' } } });
      updateCallOnBackend(acceptedCall);
      dispatch({ type: 'ADD_OR_UPDATE_CALL_IN_HISTORY', payload: { call: acceptedCall } });
      dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    }
  }, [state.activeCall, updateCallOnBackend]);

  const rejectIncomingCall = useCallback(() => {
    const twilioCall = activeTwilioCallRef.current;
    if (twilioCall && twilioCall.direction === 'incoming') {
      twilioCall.reject();
    }
  }, []);
  
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
    const callToUpdate = state.callHistory.find(c => c.id === callId);
    
    if(callToUpdate) {
      const updatedCall = { ...callToUpdate, notes, summary };
      dispatch({ type: 'UPDATE_NOTES_AND_SUMMARY', payload: { callId, notes, summary }});
      updateCallOnBackend(updatedCall);
    }
  }, [state.callHistory, updateCallOnBackend]);

  useEffect(() => {
    if (state.currentAgent && state.twilioDeviceStatus === 'uninitialized') {
      initializeTwilio();
      fetchCallHistory();
    } else if (state.currentAgent) {
      fetchCallHistory();
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
  return context as Omit<typeof context, 'dispatch'> & { 
    dispatch?: React.Dispatch<CallAction>, 
    updateNotesAndSummary: (callId: string, notes: string, summary?: string) => void 
  };
};
