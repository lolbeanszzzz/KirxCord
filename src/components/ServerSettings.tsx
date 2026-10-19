import { useEffect, useState } from 'react';
import {
  createChannel,
  createWebhook,
  deleteChannel,
  deleteRole,
  deleteServer,
  deleteWebhook,
  kickMember,
  listMemberRoles,
  listMembers,
  listRoles,
  listWebhooks,
  resetInvite,
  saveRole,
  setMemberRoles,
  updateChannel,
  updateServer,
  WEBHOOK_EXECUTE_URL,
  webhookBody,
} from '../lib/api';
import { PERM, PERM_LABELS, hasBits, type Channel, type Member, type Role, type Server, type Webhook } from '../lib/types';
import { ImageInput, Modal } from './common';

interface Props {
  server: Server;
  channels: Channel[];
  roles: Role[];
  perms: number;
  isOwner: boolean;
  meId: string;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  onError: (e: unknown) => void;
}

type TabId = 'overview' | 'channels' | 'roles' | 'members' | 'webhooks' | 'invites';

const TABS: { id: TabId; label: string; bits: number[] }[] = [
  { id: 'overview', label: 'Overview', bits: [PERM.MANAGE_SERVER] },
  { id: 'channels', label: 'Channels', bits: [PERM.MANAGE_CHANNELS] },
  { id: 'roles', label: 'Roles', bits: [PERM.MANAGE_ROLES] },
  { id: 'members', label: 'Members', bits: [PERM.MANAGE_ROLES, PERM.KICK_MEMBERS] },
  { id: 'webhooks', label: 'Webhooks', bits: [PERM.MANAGE_WEBHOOKS] },
  { id: 'invites', label: 'Invites', bits: [PERM.MANAGE_INVITES] },
];

const PERM_LIST = Object.entries(PERM_LABELS).map(([bit, label]) => ({ bit: Number(bit), label }));

export function ServerSettings(props: Props) {
  const { server, perms, onClose, onError } = props;
  const visible = TABS.filter((t) => t.bits.some((b) => hasBits(perms, b)));
  const [tab, setTab] = useState<TabId>(visible[0]?.id ?? 'overview');

  // Wrap mutations: surface errors, then tell the shell to refresh.
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      props.onChanged();
    } catch (e) {
      onError(e);
    }
  };

  if (visible.length === 0) {
    return (
      <Modal title="Server settings" onClose={onClose}>
        <p className="muted">You don't have permission to change this server.</p>
      </Modal>
    );
  }

  return (
    <Modal title={`${server.name} — settings`} onClose={onClose} wide>
      <div className="settings">
        <nav className="settings-nav">
          {visible.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="settings-pane">
          {tab === 'overview' && <Overview {...props} run={run} />}
          {tab === 'channels' && <Channels {...props} run={run} />}
          {tab === 'roles' && <Roles {...props} run={run} />}
          {tab === 'members' && <Members {...props} run={run} />}
          {tab === 'webhooks' && <Webhooks {...props} run={run} />}
          {tab === 'invites' && <Invites {...props} run={run} />}
        </div>
      </div>
    </Modal>
  );
}

type Run = (fn: () => Promise<unknown>) => Promise<void>;

function Overview({ server, isOwner, run, onDeleted, onError }: Props & { run: Run }) {
  const [name, setName] = useState(server.name);
  useEffect(() => setName(server.name), [server.name]);
  return (
    <div className="stack">
      <label className="field">
        <span>Server name</span>
        <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn primary" disabled={!name.trim() || name === server.name} onClick={() => run(() => updateServer(server.id, { name: name.trim() }))}>
        Save name
      </button>
      <ImageInput label="Server icon" folder="icons" value={server.icon_url} onChange={(url) => run(() => updateServer(server.id, { icon_url: url }))} onError={onError} />
      <ImageInput label="Server banner" folder="banners" shape="wide" value={server.banner_url} onChange={(url) => run(() => updateServer(server.id, { banner_url: url }))} onError={onError} />
      {isOwner && (
        <div className="danger-zone">
          <h3>Delete server</h3>
          <p className="muted small">This removes the server, its channels, roles, webhooks and messages for everyone.</p>
          <button
            className="btn danger"
            onClick={async () => {
              if (!window.confirm(`Delete ${server.name} permanently?`)) return;
              try {
                await deleteServer(server.id);
                onDeleted();
              } catch (e) {
                onError(e);
              }
            }}
          >
            Delete server
          </button>
        </div>
      )}
    </div>
  );
}

