

import { type Call as TwilioCall } from '@twilio/voice-sdk';

export type CallStatus =
  | 'queued'
  | 'ringing-outgoing'
  | 'ringing-incoming'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'canceled'
  | 'voicemail-dropping'
  | 'voicemail-dropped'
  | 'fetching-transcript'
  | 'emailed';

export type CallDirection = 'incoming' | 'outgoing';

export type ActionTaken = 'call' | 'voicemail' | 'email';

export interface Call {
  id: string; 
  direction: CallDirection;
  from: string;
  to: string;
  startTime: number; 
  endTime?: number;
  duration: number; // in seconds
  status: CallStatus;
  notes?: string;
  summary?: string;
  avatarUrl?: string;
  agentId: number; 
  agentName?: string; // For display purposes
  leadId?: string;
  followUpRequired?: boolean;
  callAttemptNumber?: number;
  action_taken?: ActionTaken;
  contactName?: string;
}

export interface Lead {
  lead_id: string;
  name?: string;
  title?: string;
  phoneNumber?: string; // For the "Phone Number" column
  company: string;
  industry?: string;
  businessAddress?: string;
  email?: string; // For the "Email" column
  linkedin?: string;
  website?: string;
  employees?: string;
  yearFounded?: string;
  companyPhone?: string; // Fallback
}

export interface Agent {
    id: number;
    name: string;
    email: string;
    phone: string;
    status: string;
    role?: 'agent' | 'admin';
}

export type NewAgent = Omit<Agent, 'id' | 'status' | 'role'>;
    
