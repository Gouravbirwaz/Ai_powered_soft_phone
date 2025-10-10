
'use client';

import type { Call, Lead, Agent, CallStatus, CallDirection, ActionTaken } from '@/lib/types';
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
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string; } }
  | { type: 'OPEN_VOICEMAIL_DIALOG'; payload: { lead: Lead } }
  | { type: 'CLOSE_VOICEMAIL_DIALOG' }
  | { type: 'SET_CURRENT_AGENT'; payload: { agent: Agent | null } }
  | { type: 'SHOW_INCOMING_CALL'; payload: boolean };

const initialState: CallState = {
  callHistory: [],
  allCallHistory: [],
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
        const isCurrentAgentCall = String(state.currentAgent?.id) === String(call.agentId);
        return {
            ...state,
            callHistory: isCurrentAgentCall ? update(state.callHistory) : state.callHistory,
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
    const isAgentOnCall = String(log.agent_id) === String(currentAgentRef.current?.id);
    const direction: CallDirection = (log.direction === 'outgoing' && isAgentOnCall) ? 'outgoing' : 'incoming';
    
    let summary = '';
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
      direction,
      from: direction === 'incoming' ? log.phone_number : (currentAgentRef.current?.phone || 'Unknown'),
      to: direction === 'outgoing' ? log.phone_number : (currentAgentRef.current?.phone || 'Unknown'),
      startTime: new Date(log.started_at).getTime(),
      endTime: log.ended_at ? new Date(log.ended_at).getTime() : undefined,
      duration: log.duration || 0,
      status: log.status || 'completed',
      notes,
      summary,
      agentId: log.agent_id,
      leadId: log.lead_id,
      action_taken: log.action_taken || 'call',
      contactName: log.contact_name,
      followUpRequired: log.follow_up_required || false,
      callAttemptNumber: log.call_attempt_number || 1,
    };
  }, []);

  const fetchCallHistory = useCallback(async (agentId: number) => {
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
    if (!call) {
        console.error("Cannot create or update call log on backend: call data is null.");
        return null;
    }
    const phoneNumber = call.direction === 'outgoing' ? call.to : call.from;
    const agentId = call.agentId || currentAgentRef.current?.id;
    
    let combinedNotes = call.notes || '';
    if (call.summary) {
        combinedNotes = `SUMMARY: ${call.summary}\n---\nNOTES: ${call.notes || ''}`;
    }

    try {
        const body: { [key: string]: any } = {
            id: call.id.startsWith('temp-') ? undefined : call.id,
            lead_id: call.leadId,
            agent_id: agentId ? parseInt(String(agentId), 10) : undefined,
            phone_number: phoneNumber,
            notes: combinedNotes,
            ended_at: call.endTime ? new Date(call.endTime).toISOString() : null,
            duration: call.duration,
            action_taken: call.action_taken, // Pass action_taken to backend
            status: call.status,
            started_at: (call.startTime && !isNaN(call.startTime)) ? new Date(call.startTime).toISOString() : new Date().toISOString(),
            contact_name: call.contactName,
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
        console.log('Call log created/updated successfully:', responseData.call_log);
        
        const returnedLog = responseData.call_log;
        // The backend does not store action_taken, so we must manually add it back
        // to the object that the frontend will use.
        if (returnedLog) {
            returnedLog.action_taken = call.action_taken;
            returnedLog.contact_name = call.contactName;
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
    twilioDeviceRef.current?.destroy();
    twilioDeviceRef.current = null;
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
        console.warn('handleCallDisconnect called but no active call in state.');
        activeTwilioCallRef.current = null;
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
        return;
    }
    
    if (initialStatus !== 'failed' && initialStatus !== 'busy' && initialStatus !== 'canceled') {
        dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'fetching-transcript' } } });
    }
    
    if (!callInState.startTime || isNaN(callInState.startTime)) {
        console.error('handleCallDisconnect: active call has invalid startTime.', callInState);
        activeTwilioCallRef.current = null;
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
        return;
    }
    
    let transcript = null;
    if ((initialStatus === 'completed' || initialStatus === 'canceled') && twilioCall) {
        transcript = await fetchTranscript(callInState.id);
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - callInState.startTime) / 1000);

    let finalStatus = initialStatus;
    if (finalStatus === 'completed' && duration <= 2) {
        finalStatus = 'canceled';
    }

    const finalCallState: Call = {
      ...callInState,
      status: finalStatus,
      endTime,
      duration,
      notes: transcript ? `${transcript}\n\n${callInState.notes || ''}`.trim() : callInState.notes || '',
    };
    
    const savedCall = await createOrUpdateCallOnBackend(finalCallState);

    if (savedCall) {
        dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: savedCall } });
        if (finalStatus !== 'voicemail-dropped' && finalStatus !== 'emailed') {
            dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: savedCall.id } });
        }
    } else {
        // Even if saving fails, update history locally
        dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: finalCallState } });
        if (finalStatus !== 'voicemail-dropped' && finalStatus !== 'emailed') {
            dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: finalCallState.id } });
        }
    }

    dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
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
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: false });
  }, []);

  const handleIncomingCall = useCallback((twilioCall: TwilioCall) => {
    console.log('Incoming call from', twilioCall.parameters.From);
    activeTwilioCallRef.current = twilioCall;
    
    const isFromBackend = twilioCall.parameters.To?.startsWith('room:');

    const callData: Call = {
      id: twilioCall.parameters.CallSid,
      from: isFromBackend ? (activeCallRef.current?.from || 'Agent') : twilioCall.parameters.From,
      to: isFromBackend ? (activeCallRef.current?.to || 'Customer') : (currentAgentRef.current?.phone || ''),
      direction: isFromBackend ? 'outgoing' : 'incoming',
      status: isFromBackend ? 'ringing-outgoing' : 'ringing-incoming',
      startTime: Date.now(),
      duration: 0,
      agentId: currentAgentRef.current!.id,
      leadId: activeCallRef.current?.leadId,
      contactName: activeCallRef.current?.contactName,
      action_taken: 'call',
      followUpRequired: false,
      callAttemptNumber: 1,
    };
    
    if (isFromBackend) {
        // This is the agent leg of an outgoing call initiated by the backend
        // We update the existing activeCall in the state
        dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { id: twilioCall.parameters.CallSid } } });
    } else {
        // This is a true incoming call
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
        dispatch({ type: 'ADD_TO_HISTORY', payload: { call: callData } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: true });
    }

    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });

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
        // Request microphone permissions before anything else
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
            description: 'No agent is logged in.',
            variant: 'destructive'
        });
        return;
    }

    try {
        const tempId = `temp-${Date.now()}`;
        const callData: Call = {
            id: tempId,
            from: agent.phone,
            to: to,
            direction: 'outgoing',
            status: 'ringing-outgoing',
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

        const backendResponse = await fetch('/api/twilio/make_call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: to, agent_id: agent.id, dialer_type: 'manual', lead_id: leadId }),
        });

        if (!backendResponse.ok) {
            const error = await backendResponse.json();
            throw new Error(error.error || 'Backend failed to initiate call.');
        }

        const { call_sid } = await backendResponse.json();
        
        const finalCallData: Call = { ...callData, id: call_sid };
        dispatch({ type: 'REPLACE_IN_HISTORY', payload: { tempId, finalCall: finalCallData } });
        dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { id: call_sid } } });


    } catch (error: any) {
        console.error('Error starting outgoing call:', error);
        toast({
            title: 'Call Failed',
            description: error.message || 'Could not start the call.',
            variant: 'destructive'
        });
        endActiveCall('failed');
    }
  }, [toast, endActiveCall]);

  const acceptIncomingCall = useCallback(() => {
    const twilioCall = activeTwilioCallRef.current;
    if (twilioCall && state.activeCall) {
      twilioCall.accept();
      dispatch({ type: 'UPDATE_ACTIVE_CALL', payload: { call: { status: 'in-progress' } } });
      dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
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
  
  const loginAsAgent = useCallback(async (agent: Agent) => {
    currentAgentRef.current = agent;
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent } });
    await initializeTwilio();
    fetchCallHistory(agent.id); 
    fetchAllCallHistory();
  }, [fetchCallHistory, fetchAllCallHistory, initializeTwilio]);

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
        const response = await fetch('/api/twilio/send_voicemail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: phoneNumber,
                script: script,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || 'Failed to send voicemail');
        }

        const { call_log } = await response.json();
        
        const finalLog = { ...mapCallLog(call_log), action_taken: 'voicemail' as ActionTaken, contactName: lead.company };
        
        dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: finalLog } });
        toast({ title: 'Voicemail Sent', description: `Voicemail to ${phoneNumber} was sent successfully.` });
        return true;

    } catch (error: any) {
        console.error('Error sending voicemail:', error);
        toast({ title: 'Voicemail Failed', description: error.message, variant: 'destructive' });
        return false;
    }
  }, [toast, mapCallLog]);
  
  const logEmailInteraction = useCallback(async (lead: Lead) => {
    const agent = currentAgentRef.current;
    if (!agent) return;

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
      toast({
        title: 'Email Logged',
        description: `Email to ${lead.company} has been logged.`,
      });
    }
  }, [createOrUpdateCallOnBackend, toast]);
  
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

        await logEmailInteraction(lead);
        toast({ title: 'Email Sent', description: `Follow-up email sent to ${lead.company}.` });
        return true;

    } catch (error: any) {
        console.error('Error sending email:', error);
        toast({ title: 'Email Failed', description: error.message, variant: 'destructive' });
        return false;
    }
  }, [logEmailInteraction, toast]);

  return (
    <CallContext.Provider value={{
      state,
      dispatch,
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
