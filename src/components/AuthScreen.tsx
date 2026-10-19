import { useState, type FormEvent } from 'react';
import { login, register } from '../lib/api';
import type { Session } from '../lib/types';

export function AuthScreen({ onAuthed }: { onAuthed: (s: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[A-Za-z0-9_.-]{2,24}$/.test(nickname)) return setError('Nickname: 2-24 letters, numbers, _ . or -');
    if (!/^\d{4,6}$/.test(pin)) return setError('PIN must be 4 to 6 digits');
    setBusy(true);
    try {
      const s = mode === 'register' ? await register(nickname, pin) : await login(nickname, pin);
      onAuthed(s);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>KirxCord</h1>
        <p className="muted">Chat without limits.</p>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Register
          </button>
        </div>
        <label className="field">
          <span>Nickname</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="username" maxLength={24} autoFocus />
        </label>
        <label className="field">
          <span>PIN (4-6 digits)</span>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary wide" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
        </button>
        {mode === 'register' && (
          <p className="muted small">Your nickname is reserved to you by your PIN. Keep the PIN safe; it cannot be recovered.</p>
        )}
      </form>
    </div>
  );
}
