
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
    const agent = currentAgentRef.current;
    
    // Determine direction based on whether the agent's phone matches the log's number
    // This is an assumption; might need refinement if agent has multiple numbers or logic is different
    const direction: CallDirection = log.direction || (agent && log.phone_number === agent.phone ? 'outgoing' : 'incoming');

    // Set from/to based on direction
    const from = direction === 'incoming' ? log.phone_number : (agent?.phone || 'Unknown');
    const to = direction === 'outgoing' ? log.phone_number : (agent?.phone || 'Unknown');
    
    const combinedNotes = log.notes || '';
    const summaryMarker = 'SUMMARY: ';
    const notesMarker = '\n---\nNOTES: ';
    let summary = '';
    let notes = '';

    if (combinedNotes.startsWith(summaryMarker)) {
        const notesIndex = combinedNotes.indexOf(notesMarker);
        if (notesIndex !== -1) {
            summary = combinedNotes.substring(summaryMarker.length, notesIndex);
            notes = combinedNotes.substring(notesIndex + notesMarker.length);
        } else {
            notes = combinedNotes; // Should not happen if format is consistent
        }
    } else {
        notes = combinedNotes;
    }


    return {
      id: String(log.id),
      direction,
      from,
      to,
      startTime: log.started_at ? new Date(log.started_at).getTime() : 0,
      endTime: log.ended_at ? new Date(log.ended_at).getTime() : undefined,
      duration: log.duration || 0,
      status: log.status || 'completed', // Default status, as it's not in the DB
      notes,
      summary,
      agentId: Number(log.agent_id),
      leadId: log.lead_id, 
      action_taken: log.action_taken || 'call',
      followUpRequired: log.follow_up_required || false,
      callAttemptNumber: log.call_attempt_number || 1,
      contactName: log.contact_name || (direction === 'incoming' ? from : to),
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

 const createOrUpdateCallOnBackend = useCallback(async (call: Partial<Call>) => {
    if (!call) {
      console.error("createOrUpdateCallOnBackend called with null call object");
      toast({ title: 'Logging Error', description: 'Cannot save call, data is missing.', variant: 'destructive' });
      return null;
    }
    const agentId = call.agentId || currentAgentRef.current?.id;
    if (!agentId) {
        console.error("Backend Error: Agent ID is missing.", call);
        toast({ title: 'Logging Error', description: 'Agent information is missing.', variant: 'destructive' });
        return null;
    }

    const phoneNumber = call.direction === 'outgoing' ? call.to : call.from;
    if (!phoneNumber) {
        console.error("Backend Error: Phone number is missing.", call);
        toast({ title: 'Logging Error', description: 'Phone number is missing.', variant: 'destructive' });
        return null;
    }
    
    const finalNotes = call.summary ? `SUMMARY: ${call.summary}\n---\nNOTES: ${call.notes || ''}` : call.notes;

    try {
        const body: any = {
            agent_id: Number(agentId),
            phone_number: phoneNumber,
            direction: call.direction,
            started_at: call.startTime ? new Date(call.startTime).toISOString() : undefined,
            ended_at: call.endTime ? new Date(call.endTime).toISOString() : undefined,
            duration: call.duration,
            notes: finalNotes,
            summary: call.summary,
            status: call.status,
            follow_up_required: call.followUpRequired,
            call_attempt_number: call.callAttemptNumber,
            contact_name: call.contactName,
            action_taken: call.action_taken,
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
        console.log('Call log POST successful:', responseData.call_log);
        
        // Use mapCallLog to ensure consistency
        if (responseData.call_log) {
            return mapCallLog(responseData.call_log);
        }
        return null;

    } catch (error: any) {
        console.error('Failed to post call log:', error.message);
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

  const fetchTranscript = (callSid: string): Promise<string | null> => {
    return new Promise(resolve => {
        // Wait a bit for the recording to be processed by Twilio
        setTimeout(async () => {
            try {
                const response = await fetch(`/api/twilio/transcript/${callSid}`);
                if (!response.ok) {
                    console.warn(`Could not fetch transcript for ${callSid}. Status: ${response.status}`);
                    resolve(null);
                }
                const data = await response.json();
                resolve(data.recordings?.[0]?.transcript || null);
            } catch (error) {
                console.error('Error fetching transcript:', error);
                resolve(null);
            }
        }, 5000); // 5-second delay
    });
  };
  
 const handleCallDisconnect = useCallback((twilioCall: TwilioCall | null, initialStatus: CallStatus = 'completed') => {
    // Deep copy the active call to prevent race conditions with state updates
    const callToEnd = activeCallRef.current ? JSON.parse(JSON.stringify(activeCallRef.current)) : null;

    // Immediately clear the active call UI
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: null } });
    dispatch({ type: 'SHOW_INCOMING_CALL', payload: false });
    activeTwilioCallRef.current = null;

    if (!callToEnd) {
        console.warn('handleCallDisconnect called but no active call was found in ref.');
        return;
    }

    if (initialStatus !== 'voicemail-dropped' && initialStatus !== 'emailed') {
        dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: callToEnd.id } });
    }
    
    // Perform logging and transcript fetching in the background
    (async () => {
        if (!callToEnd.startTime || isNaN(callToEnd.startTime)) {
            console.error('handleCallDisconnect: captured call has invalid startTime.', callToEnd);
            return;
        }
        
        // Use the call SID from the disconnected TwilioCall object if available, otherwise use the one from our state
        const callSid = twilioCall?.parameters.CallSid || callToEnd.id;
        
        let transcript: string | null = null;
        if ((initialStatus === 'completed' || initialStatus === 'canceled') && callSid.startsWith('CA')) {
             transcript = await fetchTranscript(callSid);
        }

        const endTime = Date.now();
        const duration = Math.round((endTime - callToEnd.startTime) / 1000);

        let finalStatus = initialStatus;
        if (finalStatus === 'completed' && duration <= 5 && callToEnd.direction === 'outgoing') {
            finalStatus = 'canceled';
        }

        const finalCallState: Call = {
            ...callToEnd,
            id: callSid, // Ensure we have the final CallSid
            status: finalStatus,
            endTime,
            duration,
            notes: transcript ? `${callToEnd.notes || ''}\n\nTRANSCRIPT:\n${transcript}`.trim() : callToEnd.notes,
        };

        const savedCall = await createOrUpdateCallOnBackend(finalCallState);

        if (savedCall) {
            // Replace the temporary call in history with the final, saved version
            dispatch({ type: 'REPLACE_IN_HISTORY', payload: { tempId: callToEnd.id, finalCall: savedCall } });
        } else {
            // If saving failed, at least update the history with the final state
            dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: finalCallState } });
        }
    })();
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
    const agent = currentAgentRef.current;
    if (!agent) {
        console.error("Incoming call received but no agent is logged in.");
        twilioCall.reject();
        return;
    }
    activeTwilioCallRef.current = twilioCall;

    // Check if this incoming call is the agent's leg of an outgoing call
    const isOutgoingLeg = activeCallRef.current?.status === 'ringing-outgoing';

    if (isOutgoingLeg && activeCallRef.current) {
        console.log('Agent leg connected for outgoing call.');
        const permanentCall: Call = {
            ...activeCallRef.current,
            id: twilioCall.parameters.CallSid,
            status: 'in-progress'
        };
        dispatch({ type: 'REPLACE_IN_HISTORY', payload: { tempId: activeCallRef.current.id, finalCall: permanentCall } });
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: permanentCall } });
    } else {
        console.log('True incoming call from', twilioCall.parameters.From);
        const callData: Call = {
          id: twilioCall.parameters.CallSid,
          from: twilioCall.parameters.From,
          to: agent.phone || '',
          direction: 'incoming',
          status: 'ringing-incoming',
          startTime: Date.now(),
          duration: 0,
          agentId: agent.id,
          action_taken: 'call',
          followUpRequired: false,
          callAttemptNumber: 1,
          contactName: 'Unknown Caller',
        };
        
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
        dispatch({ type: 'ADD_TO_HISTORY', payload: { call: callData } });
        dispatch({ type: 'SHOW_INCOMING_CALL', payload: true });
        dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });
    }

    twilioCall.on('disconnect', (call) => handleCallDisconnect(call, 'completed'));
    twilioCall.on('cancel', (call) => handleCallDisconnect(call, 'canceled'));
    twilioCall.on('reject', (call) => handleCallDisconnect(call, 'busy'));

  }, [handleCallDisconnect]);

  const initializeTwilio = useCallback(async () => {
    const agent = currentAgentRef.current;
    if (twilioDeviceRef.current || state.twilioDeviceStatus === 'initializing' || !agent) {
      return;
    }
    
    dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'initializing' } });
    
    try {
      // Request microphone permissions first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      dispatch({ type: 'SET_AUDIO_PERMISSIONS', payload: { granted: true } });

      const response = await fetch(`/api/twilio/token?identity=${agent.id}`);
      if (!response.ok) {
        throw new Error(`Failed to get a token. Status: ${response.status}.`);
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
        console.error('Twilio Device Error:', error.message, error.cause);
        dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'error' } });
        toast({ title: 'Softphone Error', description: error.message, variant: 'destructive' });
        cleanupTwilio();
      });

      device.on('incoming', handleIncomingCall);

      await device.register();
      twilioDeviceRef.current = device;

    } catch (error: any) {
      console.error('Error initializing Twilio:', error);
      const errorMessage = error.name === 'NotAllowedError' 
        ? 'Microphone permissions denied. Please enable them in your browser settings.'
        : error.message || 'Could not get a token from the server.';
      
      dispatch({ type: 'SET_TWILIO_DEVICE_STATUS', payload: { status: 'error' } });
      dispatch({ type: 'SET_AUDIO_PERMISSIONS', payload: { granted: false } });
      toast({ 
        title: 'Initialization Failed', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    }
  }, [state.twilioDeviceStatus, toast, cleanupTwilio, handleIncomingCall]);

  const startOutgoingCall = useCallback(async (to: string, contactName?: string, leadId?: string) => {
    const agent = currentAgentRef.current;
    if (!agent || state.twilioDeviceStatus !== 'ready') {
        toast({
            title: 'Softphone Not Ready',
            description: 'The softphone is not connected. Please try again.',
            variant: 'destructive'
        });
        return;
    }

    // Create a temporary call object for the UI
    const tempId = `temp_${Date.now()}`;
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
        action_taken: 'call',
        contactName: contactName || to,
    };
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
    dispatch({ type: 'ADD_TO_HISTORY', payload: { call: callData } });

    try {
        // Ask the backend to initiate the call
        const response = await fetch('/api/twilio/make_call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent_id: agent.id,
                to: to,
                lead_id: leadId,
                dialer_type: "manual", // Assuming manual dial from softphone
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ description: 'Failed to initiate call.' }));
            throw new Error(errorData.description);
        }
        
        console.log('Backend acknowledged call initiation.');
        // Now, wait for the `incoming` event on the Twilio device, which is handled by `handleIncomingCall`

    } catch (error: any) {
        console.error('Error initiating call via backend:', error);
        toast({ title: 'Call Failed', description: error.message, variant: 'destructive' });
        // Clean up the temporary call from UI
        handleCallDisconnect(null, 'failed');
    }
}, [state.twilioDeviceStatus, toast, handleCallDisconnect]);

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
  
  const fetchAgents = useCallback(async (): Promise<Agent[]> => {
    try {
      const response = await fetch('/api/agents');
      if (!response.ok) {
        throw new Error(`Failed to fetch agents. Status: ${response.status}`);
      }
      const data = await response.json();
      return (data.agents || []).map((agent: any) => ({
        ...agent,
        id: Number(agent.id)
      })) as Agent[];
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
    initializeTwilio();
  }, [fetchCallHistory, initializeTwilio]);

  const updateNotesAndSummary = useCallback(async (callId: string, notes: string, summary?: string) => {
    const callInHistory = state.allCallHistory.find(c => c.id === callId);
    
    if (callInHistory) {
      const updatedCall: Call = { ...callInHistory, notes, summary };
      
      const savedCall = await createOrUpdateCallOnBackend(updatedCall);
      if (savedCall) {
          dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: savedCall } });
          toast({ title: 'Notes Saved', description: 'Your call notes have been saved.' });
      } else {
          // Even if backend fails, update UI optimistically
          dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: updatedCall } });
          toast({ title: 'Error Saving Notes', description: 'Could not save notes to the server.', variant: 'destructive'});
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

  const sendVoicemail = useCallback((lead: Lead, script: string) => {
    const phoneNumber = lead.companyPhone;
    if (!phoneNumber) {
        toast({ title: 'Error', description: 'Lead phone number is missing.', variant: 'destructive' });
        return;
    }

    const { id: toastId, update } = toast({ title: 'Sending Voicemail...', description: `To ${lead.company || phoneNumber}` });
    
    (async () => {
      try {
          const response = await fetch('/api/twilio/send_voicemail', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: phoneNumber, script }),
          });

          if (!response.ok) {
              const error = await response.json().catch(() => ({ message: 'Failed to send voicemail' }));
              throw new Error(error.message);
          }

          const resultData = await response.json();

          if (resultData.call_log) {
              const finalLog = mapCallLog({
                  ...resultData.call_log,
                  action_taken: 'voicemail',
                  status: 'voicemail-dropped',
                  contact_name: lead.company,
              });
              dispatch({ type: 'ADD_TO_HISTORY', payload: { call: finalLog } });
              update({
                  id: toastId,
                  title: 'Voicemail Sent & Logged',
                  description: `To ${lead.company}`
              });
          } else {
              throw new Error('Backend did not return a call log.');
          }

      } catch (error: any) {
          console.error('Error sending voicemail:', error);
          update({
              id: toastId,
              title: 'Voicemail Failed',
              description: error.message,
              variant: 'destructive'
          });
      }
    })();
  }, [toast, mapCallLog]);
  
  const sendMissedCallEmail = useCallback(async (lead: Lead) => {
    const agent = currentAgentRef.current;
    if (!agent) {
      toast({ title: 'Cannot Send Email', description: 'Agent is not logged in.', variant: 'destructive' });
      return false;
    }

    const interactionLog: Partial<Call> = {
      direction: 'outgoing',
      from: agent.email,
      to: lead.companyPhone || 'N/A', 
      startTime: Date.now(),
      status: 'emailed',
      agentId: agent.id,
      leadId: lead.lead_id,
      action_taken: 'email',
      contactName: lead.company,
      duration: 0,
    };
    
    toast({ title: 'Email Feature', description: 'This lead does not have an email. Logging interaction only.', variant: 'default' });
    const savedLog = await createOrUpdateCallOnBackend(interactionLog as Call);
    if (savedLog) {
      dispatch({ type: 'ADD_TO_HISTORY', payload: { call: savedLog } });
      return true;
    }
    return false;

  }, [createOrUpdateCallOnBackend, toast]);

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
