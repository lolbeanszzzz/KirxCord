import { useCallback, useEffect, useState } from 'react';
import {
  getProfile,
  leaveServer,
  listChannels,
  listDMs,
  listMemberRoles,
  listMembers,
  listMyServers,
  listRoles,
} from '../lib/api';
import { computePerms } from '../lib/perms';
import { PERM, hasBits, type Channel, type DMChannel, type Member, type Profile, type Role, type Server, type Session } from '../lib/types';
import { Avatar } from './common';
import { ChatView } from './ChatView';
import { ServerSettings } from './ServerSettings';
import { UserSettings } from './UserSettings';
import { CreateServerModal, JoinServerModal, NewDMModal } from './Modals';

type View = { type: 'home' } | { type: 'server'; id: string } | { type: 'dm'; id: string };
type Modal = 'create' | 'join' | 'newdm' | 'serverSettings' | 'userSettings' | null;

const SETTINGS_BITS = PERM.MANAGE_SERVER | PERM.MANAGE_CHANNELS | PERM.MANAGE_ROLES | PERM.KICK_MEMBERS | PERM.MANAGE_WEBHOOKS | PERM.MANAGE_INVITES;

export function Shell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [dms, setDms] = useState<DMChannel[]>([]);
  const [view, setView] = useState<View>({ type: 'home' });
  const [modal, setModal] = useState<Modal>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [myRoleIds, setMyRoleIds] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberRoleMap, setMemberRoleMap] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => setError((e as Error).message);

  const refreshHome = useCallback(async () => {
    const [s, d] = await Promise.all([listMyServers(), listDMs()]);
    setServers(s);
    setDms(d);
  }, []);

  useEffect(() => {
    getProfile(session.user_id).then(setProfile).catch(fail);
    refreshHome().catch(fail);
  }, [session.user_id, refreshHome]);

  const serverId = view.type === 'server' ? view.id : null;
  const server = servers.find((s) => s.id === serverId) ?? null;

  const loadServer = useCallback(
    async (id: string) => {
      const [ch, rl, mem, mr] = await Promise.all([
        listChannels(id),
        listRoles(id),
        listMembers(id),
        listMemberRoles(id),
      ]);
      setChannels(ch);
      setRoles(rl);
      setMembers(mem);
      const map: Record<string, string[]> = {};
      mr.forEach((r) => (map[r.user_id] = [...(map[r.user_id] ?? []), r.role_id]));
      setMemberRoleMap(map);
      setMyRoleIds(map[session.user_id] ?? []);
      setChannelId((prev) => (prev && ch.some((c) => c.id === prev) ? prev : ch.find((c) => c.kind === 'text')?.id ?? null));
    },
    [session.user_id],
  );

  useEffect(() => {
    if (serverId) loadServer(serverId).catch(fail);
  }, [serverId, loadServer]);

  const perms = server ? computePerms(server, session.user_id, roles, myRoleIds) : 0;
  const isOwner = server?.owner_id === session.user_id;

  const openServer = (id: string) => {
    setChannelId(null);
    setView({ type: 'server', id });
  };

  const onLeave = async () => {
    if (!server || !window.confirm(`Leave ${server.name}?`)) return;
    try {
      await leaveServer(server.id);
      setView({ type: 'home' });
      await refreshHome();
    } catch (e) {
      fail(e);
    }
  };

  // Active text channel: a DM view or the selected server channel.
  const activeChannelId = view.type === 'dm' ? view.id : view.type === 'server' ? channelId : null;
  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;
  const activeDM = dms.find((d) => d.id === activeChannelId) ?? null;
  const canSend = view.type === 'dm' || hasBits(perms, PERM.SEND_MESSAGES);
  const canAttach = view.type === 'dm' || hasBits(perms, PERM.ATTACH_FILES);
  const canManageMessages = hasBits(perms, PERM.MANAGE_MESSAGES);

  const roleColor = (userId: string) => {
    const ids = memberRoleMap[userId] ?? [];
    return roles
      .filter((r) => !r.is_default && ids.includes(r.id))
      .sort((a, b) => b.position - a.position)[0]?.color;
  };

  return (
    <div className="app">
      <nav className="rail">
        <button className={`rail-btn ${view.type === 'home' ? 'active' : ''}`} title="Direct messages" onClick={() => setView({ type: 'home' })}>
          DM
        </button>
        <div className="rail-sep" />
        {servers.map((s) => (
          <button key={s.id} className={`rail-btn ${serverId === s.id ? 'active' : ''}`} title={s.name} onClick={() => openServer(s.id)}>
            {s.icon_url ? <img src={s.icon_url} alt="" /> : s.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <button className="rail-btn add" title="Create server" onClick={() => setModal('create')}>+</button>
        <button className="rail-btn add" title="Join server" onClick={() => setModal('join')}>↪</button>
      </nav>

      <aside className="sidebar">
        {view.type === 'home' && (
          <>
            <header className="sidebar-header">
              <span>Direct Messages</span>
              <button className="btn small" onClick={() => setModal('newdm')}>New</button>
            </header>
            <div className="sidebar-list">
              {dms.length === 0 && <p className="muted small pad">No DMs yet. Start one with New.</p>}
              {dms.map((d) => (
                <button key={d.id} className={`list-item ${activeChannelId === d.id ? 'active' : ''}`} onClick={() => setView({ type: 'dm', id: d.id })}>
                  <Avatar url={d.other?.avatar_url} name={d.other?.nickname ?? '?'} size={24} />
                  <span>{d.other?.nickname ?? 'Unknown user'}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {view.type === 'server' && server && (
          <>
            <header className="sidebar-header">
              <span className="truncate">{server.name}</span>
              {hasBits(perms, SETTINGS_BITS) && (
                <button className="icon-btn" title="Server settings" onClick={() => setModal('serverSettings')}>⚙</button>
              )}
            </header>
            <div className="sidebar-list">
              <div className="section-label">Text channels</div>
              {channels.filter((c) => c.kind === 'text').map((c) => (
                <button key={c.id} className={`list-item ${channelId === c.id ? 'active' : ''}`} onClick={() => setChannelId(c.id)}>
                  <span className="hash">#</span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
              {!isOwner && (
                <button className="list-item danger" onClick={onLeave}>Leave server</button>
              )}
            </div>
          </>
        )}

        <footer className="user-panel">
          <Avatar url={profile?.avatar_url} name={session.nickname} size={32} />
          <div className="user-meta">
            <div className="truncate">{session.nickname}</div>
            <div className="muted small truncate">{profile?.bio || 'Online'}</div>
          </div>
          <button className="icon-btn" title="User settings" onClick={() => setModal('userSettings')}>⚙</button>
        </footer>
      </aside>

      <main className="main">
        {error && (
          <div className="banner-error" onClick={() => setError(null)}>
            {error} <span className="muted">(click to dismiss)</span>
          </div>
        )}
        {activeChannelId ? (
          <ChatView
            key={activeChannelId}
            channelId={activeChannelId}
            title={view.type === 'dm' ? `@${activeDM?.other?.nickname ?? 'DM'}` : `# ${activeChannel?.name ?? ''}`}
            topic={view.type === 'server' ? activeChannel?.topic ?? '' : ''}
            canSend={canSend}
            canAttach={canAttach}
            canManageMessages={canManageMessages}
            me={{ id: session.user_id, nickname: session.nickname }}
            onError={fail}
          />
        ) : (
          <div className="empty-state">
            <h2>{view.type === 'server' ? 'No text channels' : 'Welcome to KirxCord'}</h2>
            <p className="muted">
              {view.type === 'server'
                ? 'Create a channel in server settings to start chatting.'
                : 'Create or join a server, or start a direct message.'}
            </p>
          </div>
        )}
      </main>

      {view.type === 'server' && server && (
        <aside className="members">
          <div className="section-label">Members — {members.length}</div>
          {members.map((m) => (
            <div key={m.user_id} className="member">
              <Avatar url={m.profiles.avatar_url} name={m.profiles.nickname} size={28} />
              <span className="truncate" style={{ color: roleColor(m.user_id) ?? undefined }}>
                {m.profiles.nickname}
                {m.user_id === server.owner_id && <span className="muted small"> · owner</span>}
              </span>
            </div>
          ))}
        </aside>
      )}

      {modal === 'create' && (
        <CreateServerModal
          onClose={() => setModal(null)}
          onCreated={async (id) => {
            setModal(null);
            await refreshHome().catch(fail);
            openServer(id);
          }}
          onError={fail}
        />
      )}
      {modal === 'join' && (
        <JoinServerModal
          onClose={() => setModal(null)}
          onJoined={async (id) => {
            setModal(null);
            await refreshHome().catch(fail);
            openServer(id);
          }}
          onError={fail}
        />
      )}
      {modal === 'newdm' && (
        <NewDMModal
          onClose={() => setModal(null)}
          onOpened={async (id) => {
            setModal(null);
            await refreshHome().catch(fail);
            setView({ type: 'dm', id });
          }}
          onError={fail}
        />
      )}
      {modal === 'serverSettings' && server && (
        <ServerSettings
          server={server}
          channels={channels}
          roles={roles}
          perms={perms}
          isOwner={!!isOwner}
          meId={session.user_id}
          onClose={() => setModal(null)}
          onChanged={async () => {
            await refreshHome().catch(fail);
            await loadServer(server.id).catch(fail);
          }}
          onDeleted={async () => {
            setModal(null);
            setView({ type: 'home' });
            await refreshHome().catch(fail);
          }}
          onError={fail}
        />
      )}
      {modal === 'userSettings' && profile && (
        <UserSettings
          profile={profile}
          onClose={() => setModal(null)}
          onChanged={setProfile}
          onLogout={onLogout}
          onError={fail}
        />
      )}
    </div>
  );
}
