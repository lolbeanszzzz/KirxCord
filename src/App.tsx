import { useState } from 'react';
import { getSession, setSession } from './lib/api';
import type { Session } from './lib/types';
import { AuthScreen } from './components/AuthScreen';
import { Shell } from './components/Shell';

export default function App() {
  const [session, setCurrent] = useState<Session | null>(() => getSession());

  if (!session) {
    return <AuthScreen onAuthed={(s) => setCurrent(s)} />;
  }

  return (
    <Shell
      key={session.user_id}
      session={session}
      onLogout={() => {
        setSession(null);
        setCurrent(null);
      }}
    />
  );
}
