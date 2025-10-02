'use client';

import type { Call, CallDirection, CallStatus } from '@/lib/types';
import { MOCK_CALLS } from '@/lib/mock-calls';
import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useCallback,
} from 'react';
import { useToast } from '@/hooks/use-toast';

interface CallState {
  callHistory: Call[];
  activeCall: Call | null;
  softphoneOpen: boolean;
  showIncomingCall: boolean;
  showPostCallSheetForId: string | null;
}

type CallAction =
  | { type: 'TOGGLE_SOFTPHONE' }
  | { type: 'START_OUTGOING_CALL'; payload: { to: string } }
  | { type: 'SIMULATE_INCOMING_CALL' }
  | { type: 'ACCEPT_CALL' }
  | { type: 'REJECT_CALL' }
  | { type: 'END_CALL' }
  | { type: 'UPDATE_CALL_STATUS'; payload: { status: CallStatus } }
  | { type: 'UPDATE_NOTES_AND_SUMMARY'; payload: { callId: string; notes: string; summary?: string } }
  | { type: 'CLOSE_POST_CALL_SHEET' }
  | { type: 'OPEN_POST_CALL_SHEET'; payload: { callId: string } };

const initialState: CallState = {
  callHistory: MOCK_CALLS,
  activeCall: null,
  softphoneOpen: false,
  showIncomingCall: false,
  showPostCallSheetForId: null,
};

const CallContext = createContext<
  | {
      state: CallState;
      dispatch: React.Dispatch<CallAction>;
    }
  | undefined
>(undefined);

// --- SIMULATION HELPERS ---
let callInterval: NodeJS.Timeout | null = null;
const clearCallInterval = () => {
  if (callInterval) clearInterval(callInterval);
  callInterval = null;
};

const callReducer = (state: CallState, action: CallAction): CallState => {
  switch (action.type) {
    case 'TOGGLE_SOFTPHONE':
      return { ...state, softphoneOpen: !state.softphoneOpen };

    case 'START_OUTGOING_CALL': {
      if (state.activeCall) return state; // Already in a call
      const newCall: Call = {
        id: `call_${Date.now()}`,
        direction: 'outgoing',
        to: action.payload.to,
        from: 'You',
        startTime: Date.now(),
        duration: 0,
        status: 'ringing-outgoing',
      };
      return { ...state, activeCall: newCall, softphoneOpen: true };
    }
    
    case 'SIMULATE_INCOMING_CALL': {
        if (state.activeCall) return state; // Busy
        const newCall: Call = {
            id: `call_${Date.now()}`,
            direction: 'incoming',
            from: `(555) 867-5309`,
            to: 'You',
            startTime: Date.now(),
            duration: 0,
            status: 'ringing-incoming',
        };
        return { ...state, activeCall: newCall, showIncomingCall: true };
    }

    case 'ACCEPT_CALL':
      if (!state.activeCall) return state;
      return {
        ...state,
        showIncomingCall: false,
        softphoneOpen: true,
        activeCall: { ...state.activeCall, status: 'in-progress' },
      };

    case 'REJECT_CALL': {
      if (!state.activeCall) return state;
      const rejectedCall: Call = {
        ...state.activeCall,
        status: 'voicemail-dropping',
        endTime: Date.now(),
      };
      return {
        ...state,
        activeCall: null,
        showIncomingCall: false,
        callHistory: [rejectedCall, ...state.callHistory],
      };
    }
    
    case 'END_CALL': {
        if (!state.activeCall) return state;
        const endedCall: Call = {
            ...state.activeCall,
            status: 'completed',
            endTime: Date.now(),
        };
        return {
            ...state,
            activeCall: null,
            showPostCallSheetForId: endedCall.id,
            callHistory: [endedCall, ...state.callHistory]
        }
    }

    case 'UPDATE_CALL_STATUS':
      if (!state.activeCall) return state;
      return {
        ...state,
        activeCall: { ...state.activeCall, status: action.payload.status },
      };

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

    default:
      return state;
  }
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const { toast } = useToast();

  const handleCallSimulation = useCallback(() => {
    const { activeCall } = state;
    if (!activeCall) {
        clearCallInterval();
        return;
    }

    // Call progression simulation
    switch (activeCall.status) {
        case 'ringing-outgoing':
            setTimeout(() => {
                // Simulate call being answered
                if (state.activeCall?.id === activeCall.id) {
                    dispatch({ type: 'UPDATE_CALL_STATUS', payload: { status: 'in-progress' } });
                }
            }, 3000);
            break;

        case 'in-progress':
            if (!callInterval) {
                callInterval = setInterval(() => {
                    if (state.activeCall?.status === 'in-progress') {
                        // This would be done in a real scenario by reading a stream, but we just increment
                        state.activeCall.duration += 1;
                    }
                }, 1000);
            }
            break;
    }
  }, [state.activeCall]);

  React.useEffect(() => {
      handleCallSimulation();
      return () => clearCallInterval();
  }, [state.activeCall, handleCallSimulation]);

  // Voicemail simulation
  React.useEffect(() => {
    const voicemailCall = state.callHistory.find(c => c.status === 'voicemail-dropping');
    if (voicemailCall) {
      toast({ title: 'Agent unavailable', description: 'Dropping pre-recorded voicemail...' });
      setTimeout(() => {
        dispatch({ type: 'UPDATE_NOTES_AND_SUMMARY', payload: { callId: voicemailCall.id, notes: 'Auto-voicemail dropped.' } });
        const updatedHistory = state.callHistory.map(c => c.id === voicemailCall.id ? {...c, status: 'voicemail-dropped'} as Call : c);
        // This is a bit of a hack to update the history without a dedicated reducer action
        // In a real app, this would be handled more cleanly.
        // For now, we will just update the state directly to trigger a re-render
        (state.callHistory as any) = updatedHistory;
        toast({ title: 'Voicemail Left', description: 'Voicemail was successfully left.' });
      }, 3000);
    }
  }, [state.callHistory, toast]);


  return (
    <CallContext.Provider value={{ state, dispatch }}>
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
