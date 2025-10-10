

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
  id: string; // Keep as string on frontend for consistency (temp IDs, etc.)
  direction: CallDirection;
  from: string;
  to: string;
  startTime: number; // Use number (timestamp) for easier serialization
  endTime?: number;
  duration: number; // in seconds
  status: CallStatus;
  notes?: string;
  summary?: string;
  avatarUrl?: string;
  agentId: number; // Must be number to match backend
  leadId?: string;
  followUpRequired?: boolean;
  callAttemptNumber?: number;
  action_taken?: ActionTaken;
  contactName?: string;
}

export interface Lead {
  lead_id: string;
  company: string;
  website?: string;
  industry?: string;
  employees?: string;
  revenue?: string;
  yearFounded?: string;
  productCategory?: string;
  businessType?: string;
  bbbRating?: string;
  street?: string;
  city?: string;
  state?: string;
  companyPhone?: string;
  companyLinkedin?: string;
}

export interface Agent {
    id: number; // Must be number to match backend
    name: string;
    email: string;
    phone: string;
    status: string;
}

    