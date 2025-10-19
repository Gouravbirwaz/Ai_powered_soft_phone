
'use client';

import { CallProvider, useCall } from '@/contexts/call-context';
import { Toaster } from '@/components/ui/toaster';
import Softphone from '@/components/softphone';
import IncomingCallDialog from '@/components/incoming-call-dialog';
import PostCallSheet from '@/components/post-call-sheet';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import VoicemailDialog from './voicemail-dialog';
import { useRouter, useSearchParams } from 'next/navigation';

function AppShell({ children }: { children: React.ReactNode }) {
  const { state, updateAgent } = useCall();
  const postCall = state.showPostCallSheetForId ? state.callHistory.find(c => c.id === state.showPostCallSheetForId) : null;
  const pathname = usePathname();

  const showSoftphone = state.currentAgent && pathname !== '/login';

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state.currentAgent && updateAgent) {
        const url = `/api/agents/${state.currentAgent.id}`;
        const data = JSON.stringify({ status: 'inactive' });
        navigator.sendBeacon(url, data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.currentAgent, updateAgent]);

  return (
    <>
      {children}
      {showSoftphone && <Softphone />}
      <Toaster />
      {state.showIncomingCall && state.activeCall && <IncomingCallDialog call={state.activeCall} />}
      {postCall && <PostCallSheet call={postCall} />}
      <VoicemailDialog />

    </>
  );
}


export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <CallProvider>
      <AppShell>
        {children}
      </AppShell>
    </CallProvider>
  );
}
