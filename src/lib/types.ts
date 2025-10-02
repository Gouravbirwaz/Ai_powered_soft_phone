
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
  | 'voicemail-dropped';

export type CallDirection = 'incoming' | 'outgoing';

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
}

export interface Lead {
    bbb_rating: string;
    business_type: string;
    city: string;
    company: string;
    company_id: string;
    company_linkedin: string;
    company_phone: string;
    country: string;
    created_at: string;
    deleted: boolean;
    deleted_at: string | null;
    draft_data: {
        note: string;
    };
    edited_at: string | null;
    edited_by: string | null;
    employees: number;
    industry: string;
    is_edited: boolean;
    lead_id: string;
    owner_email: string;
    owner_first_name: string;
    owner_last_name: string;
    owner_linkedin: string;
    owner_phone_number: string;
    owner_title: string;
    phone: string;
    product_category: string;
    revenue: number;
    search_keyword: {
        keywords: string[];
    };
    source: string;
    state: string;
    status: string;
    street: string;
    updated_at: string;
    website: string;
    year_founded: string;
}

export interface Agent {
    id: number;
    name: string;
    email: string;
    phone: string;
    status: string;
}
