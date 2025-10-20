
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
import { formatUSPhoneNumber } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type TwilioDeviceStatus = 'uninitialized' | 'initializing' | 'ready' | 'error';
type LoginRole = 'agent' | 'admin';

interface QueuedCall {
    to: string;
    contactName?: string;
    leadId?: string;
}

interface CallState {
  callHistory: Call[];
  allCallHistory: Call[]; // To track all calls for lead status
  agents: Agent[];
  activeCall: Call | null;
  softphoneOpen: boolean;
  showIncomingCall: boolean;
  showPostCallSheetForId: string | null;
  voicemailLeadTarget: Lead | null;
  currentAgent: Agent | null;
}

type CallAction =
  | { type: 'TOGGLE_SOFTPHONE' }
  | { type: 'SET_SOFTPHONE_OPEN'; payload: boolean }
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
  | { type: 'UPDATE_AGENT'; payload: { agent: Partial<Agent> & Pick<Agent, 'id'> } }
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
  currentAgent: null,
};

const callReducer = (state: CallState, action: CallAction): CallState => {
  const sortHistory = (history: Call[]) => history.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

  switch (action.type) {
    case 'TOGGLE_SOFTPHONE':
      return { ...state, softphoneOpen: !state.softphoneOpen };
    case 'SET_SOFTPHONE_OPEN':
      return { ...state, softphoneOpen: action.payload };
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
            callHistory: sortHistory(newHistory),
            allCallHistory: sortHistory(newAllHistory),
        };
    }
    case 'UPDATE_IN_HISTORY': {
        const { call } = action.payload;
        const update = (history: Call[]) => {
            const index = history.findIndex(c => c.id === call.id);
            if (index === -1) {
              // If not found, add it. This handles cases where a call object was created
              // but didn't make it into history for some reason (e.g. race conditions)
              return sortHistory([call, ...history]);
            }
            const newHistory = [...history];
            newHistory[index] = { ...newHistory[index], ...call };
            return sortHistory(newHistory);
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
            callHistory: sortHistory(replace(state.callHistory)),
            allCallHistory: sortHistory(replace(state.allCallHistory)),
        }
    }
    case 'SET_CALL_HISTORY':
        return { ...state, callHistory: sortHistory(action.payload) };
    case 'SET_ALL_CALL_HISTORY':
        return { ...state, allCallHistory: sortHistory(action.payload) };
    case 'SET_AGENTS':
        return { ...state, agents: action.payload };
    case 'ADD_AGENT':
        return { ...state, agents: [...state.agents, action.payload] };
     case 'REMOVE_AGENT':
        return { ...state, agents: state.agents.filter(a => a.id !== action.payload.agentId) };
    case 'UPDATE_AGENT': {
        const { agent } = action.payload;
        return {
            ...state,
            agents: state.agents.map(a => a.id === agent.id ? { ...a, ...agent } : a),
        };
    }
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
  const currentAgentRef = useRef<Agent | null>(null);

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
      score_given: log.score_given,
    };
  }, []);

  const fetchAllCallHistory = useCallback(async () => {
    // Admin always re-fetches. Agent data is filtered later.
    try {
      const url = '/api/twilio/call_logs';
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Failed to fetch all call history. Status: ${response.status}`);
      }
      const data = await response.json();
      const formattedCalls: Call[] = (data.call_logs || []).map(mapCallLog);
      dispatch({ type: 'SET_ALL_CALL_HISTORY', payload: formattedCalls });
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
  }, [toast, mapCallLog]);


 const createOrUpdateCallOnBackend = useCallback(async (call: Call | null) => {
    if (!call) {
        console.error("Cannot create or update call log on backend: call data is null.");
        return null;
    }
    const agentId = call.agentId || currentAgentRef.current?.id;

    // Prevent sending logs for hardcoded admin users
    if (agentId && [998, 999].includes(Number(agentId))) {
        console.log(`Bypassing call log for admin user ${agentId}.`);
        return call; // Return the call data without saving to backend
    }
    
    const phoneNumber = call.direction === 'outgoing' ? call.to : call.from;
    
    if (!agentId || !phoneNumber) {
        console.error("Cannot create call log: agentId or phoneNumber is missing.", { agentId, phoneNumber });
        return null;
    }
    
    try {
        const combinedNotes = call.summary ? `SUMMARY: ${call.summary}\n---\nNOTES: ${call.notes || ''}` : call.notes || '';

        const leadIdInt = call.leadId ? parseInt(call.leadId, 10) : undefined;

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
            lead_id: leadIdInt && !isNaN(leadIdInt) ? leadIdInt : undefined,
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

  const startOutgoingCall = useCallback(async (to: string, contactName?: string, leadId?: string) => {
    const agent = currentAgentRef.current;
    if (!agent) {
        toast({ title: 'Softphone Not Ready', description: 'No agent logged in.', variant: 'destructive' });
        return;
    }
    
    dispatch({ type: 'SET_SOFTPHONE_OPEN', payload: true });

    const formattedNumber = formatUSPhoneNumber(to);
    const tempId = `temp-${Date.now()}`;
    const callData: Call = {
        id: tempId, from: agent.phone, to: formattedNumber, direction: 'outgoing', status: 'ringing-outgoing',
        startTime: Date.now(), duration: 0, agentId: agent.id, leadId, contactName,
        action_taken: 'call', followUpRequired: false, callAttemptNumber: 1,
    };
    
    dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: callData } });
    dispatch({ type: 'ADD_TO_HISTORY', payload: { call: callData } });

    try {
        const response = await fetch('/api/twilio/make_call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_id: agent.id, to: formattedNumber }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to initiate call.');
        }

        const { call_sid } = await response.json();
        const permanentCall: Call = { ...callData, id: call_sid };

        dispatch({ type: 'REPLACE_IN_HISTORY', payload: { tempId, finalCall: permanentCall } });
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: permanentCall } });
        
        toast({ title: 'Calling...', description: `Calling ${contactName || formattedNumber}`});

    } catch (error: any) {
        console.error('Error starting outgoing call:', error);
        toast({ title: 'Call Failed', description: error.message, variant: 'destructive' });
        
        const failedCall: Call = { ...callData, status: 'failed', endTime: Date.now() };
        dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: failedCall }});
        dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: failedCall } });
    }
  }, [toast]);
  
  const fetchAgents = useCallback(async (): Promise<Agent[]> => {
    try {
      const response = await fetch('/api/agents');
      if (!response.ok) {
        console.warn(`Failed to fetch agents. Status: ${response.status}`);
        return [];
      }
      const data = await response.json();
      const agents = (data.agents || []).map((agent: any) => ({
        ...agent,
        score_given: agent.score_given,
      })) as Agent[];
      dispatch({ type: 'SET_AGENTS', payload: agents });
      return agents;
    } catch (error: any) {
      console.error("Fetch agents error:", error);
      return [];
    }
  }, []);

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

        const { agent } = await response.json();
        
        dispatch({ type: 'ADD_AGENT', payload: agent });
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

  const updateAgent = useCallback(async (agentId: number, data: Partial<Agent>): Promise<boolean> => {
    try {
        const response = await fetch(`/api/agents/${agentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Failed to update agent. Status: ${response.status}`);
        }
        
        const updatedAgent = await response.json();
        dispatch({ type: 'UPDATE_AGENT', payload: { agent: { id: agentId, ...updatedAgent } } });
        return true;
    } catch (error: any) {
        // Don't show toast for background updates like status changes
        console.error(`Failed to update agent ${agentId}:`, error.message);
        return false;
    }
  }, []);

  const updateAgentScore = useCallback(async (agentId: number, score: number): Promise<boolean> => {
    try {
        const response = await fetch(`/api/agents/grade/${agentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: score }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ details: "Failed to save score." }));
            throw new Error(error.details || `Failed to update score. Status: ${response.status}`);
        }

        const updatedAgent = await response.json();
        dispatch({ type: 'UPDATE_AGENT', payload: { agent: { id: agentId, score_given: updatedAgent.score_given } } });
        toast({ title: 'Score Saved', description: 'The agent\'s score has been updated.' });
        return true;
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error Saving Score',
            description: error.message,
        });
        return false;
    }
  }, [toast]);
  
  const loginAsAgent = useCallback(async (agent: Agent, role: LoginRole) => {
    const agentWithRole = { ...agent, role };
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent: agentWithRole } });
    
    // Only update status for real agents, not hardcoded admins
    if (role === 'agent') {
        await updateAgent(agent.id, { status: 'active' });
    }
    
    // Refresh all data on login
    dispatch({ type: 'SET_ALL_CALL_HISTORY', payload: [] });
    dispatch({ type: 'SET_AGENTS', payload: [] });
    await fetchAllCallHistory();
    await fetchAgents();

  }, [fetchAllCallHistory, fetchAgents, updateAgent]);

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

  const logout = useCallback(async () => {
    if (currentAgentRef.current && currentAgentRef.current.role === 'agent') {
      await updateAgent(currentAgentRef.current.id, { status: 'inactive' });
    }
    dispatch({ type: 'SET_CURRENT_AGENT', payload: { agent: null } });
    dispatch({ type: 'SET_CALL_HISTORY', payload: [] });
    dispatch({ type: 'SET_ALL_CALL_HISTORY', payload: [] });
    dispatch({ type: 'SET_AGENTS', payload: [] });
  }, [updateAgent]);

  const openVoicemailDialogForLead = useCallback((lead: Lead) => {
    dispatch({ type: 'OPEN_VOICEMAIL_DIALOG', payload: { lead } });
  }, []);

  const sendVoicemail = useCallback((lead: Lead, script: string) => {
    const agent = currentAgentRef.current;
    const phoneNumber = lead.phoneNumber || lead.companyPhone;

    if (!agent || !phoneNumber) {
        toast({ title: 'Error', description: 'Agent or lead phone number is missing.', variant: 'destructive' });
        return;
    }

    const formattedNumber = formatUSPhoneNumber(phoneNumber);
    toast({ title: 'Voicemail Sending...', description: `Sending to ${formattedNumber}.` });

    fetch('/api/twilio/send_voicemail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedNumber, script: script }),
    })
    .then(async (response) => {
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || 'Failed to send voicemail');
        }
        return response.json();
    })
    .then(responseData => {
        const interactionLog: Call = {
            id: responseData.call_sid || `voicemail-${Date.now()}`,
            direction: 'outgoing', from: agent.phone, to: formattedNumber,
            startTime: Date.now(), duration: 0, status: 'voicemail-dropped',
            agentId: agent.id, leadId: lead.lead_id, action_taken: 'voicemail',
            contactName: lead.company,
        };
        return createOrUpdateCallOnBackend(interactionLog);
    })
    .then(savedLog => {
        if (savedLog) {
            dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: savedLog } });
        }
    })
    .catch(error => {
        console.error('Error sending voicemail:', error);
        toast({ title: 'Voicemail Failed', description: error.message, variant: 'destructive' });
    });
  }, [toast, createOrUpdateCallOnBackend]);
  
  const sendMissedCallEmail = useCallback((lead: Lead) => {
    const agent = currentAgentRef.current;
    if (!agent) {
      toast({ title: 'Cannot Send Email', description: 'No agent is logged in.', variant: 'destructive' });
      return;
    }
    
    if (!lead.email) {
      toast({ title: 'Cannot Send Email', description: `No email address found for ${lead.company}.`, variant: 'destructive' });
      return;
    }
    
    toast({ title: 'Sending Email...', description: `Sending follow-up to ${lead.company}.` });

    fetch('/api/send_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lead.email, name: lead.name || lead.company }),
    })
    .then(async response => {
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Backend failed to send email');
        }
        return response.json();
    })
    .then(() => {
        const interactionLog: Call = {
            id: `email-${Date.now()}`, direction: 'outgoing', from: agent.email,
            to: lead.company, startTime: Date.now(), duration: 0, status: 'emailed',
            agentId: agent.id, leadId: lead.lead_id, action_taken: 'email',
            contactName: lead.name || lead.company,
        };
        return createOrUpdateCallOnBackend(interactionLog);
    })
    .then(savedLog => {
        if (savedLog) {
            dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: savedLog } });
        }
    })
    .catch(error => {
        console.error('Error sending email:', error);
        toast({ title: 'Email Failed', description: error.message, variant: 'destructive' });
    });
  }, [createOrUpdateCallOnBackend, toast]);
  
  const endActiveCall = useCallback((status: CallStatus = 'completed') => {
      const { activeCall } = state;
      if (!activeCall) return;

      const updatedCall: Call = {
          ...activeCall,
          status,
          endTime: Date.now(),
          duration: Math.round((Date.now() - activeCall.startTime) / 1000)
      };

      dispatch({ type: 'SET_ACTIVE_CALL', payload: { call: updatedCall } });
      createOrUpdateCallOnBackend(updatedCall).then(savedCall => {
          if (savedCall) {
              dispatch({ type: 'UPDATE_IN_HISTORY', payload: { call: savedCall } });
              dispatch({ type: 'OPEN_POST_CALL_SHEET', payload: { callId: savedCall.id } });
          }
      });
  }, [state.activeCall, createOrUpdateCallOnBackend]);


  return (
    <CallContext.Provider value={{
      state,
      dispatch,
      fetchAgents,
      addAgent,
      deleteAgent,
      updateAgent,
      updateAgentScore,
      fetchAllCallHistory,
      loginAsAgent,
      logout,
      startOutgoingCall,
      endActiveCall,
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

    