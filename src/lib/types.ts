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
}
