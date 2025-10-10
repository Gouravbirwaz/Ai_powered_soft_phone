
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

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
}

export interface Company {
  name: string;
  website: string;
  industry: string;
  product_category: string;
  business_type: string;
  employees: number;
  revenue: number;
  year_founded: number;
  bbb_rating: string;
  address: Address;
  phone: string;
  linkedin: string;
}

export interface Owner {
  first_name: string;
  last_name: string;
  title: string;
  linkedin: string;
  phone: string;
  email: string;
}

export interface LeadInfo {
  phone: string;
  source: string;
  status: string;
  is_edited: boolean;
}

export interface Lead {
  lead_id: string;
  company_id: string;
  search_keywords: string[];
  company: Company;
  owner: Owner;
  lead: LeadInfo;
}


export interface Agent {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
}

    