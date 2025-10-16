
'use client';

import type { Call, Lead, Agent, CallStatus, CallDirection, ActionTaken, NewAgent } from '@/lib/types';
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
import { formatUSPhoneNumber } from '@/lib/utils';

type TwilioDeviceStatus = 'uninitialized' | 'initializing' | 'ready' | 'error';
type LoginRole = 'agent' | 'admin';

interface CallState {
  callHistory: Call[];
  allCallHistory: Call[]; // To track all calls for lead status
  agents: Agent[];
  activeCall: Call | null;
  softphoneOpen: boolean;
  showIncomingCall: boolean;
  showPostCallSheetForId: string | null;
  voicemailLeadTarget: Lead | null;
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
  | { type: 'SET_AGENTS'; payload: Agent[] }
  | { type: 'ADD_AGENT'; payload: Agent }
  | { type: 'REMOVE_AGENT'; payload: { agentId: number } }
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string; } }
  | { type: 'OPEN_VOICEMAIL_DIALOG'; payload: { lead: Lead } }
  | { type: 'CLOSE_VOICEMAIL_DIALOG' }
  | { type: 'SET_CURRENT_AGENT'; payload: { agent: Agent | null } }
  | { type: 'SHOW_INCOMING_CALL'; payload: boolean };

const initialState: CallState = {
  callHistory: [],
  allCallHistory: [],
  agents: [],
  activeCall: null,
  softphoneOpen: false,
  showIncomingCall: false,
  showPostCallSheetForId: null,
  voicemailLeadTarget: null,
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
            return newHistory.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
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
    case 'SET_AGENTS':
        return { ...state, agents: action.payload };
    case 'ADD_AGENT':
        return { ...state, agents: [...state.agents, action.payload] };
     case 'REMOVE_AGENT':
        return { ...state, agents: state.agents.filter(a => a.id !== action.payload.agentId) };
    case 'CLOSE_POST_CALL_SHEET':
      return { ...state, showPostCallSheetForId: null };
    case 'OPEN_POST_CALL_SHEET':
      return { ...state, showPostCallSheetForId: action.payload.callId };
    case 'OPEN_VOICEMAIL_DIALOG':
      return { ...state, voicemailLeadTarget: action.payload.lead };
    case 'CLOSE_VOICEMAIL_DIALOG':
      return { ...state, voicemailLeadTarget: null };
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

  const mapCallLog = useCallback((log: any): Call => {
    let summary = log.summary || '';
    let notes = log.notes || '';
    
    const summaryMarker = 'SUMMARY: ';
    const notesMarker = '\n---\nNOTES: ';
    const summaryIndex = notes.indexOf(summaryMarker);
    const notesIndex = notes.indexOf(notesMarker);

    if (summaryIndex === 0 && notesIndex > 0) {
        summary = notes.substring(summaryMarker.length, notesIndex);
        notes = notes.substring(notesIndex + notesMarker.length);
    }
    
    return {
      id: String(log.call_log_id || log.id),
      direction: log.direction,
      from: log.from || (log.direction === 'incoming' ? log.phone_number : currentAgentRef.current?.phone),
      to: log.to || (log.direction === 'outgoing' ? log.phone_number : currentAgentRef.current?.phone),
      startTime: new Date(log.started_at).getTime(),
      endTime: log.ended_at ? new Date(log.ended_at).getTime() : undefined,
      duration: log.duration || 0,
      status: log.status || 'completed',
      notes,
      summary,
      agentId: log.agent_id,
      leadId: log.lead_id || '',
      action_taken: log.action_taken || 'call',
      contactName: log.contact_name,
      followUpRequired: log.follow_up_required || false,
      callAttemptNumber: log.call_attempt_number || 1,
    };
  }, []);

  const fetchAllCallHistory = useCallback(async () => {
    if (state.allCallHistory.length > 0 && currentAgentRef.current?.role === 'admin') {
      return state.allCallHistory;
    }
    try {
      const url = '/api/twilio/call_logs';
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Failed to fetch all call history. Status: ${response.status}`);
      }
      const data = await response.json();
      const formattedCalls: Call[] = (data.call_logs || []).map(mapCallLog);
      dispatch({ type: 'SET_ALL_CALL_HISTORY', payload: formattedCalls });
      // For agent view, we still filter. For admin, this is the full list.
      if (currentAgentRef.current?.role !== 'admin') {
         dispatch({ type: 'SET_CALL_HISTORY', payload: formattedCalls.filter(c => String(c.agentId) === String(currentAgentRef.current?.id)) });
      } else {
         dispatch({ type: 'SET_CALL_HISTORY', payload: formattedCalls });
      }
      return formattedCalls;
    } catch (error: any) {
      console.error("Fetch all call history error:", error);
      toast({
        variant: 'destructive',
        title: 'API Error',
        description: error.message || 'Could not fetch full call history.'
      });
      return [];
    }
  }, [toast, mapCallLog, state.allCallHistory]);


 const createOrUpdateCallOnBackend = useCallback(async (call: Call | null) => {
    if (!call) {
        console.error("Cannot create or update call log on backend: call data is null.");
        return null;
    }
    const phoneNumber = call.direction === 'outgoing' ? call.to : call.from;
    const agentId = call.agentId || currentAgentRef.current?.id;
    
    if (!agentId || !phoneNumber) {
        console.error("Cannot create call log: agentId or phoneNumber is missing.", { agentId, phoneNumber });
        return null;
    }
    
    try {
        const combinedNotes = call.summary ? `SUMMARY: ${call.summary}\n---\nNOTES: ${call.notes || ''}` : call.notes || '';

        const body: { [key: string]: any } = {
            call_log_id: call.id.startsWith('temp-') ? undefined : call.id,
            agent_id: agentId ? parseInt(String(agentId), 10) : undefined,
            phone_number: phoneNumber,
            notes: combinedNotes,
            summary: call.summary, // Send summary separately as well
            started_at: (call.startTime && !isNaN(call.startTime)) ? new Date(call.startTime).toISOString() : new Date().toISOString(),
            ended_at: call.endTime ? new Date(call.endTime).toISOString() : null,
            duration: call.duration,
            status: call.status,
            action_taken: call.action_taken,
            follow_up_required: call.followUpRequired,
            call_attempt_number: call.callAttemptNumber,
            direction: call.direction,
            contact_name: call.contactName,
            lead_id: call.leadId,
        };
        
        const response = await fetch('/api/twilio/call_logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            let errorDetails = `Request failed with status ${response.status}`;
            try {
                const errorJson = await response.json();
                errorDetails = errorJson.error || errorJson.message || errorDetails;
            } catch (e) {
                 const text = await response.text();
                 errorDetails = text || errorDetails;
            }
            throw new Error(errorDetails);
        }

        const responseData = await response.json();
        
        const returnedLog = responseData.call_log;
        if (!returnedLog) {
            console.error("Backend did not return a call_log object");
            return null;
        }
        
        return mapCallLog(returnedLog);

    } catch (error: any) {
        console.error('Failed to create/update call log:', error.message);
        toast({
            title: 'Logging Error',
            description: `Failed to save call log: ${error.message}`,
            variant: 'destructive',
        });
        return null;
    }
  }, [toast, mapCallLog]);


  const cleanupTwilio = useCallback(() => {
    if (twilioDeviceRef.current) {
        twilioDeviceRef.current.destroy();
        twilioDeviceRef.current = null;
    }
    activeTwilioCallRef.current = null;
    dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'uninitialized' } });
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
  }, []);

  const fetchTranscript = async (callSid: string) => {
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await fetch(`/api/twilio/transcript/${callSid}`);
        if (!response.ok) {
            console.warn(`Could not fetch transcript for ${callSid}. Status: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data.recordings?.[0]?.transcript || null;
    } catch (error) {
        console.error('Error fetching transcript:', error);
        return null;
    }
  };
  
  const handleCallDisconnect = useCallback(async (twilioCall: TwilioCall | null, initialStatus: CallStatus = 'completed') => {
    const callInState = activeCallRef.current;
    if (!callInState) {
        return;
    }

    if (callInState.status !== 'in-progress' && callInState.status !== 'ringing-outgoing' && callInState.status !== 'ringing-incoming' && callInState.status !== 'queued') {
        return;
    }
    
    dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'fetching-transcript' } } });

    if (!callInState.startTime || isNaN(callInState.startTime)) {
        console.error('handleCallDisconnect: active call has invalid startTime.', callInState);
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
        return;
    }
    
    let transcript = null;
    const callSid = twilioCall?.parameters.CallSid || callInState.id;
    if ((initialStatus === 'completed' || initialStatus === 'canceled') && callSid && !callSid.startsWith('temp-')) {
        transcript = await fetchTranscript(callSid);
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - callInState.startTime) / 1000);

    let finalStatus = initialStatus;
    if (finalStatus === 'completed' && duration < 5 && callInState.direction === 'outgoing') {
        finalStatus = 'failed'; // Or 'canceled' if preferred
    }

    const finalCallState: Call = {
      ...callInState,
      status: finalStatus,
      endTime,
      duration,
      notes: transcript ? `${transcript}\n\n${callInState.notes || ''}`.trim() : callInState.notes || '',
    };
    
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: finalCallState } });
    dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    
    const savedCall = await createOrUpdateCallOnBackend(finalCallState);

    if (savedCall) {
        dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: savedCall } });
        if (finalStatus !== 'voicemail-dropped' && finalStatus !== 'emailed') {
            dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: savedCall.id } });
        }
    } else {
        dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: finalCallState } });
        if (finalStatus !== 'voicemail-dropped' && finalStatus !== 'emailed') {
            dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: finalCallState.id } });
        }
    }
    
    activeTwilioCallRef.current = null;

  }, [createOrUpdateCallOnBackend]);


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
    const currentCall = activeCallRef.current;
    if (currentCall && (currentCall.status !== 'in-progress' && currentCall.status !== 'ringing-outgoing')) {
       dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    }
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: false });
  }, []);

  const handleIncomingCall = useCallback((twilioCall: TwilioCall) => {
    console.log('Incoming call from', twilioCall.parameters.From);

    const callData: Call = {
        id: twilioCall.parameters.CallSid,
        from: twilioCall.parameters.From,
        to: twilioCall.parameters.To,
        direction: 'incoming',
        status: 'ringing-incoming',
        startTime: Date.now(),
        duration: 0,
        agentId: currentAgentRef.current!.id,
        action_taken: 'call',
        followUpRequired: false,
        callAttemptNumber: 1,
    };
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
    dispatch({ type: 'ADD_TO_HISTORY', payload: { call: callData } });
    dispatch({ type: 'SHOW_INCOMING_CALL', payload: true });
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });
    
    activeTwilioCallRef.current = twilioCall;

    twilioCall.on('accept', (call) => {
      console.log('Call accepted, updating status to in-progress');
      dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'in-progress' } } });
    });
    twilioCall.on('disconnect', (call) => handleCallDisconnect(call, 'completed'));
    twilioCall.on('cancel', (call) => handleCallDisconnect(call, 'canceled'));
    twilioCall.on('reject', (call) => handleCallDisconnect(call, 'busy'));

  }, [handleCallDisconnect]);

  const initializeTwilio = useCallback(async () => {
    const agent = currentAgentRef.current;
    if (!agent || twilioDeviceRef.current || state.twilioDeviceStatus === 'initializing') {
      return;
    }
    
    dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'initializing' } });
    
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        dispatch({ type: 'SET_AUDIO_PERMISSIONS', payload: { granted: true } });
        
        const response = await fetch(`/api/twilio/token?identity=${agent.id}`);
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
        });

        device.on('error', (error) => {
            console.error('Twilio Device Error:', error);
            // Don't show toast for this specific, common error
            if (error.code !== 31000) {
              toast({ title: 'Softphone Error', description: error.message, variant: 'destructive' });
            }
            dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'error' } });
            cleanupTwilio();
        });

        device.on('incoming', handleIncomingCall);

        await device.register();
        twilioDeviceRef.current = device;

    } catch (error: any) {
        console.error('Error initializing Twilio:', error);
        dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'error' } });
        if (error.name === 'NotAllowedError') {
             toast({ 
                title: 'Microphone Access Denied', 
                description: 'Please grant microphone access in your browser settings to use the softphone.', 
                variant: 'destructive' 
            });
        } else {
            toast({ 
                title: 'Initialization Failed', 
                description: error.message || 'Could not connect to the softphone service.', 
                variant: 'destructive' 
            });
        }
    }
  }, [state.twilioDeviceStatus, toast, cleanupTwilio, handleIncomingCall]);

  const startOutgoingCall = useCallback(async (to: string, contactName?: string, leadId?: string) => {
    const agent = currentAgentRef.current;
    if (!agent) {
      toast({
        title: 'Softphone Not Ready',
        description: 'No agent logged in.',
        variant: 'destructive',
      });
      return;
    }
    
    if (state.twilioDeviceStatus !== 'ready') {
      toast({
        title: 'Softphone Not Ready',
        description: 'The softphone is not connected. Please wait or try logging in again.',
        variant: 'destructive',
      });
      return;
    }
  
    try {
      const formattedNumber = formatUSPhoneNumber(to);
      
      const tempId = `temp-${Date.now()}`;
      
      const callData: Call = {
        id: tempId,
        from: agent.phone,
        to: formattedNumber,
        direction: 'outgoing',
        status: 'queued',
        startTime: Date.now(),
        duration: 0,
        agentId: agent.id,
        leadId: leadId,
        contactName: contactName,
        action_taken: 'call',
        followUpRequired: false,
        callAttemptNumber: 1,
      };
      
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
      dispatch({ type: 'ADD_TO_HISTORY', payload: { call: callData } });
      
      const twilioCall = await twilioDeviceRef.current!.connect({
        params: { To: formattedNumber, From: agent.phone },
      });
      
      activeTwilioCallRef.current = twilioCall;

      const permanentCall: Call = { ...callData, id: twilioCall.parameters.CallSid, status: 'ringing-outgoing' };
      dispatch({ type: 'REPLACE_IN_HISTORY', payload: { tempId, finalCall: permanentCall } });
      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: permanentCall } });


      twilioCall.on('accept', () => {
          console.log("Call accepted by remote party.");
          dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'in-progress' } } });
      });

      twilioCall.on('disconnect', (call) => handleCallDisconnect(call, 'completed'));
      twilioCall.on('cancel', (call) => handleCallDisconnect(call, 'canceled'));
      twilioCall.on('reject', (call) => handleCallDisconnect(call, 'busy'));
      twilioCall.on('error', (e) => {
        console.error("Twilio call error", e);
        handleCallDisconnect(null, 'failed');
      });
      
    } catch (error: any) {
      console.error('Error starting outgoing call:', error);
      toast({
        title: 'Call Failed',
        description: error.message || 'Could not start the call.',
        variant: 'destructive',
      });
      endActiveCall('failed');
    }
  }, [toast, endActiveCall, handleCallDisconnect, state.twilioDeviceStatus]);

  const acceptIncomingCall = useCallback(() => {
    const twilioCall = activeTwilioCallRef.current;
    if (twilioCall && state.activeCall) {
      twilioCall.accept();
    }
  }, [state.activeCall]);

  const rejectIncomingCall = useCallback(() => {
    const twilioCall = activeTwilioCallRef.current;
    if (twilioCall) {
      twilioCall.reject();
    }
  }, []);
  
  const getActiveTwilioCall = useCallback(() => {
    return activeTwilioCallRef.current;
  }, []);
  
  const fetchAgents = useCallback(async (): Promise<Agent[]> => {
    if (state.agents.length > 0) {
      return state.agents;
    }
    try {
      const response = await fetch('/api/agents');
      if (!response.ok) {
        throw new Error(`Failed to fetch agents. Status: ${response.status}`);
      }
      const data = await response.json();
      const agents = (data.agents || []) as Agent[];
      dispatch({ type: 'SET_AGENTS', payload: agents });
      return agents;
    } catch (error: any) {
      console.error("Fetch agents error:", error);
      toast({
        variant: 'destructive',
        title: 'API Error',
        description: error.message || 'Could not fetch agents.'
      });
      return [];
    }
  }, [toast, state.agents]);

  const addAgent = useCallback(async (agentData: NewAgent): Promise<boolean> => {
    try {
        const response = await fetch('/api/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || error.error || 'Failed to add agent.');
        }

        const { agent_id } = await response.json();
        const newAgent: Agent = { id: agent_id, ...agentData, status: 'active' };

        dispatch({ type: 'ADD_AGENT', payload: newAgent });
        toast({ title: 'Success', description: 'New agent has been added.' });
        return true;

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message,
        });
        return false;
    }
}, [toast]);

  const deleteAgent = useCallback(async (agentId: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.details || `Failed to delete agent. Status: ${response.status}`);
      }

      dispatch({ type: 'REMOVE_AGENT', payload: { agentId } });
      toast({ title: 'Success', description: 'Agent has been deleted.' });
      return true;

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
      return false;
    }
  }, [toast]);
  
  const loginAsAgent = useCallback(async (agent: Agent, role: LoginRole) => {
    const agentWithRole = { ...agent, role };
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent: agentWithRole } });
  }, []);

  const updateNotesAndSummary = useCallback(async (callId: string, notes: string, summary?: string) => {
    const callToUpdate = state.allCallHistory.find(c => c.id === callId);
    
    if(callToUpdate) {
      const updatedCall: Call = { 
        ...callToUpdate,
        notes, 
        summary,
      };
      
      const savedCall = await createOrUpdateCallOnBackend(updatedCall);
      
      if (savedCall) {
        dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: savedCall } });
        toast({ title: 'Notes Saved', description: 'Your call notes have been saved.' });
      }
      
    } else {
      console.error("Could not find call to update notes for:", callId);
      toast({ title: 'Error', description: 'Could not find the call to update.', variant: 'destructive' });
    }
  }, [state.allCallHistory, createOrUpdateCallOnBackend, toast]);

  const logout = useCallback(() => {
    cleanupTwilio();
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent: null } });
    dispatch({ type: 'SET_CALL_HISTORY', payload: [] });
    dispatch({ type: 'SET_ALL_CALL_HISTORY', payload: [] });
    dispatch({ type: 'SET_AGENTS', payload: [] });
  }, [cleanupTwilio]);

  const openVoicemailDialogForLead = useCallback((lead: Lead) => {
    dispatch({ type: 'OPEN_VOICEMAIL_DIALOG', payload: { lead } });
  }, []);

  const sendVoicemail = useCallback(async (lead: Lead, script: string) => {
    const agent = currentAgentRef.current;
    const phoneNumber = lead.companyPhone;

    if (!agent || !phoneNumber) {
        toast({ title: 'Error', description: 'Agent or lead phone number is missing.', variant: 'destructive' });
        return false;
    }
    
    try {
        const formattedNumber = formatUSPhoneNumber(phoneNumber);
        const response = await fetch('/api/twilio/send_voicemail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: formattedNumber,
                script: script,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || 'Failed to send voicemail');
        }

        const responseData = await response.json();
        
        const interactionLog: Call = {
          id: responseData.call_sid || `voicemail-${Date.now()}`,
          direction: 'outgoing',
          from: agent.phone,
          to: formattedNumber,
          startTime: Date.now(),
          duration: 0,
          status: 'voicemail-dropped',
          agentId: agent.id,
          leadId: lead.lead_id,
          action_taken: 'voicemail',
          contactName: lead.company,
        };

        const savedLog = await createOrUpdateCallOnBackend(interactionLog);

        if (savedLog) {
            dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: savedLog } });
        }
        
        toast({ title: 'Voicemail Sent', description: `Voicemail to ${formattedNumber} was sent successfully.` });
        return true;

    } catch (error: any) {
        console.error('Error sending voicemail:', error);
        toast({ title: 'Voicemail Failed', description: error.message, variant: 'destructive' });
        return false;
    }
  }, [toast, createOrUpdateCallOnBackend]);
  
  const sendMissedCallEmail = useCallback(async (lead: Lead) => {
    const agent = currentAgentRef.current;
    if (!agent) {
      toast({ title: 'Cannot Send Email', description: 'No agent is logged in.', variant: 'destructive' });
      return false;
    }

    try {
        const response = await fetch('/api/send_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                recipient_email: "test@test.com", // Placeholder
                recipient_name: lead.company,
                agent_name: agent.name,
                agent_email: agent.email,
                agent_phone: agent.phone,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Backend failed to send email');
        }

        const interactionLog: Call = {
          id: `email-${Date.now()}`,
          direction: 'outgoing',
          from: agent.email,
          to: lead.company,
          startTime: Date.now(),
          duration: 0,
          status: 'emailed',
          agentId: agent.id,
          leadId: lead.lead_id,
          action_taken: 'email',
          contactName: lead.company,
        };
        const savedLog = await createOrUpdateCallOnBackend(interactionLog);
        if (savedLog) {
            dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: savedLog } });
        }
        
        toast({ title: 'Email Sent', description: `Follow-up email sent to ${lead.company}.` });
        return true;

    } catch (error: any) {
        console.error('Error sending email:', error);
        toast({ title: 'Email Failed', description: error.message, variant: 'destructive' });
        return false;
    }
  }, [createOrUpdateCallOnBackend, toast]);

  useEffect(() => {
    if (state.currentAgent && state.twilioDeviceStatus === 'uninitialized') {
      initializeTwilio();
    }
  }, [state.currentAgent, state.twilioDeviceStatus, initializeTwilio]);

  useEffect(() => {
    if(state.currentAgent) {
        fetchAllCallHistory();
    }
  }, [state.currentAgent, fetchAllCallHistory]);

  return (
    <CallContext.Provider value={{
      state,
      dispatch,
      fetchAgents,
      addAgent,
      deleteAgent,
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
      openVoicemailDialogForLead,
      sendVoicemail,
      sendMissedCallEmail,
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
