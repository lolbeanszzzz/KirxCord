import { useState, type FormEvent } from 'react';
import { createServer, findUserByNickname, joinServer, openDM } from '../lib/api';
import { Avatar, ImageInput, Modal } from './common';

interface Common {
  onClose: () => void;
  onError: (e: unknown) => void;
}

export function CreateServerModal({ onClose, onCreated, onError }: Common & { onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      onCreated(await createServer(name.trim(), icon, banner));
    } catch (err) {
      onError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title="Create a server" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Server name</span>
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <ImageInput label="Server icon" folder="icons" value={icon} onChange={setIcon} onError={onError} />
        <ImageInput label="Server banner" folder="banners" value={banner} shape="wide" onChange={setBanner} onError={onError} />
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !name.trim()}>Create</button>
        </div>
      </form>
    </Modal>
  );
}

export function JoinServerModal({ onClose, onJoined, onError }: Common & { onJoined: (id: string) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      onJoined(await joinServer(code));
    } catch (err) {
      onError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title="Join a server" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Invite code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        </label>
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !code.trim()}>Join</button>
        </div>
      </form>
    </Modal>
  );
}

export function NewDMModal({ onClose, onOpened, onError }: Common & { onOpened: (channelId: string) => void }) {
  const [nick, setNick] = useState('');
  const [found, setFound] = useState<{ id: string; nickname: string; avatar_url: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await findUserByNickname(nick);
      setFound(u);
      if (!u) onError(new Error('No user with that nickname'));
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!found) return;
    setBusy(true);
    try {
      onOpened(await openDM(found.id));
    } catch (err) {
      onError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title="New direct message" onClose={onClose}>
      <form onSubmit={lookup} className="stack">
        <label className="field">
          <span>Nickname</span>
          <input value={nick} onChange={(e) => { setNick(e.target.value); setFound(null); }} autoFocus />
        </label>
        {found ? (
          <div className="row">
            <Avatar url={found.avatar_url} name={found.nickname} />
            <span>{found.nickname}</span>
          </div>
        ) : null}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          {found ? (
            <button type="button" className="btn primary" disabled={busy} onClick={start}>Open DM</button>
          ) : (
            <button className="btn primary" disabled={busy || !nick.trim()}>Find</button>
          )}
        </div>
      </form>
    </Modal>
  );
}
