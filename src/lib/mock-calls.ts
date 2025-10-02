import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Call } from '@/lib/types';

const now = Date.now();
const randomAvatar = () =>
  PlaceHolderImages[Math.floor(Math.random() * PlaceHolderImages.length)]
    .imageUrl;

export const MOCK_CALLS: Call[] = [
  {
    id: '1',
    direction: 'outgoing',
    from: 'You',
    to: '(201) 555-0123',
    startTime: now - 1000 * 60 * 5,
    endTime: now - 1000 * 60 * 3,
    duration: 120,
    status: 'completed',
    notes: 'Followed up on the support ticket. Customer is satisfied.',
    summary:
      'Agent followed up on a support ticket. The customer confirmed their issue is resolved and they are satisfied with the solution provided.',
    avatarUrl: randomAvatar(),
  },
  {
    id: '2',
    direction: 'incoming',
    from: '(305) 555-0187',
    to: 'You',
    startTime: now - 1000 * 60 * 25,
    endTime: now - 1000 * 60 * 24,
    duration: 60,
    status: 'voicemail-dropped',
    avatarUrl: randomAvatar(),
  },
  {
    id: '3',
    direction: 'outgoing',
    from: 'You',
    to: '(415) 555-0199',
    startTime: now - 1000 * 60 * 50,
    duration: 0,
    status: 'failed',
    avatarUrl: randomAvatar(),
  },
  {
    id: '4',
    direction: 'incoming',
    from: '(212) 555-0145',
    to: 'You',
    startTime: now - 1000 * 60 * 120,
    endTime: now - 1000 * 60 * 110,
    duration: 600,
    status: 'completed',
    notes:
      'Customer called with questions about the new pricing plan. Explained the benefits and sent a follow-up email with details.',
    avatarUrl: randomAvatar(),
  },
  {
    id: '5',
    direction: 'outgoing',
    from: 'You',
    to: '(702) 555-0158',
    startTime: now - 1000 * 60 * 180,
    duration: 0,
    status: 'busy',
    avatarUrl: randomAvatar(),
  },
];