function Channels({ server, channels, run }: Props & { run: Run }) {
  const [newName, setNewName] = useState('');
  return (
    <div className="stack">
      {channels.map((c) => (
        <ChannelRow key={c.id} channel={c} run={run} />
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          run(() => createChannel(server.id, newName.trim().toLowerCase().replace(/\s+/g, '-'), channels.length));
          setNewName('');
        }}
      >
        <input placeholder="new-channel" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn secondary">Create channel</button>
      </form>
    </div>
  );
}

function ChannelRow({ channel, run }: { channel: Channel; run: Run }) {
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic);
  return (
    <div className="card">
      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <button className="btn small" disabled={name === channel.name && topic === channel.topic} onClick={() => run(() => updateChannel(channel.id, { name, topic }))}>
          Save
        </button>
        <button className="btn small danger" onClick={() => window.confirm(`Delete #${channel.name}?`) && run(() => deleteChannel(channel.id))}>
          Delete
        </button>
      </div>
      <input className="wide-input" placeholder="Topic" value={topic} maxLength={1024} onChange={(e) => setTopic(e.target.value)} />
    </div>
  );
}

const BLANK_ROLE: RoleDraft = { name: '', color: '#5865f2', permissions: 0 };

interface RoleDraft {
  name: string;
  color: string;
  permissions: number;
}

