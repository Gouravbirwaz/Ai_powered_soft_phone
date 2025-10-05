
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
  allCallHistory: Call[]; // To track all calls for lead status
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
  | { type: 'SET_ALL_CALL_HISTORY'; payload: Call[] }
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string; } }
  | { type: 'SET_CURRENT_AGENT'; payload: { agent: Agent | null } }
  | { type: 'SHOW_INCOMING_CALL'; payload: boolean };

const initialState: CallState = {
  callHistory: [],
  allCallHistory: [],
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
        
        const newHistory = state.callHistory.some(c => c.id === call.id) 
            ? state.callHistory 
            : [call, ...state.callHistory];

        const newAllHistory = state.allCallHistory.some(c => c.id === call.id)
            ? state.allCallHistory
            : [call, ...state.allCallHistory];

        return {
            ...state,
            callHistory: newHistory.sort((a, b) => (b.startTime || 0) - (a.startTime || 0)),
            allCallHistory: newAllHistory.sort((a, b) => (b.startTime || 0) - (a.startTime || 0)),
        };
    }
    case 'UPDATE_IN_HISTORY': {
        const { call } = action.payload;
        const update = (history: Call[]) => {
            const index = history.findIndex(c => c.id === call.id);
            if (index === -1) return [call, ...history];
            const newHistory = [...history];
            newHistory[index] = call;
            return newHistory;
        };
        return {
            ...state,
            callHistory: update(state.callHistory),
            allCallHistory: update(state.allCallHistory),
        };
    }
    case 'REPLACE_IN_HISTORY': {
        const { tempId, finalCall } = action.payload;
        const replace = (history: Call[]) => history.map(c => c.id === tempId ? finalCall : c);
        return {
            ...state,
            callHistory: replace(state.callHistory).sort((a,b) => (b.startTime || 0) - (a.startTime || 0)),
            allCallHistory: replace(state.allCallHistory).sort((a,b) => (b.startTime || 0) - (a.startTime || 0)),
        }
    }
    case 'SET_CALL_HISTORY':
        return { ...state, callHistory: action.payload.sort((a,b) => (b.startTime || 0) - (a.startTime || 0)) };
    case 'SET_ALL_CALL_HISTORY':
        return { ...state, allCallHistory: action.payload.sort((a,b) => (b.startTime || 0) - (a.startTime || 0)) };
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

  const mapCallLog = useCallback((log: any): Call => ({
    id: String(log.id),
    direction: log.direction || (log.agent_id == currentAgentRef.current?.id ? 'outgoing' : 'incoming'), 
    from: log.direction === 'incoming' ? log.phone_number : (state.currentAgent?.phone || 'Unknown'),
    to: log.direction === 'outgoing' ? log.phone_number : (state.currentAgent?.phone || 'Unknown'),
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
  }), [state.currentAgent]);

  const fetchCallHistory = useCallback(async (agentId: string) => {
    try {
      const url = `/api/twilio/call_logs?agent_id=${agentId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch agent call history. Status: ${response.status}`);
      }
      const data = await response.json();
      const formattedCalls: Call[] = (data.call_logs || []).map(mapCallLog);
      dispatch({ type: 'SET_CALL_HISTORY', payload: formattedCalls });
    } catch (error: any) {
      console.error("Fetch agent call history error:", error);
      toast({
        variant: 'destructive',
        title: 'API Error',
        description: error.message || 'Could not fetch call history.'
      });
    }
  }, [toast, mapCallLog]);

  const fetchAllCallHistory = useCallback(async () => {
    try {
      const url = '/api/twilio/call_logs';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch all call history. Status: ${response.status}`);
      }
      const data = await response.json();
      const formattedCalls: Call[] = (data.call_logs || []).map(mapCallLog);
      dispatch({ type: 'SET_ALL_CALL_HISTORY', payload: formattedCalls });
    } catch (error: any) {
      console.error("Fetch all call history error:", error);
      toast({
        variant: 'destructive',
        title: 'API Error',
        description: error.message || 'Could not fetch full call history.'
      });
    }
  }, [toast, mapCallLog]);


  const createOrUpdateCallOnBackend = useCallback(async (call: Call) => {
    if (!call || !call.agentId || !call.id) {
        console.error("Cannot create call log on backend: Missing critical data.", call);
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
            ended_at: call.endTime ? new Date(call.endTime).toISOString() : new Date().toISOString(),
            started_at: call.startTime ? new Date(call.startTime).toISOString() : new Date().toISOString(),
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
            let errorDetails = errorText;
             try {
                const errorJson = JSON.parse(errorText);
                errorDetails = errorJson.message || errorJson.error || errorText;
            } catch (e) {
            }
            console.error(`Failed to create call log:`, errorDetails);
            toast({
                title: 'Logging Error',
                description: `Failed to create call log: ${errorDetails}`,
                variant: 'destructive',
            });
            return null;
        } else {
            console.log('Call log created successfully for call:', call.id);
            const responseData = await response.json();
            return responseData.call_log as Call;
        }
    } catch (error) {
        console.error('Error in createOrUpdateCallOnBackend function:', error);
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

  const fetchTranscript = async (callSid: string) => {
    try {
        const response = await fetch(`/api/twilio/transcript/${callSid}`);
        if (!response.ok) {
            // Don't throw, just return null if no transcript
            console.warn(`Could not fetch transcript for ${callSid}. Status: ${response.status}`);
            return null;
        }
        const data = await response.json();
        // Assuming the transcript is in data.recordings[0].transcript
        return data.recordings?.[0]?.transcript || null;
    } catch (error) {
        console.error('Error fetching transcript:', error);
        return null;
    }
  };
  
  const handleCallDisconnect = useCallback(async (twilioCall: TwilioCall | null, status: CallStatus = 'completed') => {
    const callInState = activeCallRef.current;
    if (!callInState) {
        console.warn('handleCallDisconnect called but no active call in state.');
        activeTwilioCallRef.current = null;
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
        return;
    }
    
    if (!callInState.startTime || isNaN(callInState.startTime)) {
        console.error('handleCallDisconnect: active call has invalid startTime.', callInState);
        activeTwilioCallRef.current = null;
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
        return;
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - callInState.startTime) / 1000);

    let transcript = null;
    if (status === 'completed' || status === 'canceled') {
        transcript = await fetchTranscript(callInState.id);
    }

    const finalCallState: Call = {
      ...callInState,
      status,
      endTime,
      duration,
      notes: transcript || callInState.notes || '', // Pre-fill notes with transcript
    };
    
    createOrUpdateCallOnBackend(finalCallState).then((savedCall) => {
        if(savedCall) {
            const finalSavedCall = mapCallLog(savedCall);
            dispatch({ type: 'REPLACE_IN_HISTORY', payload: { tempId: callInState.id, finalCall: finalSavedCall } });

            if (status === 'completed' || status === 'canceled' || status === 'busy' || status === 'failed') {
                dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: finalSavedCall.id } });
            }
        } else {
            dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: finalCallState } });
        }
    });

    dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    activeTwilioCallRef.current = null;
  }, [createOrUpdateCallOnBackend, mapCallLog]);


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
      to: currentAgentRef.current?.phone || '',
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

        const { conference, customer_call_sid } = await response.json();

        if (!conference || !customer_call_sid) {
          throw new Error('Backend did not return a conference name or call SID.');
        }

        const agentCall = await twilioDeviceRef.current.connect({
          params: { To: `room:${conference}` }
        });
        activeTwilioCallRef.current = agentCall;
        
        const callData: Call = {
            id: customer_call_sid,
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
        dispatch({ type: 'ADD_TO_HISTORY', payload: { call: callData } });

        agentCall.on('accept', () => dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'in-progress' } } }));
        agentCall.on('disconnect', (call) => handleCallDisconnect(call, 'completed'));
        agentCall.on('cancel', (call) => handleCallDisconnect(call, 'canceled'));
        agentCall.on('reject', (call) => handleCallDisconnect(call, 'busy'));
        agentCall.on('error', (e) => {
            console.error("Twilio call error", e);
            handleCallDisconnect(null, 'failed');
        });

    } catch (error: any) {
      console.error('Error starting outgoing call:', error);
      toast({ 
        title: 'Call Failed', 
        description: error.message || 'Could not start the call.', 
        variant: 'destructive' 
      });
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    }
  }, [state.currentAgent, toast, handleCallDisconnect]);

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
    fetchCallHistory(agent.id); 
    fetchAllCallHistory();
  }, [fetchCallHistory, fetchAllCallHistory]);

  const updateNotesAndSummary = useCallback((callId: string, notes: string, summary?: string, leadId?: string, phoneNumber?: string) => {
    const callToUpdate = state.allCallHistory.find(c => c.id === callId);
    
    if(callToUpdate) {
        const updatedCall: Call = { 
            ...callToUpdate,
            notes, 
            summary,
            leadId: callToUpdate.leadId || leadId,
            to: callToUpdate.direction === 'outgoing' ? (phoneNumber || callToUpdate.to) : (callToUpdate.to || state.currentAgent?.phone),
            from: callToUpdate.direction === 'incoming' ? (phoneNumber || callToUpdate.from) : (callToUpdate.from || state.currentAgent?.phone),
        };

        dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: updatedCall } });

        createOrUpdateCallOnBackend(updatedCall).then((savedCall) => {
            if (savedCall) {
                const finalSavedCall = mapCallLog(savedCall);
                dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: finalSavedCall } });
                toast({ title: 'Notes Saved', description: 'Your call notes have been saved.' });
            }
        });
    } else {
      console.error("Could not find call to update notes for:", callId);
      toast({ title: 'Error', description: 'Could not find the call to update.', variant: 'destructive' });
    }
  }, [state.allCallHistory, state.currentAgent, createOrUpdateCallOnBackend, toast, mapCallLog]);
  
  useEffect(() => {
    if (state.currentAgent && state.twilioDeviceStatus === 'uninitialized') {
      initializeTwilio();
    }
  }, [state.currentAgent, state.twilioDeviceStatus, initializeTwilio]);

  const logout = useCallback(() => {
    cleanupTwilio();
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent: null } });
    dispatch({ type: 'SET_CALL_HISTORY', payload: [] });
    dispatch({ type: 'SET_ALL_CALL_HISTORY', payload: [] });
  }, [cleanupTwilio]);

  return (
    <CallContext.Provider value={{
      state,
      dispatch,
      fetchLeads,
      fetchAgents,
      fetchCallHistory,
      fetchAllCallHistory,
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
