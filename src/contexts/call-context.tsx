
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
  | { type: 'ADD_TO_HISTORY'; payload: { call: Call } }
  | { type: 'UPDATE_IN_HISTORY'; payload: { call: Call } }
  | { type: 'REPLACE_IN_HISTORY'; payload: { tempId: string, finalCall: Call } }
  | { type: 'SET_CALL_HISTORY'; payload: Call[] }
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
    case 'ADD_TO_HISTORY': {
        const { call } = action.payload;
        if (state.callHistory.some(c => c.id === call.id)) return state;
        const newHistory = [call, ...state.callHistory];
        return {
            ...state,
            callHistory: newHistory.sort((a, b) => (b.startTime || 0) - (a.startTime || 0)),
        };
    }
    case 'UPDATE_IN_HISTORY': {
        const { call } = action.payload;
        const index = state.callHistory.findIndex(c => c.id === call.id);
        if (index === -1) { 
            const newHistory = [call, ...state.callHistory];
             return {
                ...state,
                callHistory: newHistory.sort((a, b) => (b.startTime || 0) - (a.startTime || 0)),
            };
        }
        const newHistory = [...state.callHistory];
        newHistory[index] = call;
        return {
            ...state,
            callHistory: newHistory,
        };
    }
    case 'REPLACE_IN_HISTORY': {
        const { tempId, finalCall } = action.payload;
        const newHistory = state.callHistory.map(c => c.id === tempId ? finalCall : c);
        return {
            ...state,
            callHistory: newHistory.sort((a,b) => (b.startTime || 0) - (a.startTime || 0)),
        }
    }
    case 'SET_CALL_HISTORY':
        return { ...state, callHistory: action.payload.sort((a,b) => (b.startTime || 0) - (a.startTime || 0)) };

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

  const fetchCallHistory = useCallback(async (agentId?: string) => {
    try {
      const url = agentId ? `/api/twilio/call_logs?agent_id=${agentId}` : '/api/twilio/call_logs';
      const response = await fetch(url);
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

    const updateCallOnBackend = useCallback(async (call: Call) => {
        if (!call || !call.agentId || !call.id) {
            console.error("Cannot update call log on backend: Missing critical data.", call);
            toast({
                title: 'Logging Error',
                description: 'Cannot save call details: critical data is missing.',
                variant: 'destructive',
            });
            return null;
        }

        try {
            const body = {
                call_log_id: call.id,
                notes: call.notes,
                summary: call.summary,
                ended_at: call.endTime ? new Date(call.endTime).toISOString() : undefined,
                started_at: call.startTime ? new Date(call.startTime).toISOString() : undefined,
                duration: call.duration,
                status: call.status,
                lead_id: call.leadId,
                agent_id: call.agentId,
                phone_number: call.direction === 'outgoing' ? call.to : call.from,
                direction: call.direction,
            };

            const response = await fetch('/api/twilio/call_logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to update call log: ${errorText}`);
                toast({
                    title: 'Logging Error',
                    description: `Failed to update call log.`,
                    variant: 'destructive',
                });
                return null;
            } else {
                console.log('Call log updated successfully for call:', call.id);
                const responseData = await response.json();
                return responseData.call_log as Call;
            }
        } catch (error) {
            console.error('Error in updateCallOnBackend function:', error);
            toast({
                title: 'Logging Error',
                description: 'An unexpected error occurred while saving the call log.',
                variant: 'destructive',
            });
            return null;
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
    const callInState = activeCallRef.current;
    if (!callInState) {
        console.warn('handleCallDisconnect called but no active call in state.');
        activeTwilioCallRef.current = null;
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
        return;
    }

    const callFromHistory = state.callHistory.find(c => c.id === callInState.id);
    const callToLog = callFromHistory || callInState;

    if (!callToLog.startTime || isNaN(callToLog.startTime)) {
        console.error('handleCallDisconnect: active call has invalid startTime.', callToLog);
        activeTwilioCallRef.current = null;
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
        return;
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - callToLog.startTime) / 1000);

    const finalCallState: Call = {
      ...callToLog,
      status,
      endTime,
      duration,
    };

    updateCallOnBackend(finalCallState).then((savedCall) => {
        const finalSavedCall = { ...savedCall, agentId: String(savedCall?.agentId) } as Call;
        if(savedCall) {
            dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: finalSavedCall } });
            if (status === 'completed' || status === 'canceled' || status === 'busy' || status === 'failed') {
                dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: finalSavedCall.id } });
            }
        } else {
             // If backend save fails, still update UI to show it's over
            dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: finalCallState } });
        }
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    });

    dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    activeTwilioCallRef.current = null;
  }, [updateCallOnBackend, state.callHistory]);


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
    };
    
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
    dispatch({ type: 'ADD_TO_HISTORY', payload: { call: callData } });
    dispatch({ type: 'SHOW_INCOMING_CALL', payload: true });
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });

    twilioCall.on('disconnect', (call) => handleCallDisconnect(call, 'completed'));
    twilioCall.on('cancel', (call) => handleCallDisconnect(call, 'canceled'));
    twilioCall.on('reject', (call) => handleCallDisconnect(call, 'busy'));

  }, [handleCallDisconnect]);

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
    if (!state.currentAgent || !twilioDeviceRef.current || twilioDeviceRef.current.state !== 'registered') {
      toast({ 
        title: 'Softphone Not Ready', 
        description: 'The softphone is not connected. Please login again.', 
        variant: 'destructive' 
      });
      return;
    }
    
    try {
        const response = await fetch('/api/twilio/make_call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: to, agent_id: state.currentAgent.id }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to initiate call from backend.');
        }

        const { call_sid } = await response.json();

        // The call is initiated by the backend, but we need to wait for the 'outgoing' event on the device
        // to get the TwilioCall object to manage it on the client.
        // We can create a placeholder activeCall for the UI.
        
        const callData: Call = {
            id: call_sid, // Use the SID from the backend response
            from: state.currentAgent.phone,
            to: to,
            direction: 'outgoing',
            status: 'ringing-outgoing', // Or 'queued'
            startTime: Date.now(),
            duration: 0,
            agentId: state.currentAgent.id,
            leadId: leadId,
            followUpRequired: false,
            callAttemptNumber: 1,
        };

        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
        dispatch({ type: 'ADD_TO_HISTORY', payload: { call: callData } });

    } catch (error: any) {
      console.error('Error starting outgoing call:', error);
      toast({ 
        title: 'Call Failed', 
        description: error.message || 'Could not start the call.', 
        variant: 'destructive' 
      });
      // Since the call failed to initiate, clean up the UI state
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    }
  }, [state.currentAgent, toast]);

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
    fetchCallHistory(); 
  }, [fetchCallHistory]);

  const updateNotesAndSummary = useCallback((callId: string, notes: string, summary?: string, leadId?: string, phoneNumber?: string) => {
    const callToUpdate = state.callHistory.find(c => c.id === callId);
    
    if(callToUpdate) {
      const updatedCall: Call = { 
        ...callToUpdate,
        notes, 
        summary,
        leadId: callToUpdate.leadId || leadId,
      };
      dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: updatedCall } });
      updateCallOnBackend(updatedCall).then(() => {
        toast({ title: 'Notes Saved', description: 'Your call notes have been saved.' });
      });
    } else {
      console.error("Could not find call to update notes for:", callId);
      toast({ title: 'Error', description: 'Could not find the call to update.', variant: 'destructive' });
    }
  }, [state.callHistory, updateCallOnBackend, toast]);

  useEffect(() => {
    const device = twilioDeviceRef.current;
    if (device) {
        const onOutgoing = (twilioCall: TwilioCall) => {
            console.log('Device received an outgoing call event', twilioCall);
            activeTwilioCallRef.current = twilioCall;

            const callInState = activeCallRef.current;
            
            // It's possible the activeCall in state is slightly behind, let's update it with the real SID
            if (callInState && callInState.id !== twilioCall.parameters.CallSid) {
                const permanentCall: Call = { ...callInState, id: twilioCall.parameters.CallSid };
                dispatch({ type: 'REPLACE_IN_HISTORY', payload: { tempId: callInState.id, finalCall: permanentCall } });
                dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: permanentCall } });
            }

            twilioCall.on('accept', () => dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'in-progress' } } }));
            twilioCall.on('disconnect', (call) => handleCallDisconnect(call, 'completed'));
            twilioCall.on('cancel', (call) => handleCallDisconnect(call, 'canceled'));
            twilioCall.on('reject', (call) => handleCallDisconnect(call, 'busy'));
            twilioCall.on('error', (e) => {
                console.error("Twilio call error", e);
                handleCallDisconnect(null, 'failed');
            });
        };
        
        device.on('outgoing', onOutgoing);
        return () => {
            device.off('outgoing', onOutgoing);
        };
    }
  }, [state.twilioDeviceStatus, handleCallDisconnect]);

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
      updateNotesAndSummary,
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
    updateNotesAndSummary: (callId: string, notes: string, summary?: string, leadId?: string, phoneNumber?: string) => void 
  };
};
