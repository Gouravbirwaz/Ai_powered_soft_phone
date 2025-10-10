
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
  startTime: number; // Use number (timestamp) for easier serialization
  endTime?: number;
  duration: number; // in seconds
  status: CallStatus;
  notes?: string;
  summary?: string;
  avatarUrl?: string;
  agentId?: string;
  leadId?: string;
  followUpRequired?: boolean;
  callAttemptNumber?: number;
  action_taken?: ActionTaken;
}

export interface Lead {
  lead_id: string;
  company: string;
  search_keyword: string;
  website: string;
  industry: string;
  product_category: string;
  business_type: string;
  employees: string;
  revenue: string;
  year_founded: string;
  bbb_rating: string;
  street: string;
  city: string;
  state: string;
  country: string;
  company_linkedin: string;
  company_phone: string;
  owner_first_name: string;
  owner_last_name: string;
  owner_title: string;
  owner_linkedin: string;
  owner_phone_number: string;
  owner_email: string;
  source: string;
  status: string;
  is_edited: string;
  edited_by: string;
}


export interface Agent {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
}