function Roles({ server, roles, perms, run }: Props & { run: Run }) {
  const canManage = hasBits(perms, PERM.MANAGE_ROLES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = roles.find((r) => r.id === selectedId) ?? null;
  // One draft form for both creating and editing; saved explicitly.
  const [draft, setDraft] = useState<RoleDraft>(BLANK_ROLE);
  const editing = draft;
  const pick = (r: Role | null) => {
    setSelectedId(r?.id ?? null);
    setDraft(r ? { name: r.name, color: r.color, permissions: r.permissions } : BLANK_ROLE);
  };
  const setField = <K extends keyof RoleDraft>(key: K, value: RoleDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggleBit = (bit: number) => setDraft((d) => ({ ...d, permissions: d.permissions ^ bit }));

  return (
    <div className="split">
      <div className="split-list">
        {roles.map((r) => (
          <button key={r.id} className={`list-item ${current?.id === r.id ? 'active' : ''}`} onClick={() => pick(r)}>
            <span className="dot" style={{ background: r.color }} />
            {r.name}
            {r.is_default && <span className="muted small"> · default</span>}
          </button>
        ))}
        {canManage && (
          <button className="list-item" onClick={() => pick(null)}>
            + New role
          </button>
        )}
      </div>
      <div className="split-main stack">
        {canManage ? (
          <>
            <label className="field">
              <span>Role name</span>
              <input value={editing.name} maxLength={50} onChange={(e) => setField('name', e.target.value)} />
            </label>
            <label className="field">
              <span>Colour</span>
              <input type="color" value={editing.color ?? '#5865f2'} onChange={(e) => setField('color', e.target.value)} />
            </label>
            <div className="perm-grid">
              {PERM_LIST.map((p) => (
                <label key={p.bit} className="check">
                  <input
                    type="checkbox"
                    checked={(draft.permissions & p.bit) !== 0}
                    onChange={() => toggleBit(p.bit)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            <div className="row">
              <button
                className="btn primary"
                disabled={!editing.name.trim()}
                onClick={() =>
                  run(async () => {
                    const body = { name: draft.name.trim(), color: draft.color, permissions: draft.permissions };
                    if (current) {
                      await saveRole(server.id, { ...body, id: current.id, position: current.position });
                    } else {
                      await saveRole(server.id, { ...body, position: roles.length });
                      setDraft(BLANK_ROLE);
                    }
                  })
                }
              >
                {current ? 'Save role' : 'Create role'}
              </button>
              {current && !current.is_default && (
                <button
                  className="btn danger"
                  onClick={() => {
                    if (!window.confirm(`Delete role ${current.name}?`)) return;
                    run(() => deleteRole(current.id)).then(() => pick(null));
                  }}
                >
                  Delete role
                </button>
              )}
            </div>
            <p className="muted small">The default role applies to everyone in the server.</p>
          </>
        ) : (
          <p className="muted">You don't have permission to manage roles.</p>
        )}
      </div>
    </div>
  );
}

function Members({ server, meId, perms, run }: Props & { run: Run }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string[]>>({});
  const [reload, setReload] = useState(0);
  const canRoles = hasBits(perms, PERM.MANAGE_ROLES);
  const canKick = hasBits(perms, PERM.KICK_MEMBERS);

  useEffect(() => {
    Promise.all([listMembers(server.id), listRoles(server.id), listMemberRoles(server.id)]).then(([m, r, mr]) => {
      setMembers(m);
      setRoles(r.filter((x) => !x.is_default));
      const map: Record<string, string[]> = {};
      mr.forEach((x) => (map[x.user_id] = [...(map[x.user_id] ?? []), x.role_id]));
      setAssigned(map);
    }).catch((e) => console.error(e));
  }, [server.id, reload]);

  return (
    <div className="stack">
      {members.map((m) => (
        <div key={m.user_id} className="card">
          <div className="row">
            <strong>{m.profiles.nickname}</strong>
            {m.user_id === server.owner_id && <span className="badge">Owner</span>}
            <span className="grow" />
            {canKick && m.user_id !== server.owner_id && m.user_id !== meId && (
              <button
                className="btn small danger"
                onClick={() => {
                  if (!window.confirm(`Kick ${m.profiles.nickname}?`)) return;
                  run(() => kickMember(server.id, m.user_id)).then(() => setReload((n) => n + 1));
                }}
              >
                Kick
              </button>
            )}
          </div>
          {canRoles && (
            <div className="row wrap">
              {roles.map((r) => {
                const has = (assigned[m.user_id] ?? []).includes(r.id);
                return (
                  <label key={r.id} className="check">
                    <input
                      type="checkbox"
                      checked={has}
                      onChange={() => {
                        const current = assigned[m.user_id] ?? [];
                        const next = has ? current.filter((id) => id !== r.id) : [...current, r.id];
                        run(() => setMemberRoles(server.id, m.user_id, next)).then(() => setReload((n) => n + 1));
                      }}
                    />
                    <span className="dot" style={{ background: r.color }} />
                    {r.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Webhooks({ server, channels, perms, run }: Props & { run: Run }) {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState(channels.find((c) => c.kind === 'text')?.id ?? '');
  const [reload, setReload] = useState(0);
  const textChannels = channels.filter((c) => c.kind === 'text');
  const canManage = hasBits(perms, PERM.MANAGE_WEBHOOKS);

  useEffect(() => {
    listWebhooks(server.id).then(setHooks).catch((e) => console.error(e));
  }, [server.id, reload]);

  return (
    <div className="stack">
      <p className="muted small">
        Post messages from other apps: <code>POST {WEBHOOK_EXECUTE_URL}</code> with JSON body, e.g.{' '}
        <code>{webhookBody('TOKEN', 'Hello')}</code>. Keep tokens secret.
      </p>
      {canManage && (
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !channelId) return;
            run(() => createWebhook(server.id, channelId, name.trim())).then(() => {
              setName('');
              setReload((n) => n + 1);
            });
          }}
        >
          <input placeholder="Webhook name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
          <button className="btn secondary">Create webhook</button>
        </form>
      )}
      {hooks.map((h) => (
        <div key={h.id} className="card">
          <div className="row">
            <strong>{h.name}</strong>
            <span className="muted small">#{channels.find((c) => c.id === h.channel_id)?.name ?? '?'}</span>
            <span className="grow" />
            {canManage && (
              <button className="btn small danger" onClick={() => window.confirm(`Delete ${h.name}?`) && run(() => deleteWebhook(h.id)).then(() => setReload((n) => n + 1))}>
                Delete
              </button>
            )}
          </div>
          <code className="small break">{h.token}</code>
        </div>
      ))}
    </div>
  );
}

function Invites({ server, run }: Props & { run: Run }) {
  return (
    <div className="stack">
      <p className="muted small">Share this code so people can join with the ↪ button.</p>
      <div className="row">
        <code className="invite">{server.invite_code}</code>
        <button className="btn secondary" onClick={() => navigator.clipboard?.writeText(server.invite_code)}>Copy</button>
        <button className="btn danger" onClick={() => window.confirm('Reset the invite code? The old code stops working.') && run(() => resetInvite(server.id))}>
          Reset code
        </button>
      </div>
    </div>
  );
}
