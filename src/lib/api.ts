import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Attachment, Channel, DMChannel, Member, Message, Profile, Role, Server, Session, Webhook } from './types';

const SESSION_KEY = 'kirxcord.session';

export const getSession = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
};
export const setSession = (s: Session | null) =>
  s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY);

export const me = () => {
  const s = getSession();
  if (!s) throw new Error('Not signed in');
  return s.user_id;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. See .env.example');
}

// Every request carries the session token so RLS can identify the user.
const sessionFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  const s = getSession();
  if (s) headers.set('x-session-token', s.token);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_KEY ?? '', {
  global: { fetch: sessionFetch },
  auth: { persistSession: false, autoRefreshToken: false },
});

const check = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
};

const PROFILE_COLS = 'id, nickname, bio, avatar_url, banner_url';

// ------------------------------------------------------------------ auth ----
export async function register(nickname: string, pin: string): Promise<Session> {
  const data = check(await supabase.rpc('register_account', { p_nickname: nickname, p_pin: pin }));
  const s = data as unknown as Session;
  setSession(s);
  return s;
}

export async function login(nickname: string, pin: string): Promise<Session> {
  const data = check(await supabase.rpc('login_account', { p_nickname: nickname, p_pin: pin })) as unknown as
    | Session
    | { error: string };
  if ('error' in data) throw new Error(data.error);
  setSession(data);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await supabase.rpc('logout_account');
  } finally {
    setSession(null);
  }
}

// -------------------------------------------------------------- profiles ----
export async function getProfile(id: string): Promise<Profile> {
  return check(await supabase.from('profiles').select(PROFILE_COLS).eq('id', id).single()) as Profile;
}

export async function findUserByNickname(nickname: string): Promise<Profile | null> {
  return check(
    await supabase.from('profiles').select(PROFILE_COLS).ilike('nickname', nickname.trim()).maybeSingle(),
  ) as Profile | null;
}

export async function updateProfile(patch: Partial<Pick<Profile, 'bio' | 'avatar_url' | 'banner_url'>>) {
  check(await supabase.from('profiles').update(patch).eq('id', me()));
}

// ---------------------------------------------------------------- uploads ----
export const IMAGE_TYPES = ['image/jpeg', 'image/webp', 'image/gif'];
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);

/** Uploads a file (blob) into the public `media` bucket and returns its public URL. */
export async function uploadMedia(file: File, folder: string): Promise<string> {
  const path = `${me()}/${folder}/${Date.now()}-${safeName(file.name)}`;
  check(await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: false }));
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/** Avatars, banners and icons: .jpg, .webp or .gif only (animated GIFs kept as-is). */
export function validateImage(file: File, maxBytes = IMAGE_MAX_BYTES): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Only .jpg, .webp and .gif images are allowed';
  if (file.size > maxBytes) return `Image must be under ${Math.round(maxBytes / 1048576)} MB`;
  return null;
}

// ---------------------------------------------------------------- servers ----
export async function listMyServers(): Promise<Server[]> {
  const rows = check(
    await supabase.from('server_members').select('servers(*)').eq('user_id', me()),
  ) as unknown as { servers: Server }[];
  return rows.map((r) => r.servers).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getServer(id: string): Promise<Server> {
  return check(await supabase.from('servers').select('*').eq('id', id).single()) as Server;
}

export async function createServer(name: string, icon: string | null, banner: string | null): Promise<string> {
  return check(await supabase.rpc('create_server', { p_name: name, p_icon: icon, p_banner: banner })) as string;
}

export async function joinServer(code: string): Promise<string> {
  return check(await supabase.rpc('join_server', { p_code: code.trim() })) as string;
}

export async function leaveServer(serverId: string) {
  check(await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', me()));
}

export async function updateServer(id: string, patch: Partial<Pick<Server, 'name' | 'icon_url' | 'banner_url'>>) {
  check(await supabase.from('servers').update(patch).eq('id', id));
}

export async function deleteServer(id: string) {
  check(await supabase.from('servers').delete().eq('id', id));
}

export async function resetInvite(serverId: string): Promise<string> {
  return check(await supabase.rpc('reset_invite', { p_server: serverId })) as string;
}

// --------------------------------------------------------------- channels ----
export async function listChannels(serverId: string): Promise<Channel[]> {
  return check(
    await supabase.from('channels').select('*').eq('server_id', serverId).order('position').order('created_at'),
  ) as Channel[];
}

export async function createChannel(serverId: string, name: string, position: number) {
  check(await supabase.from('channels').insert({ server_id: serverId, kind: 'text', name, position }));
}

export async function updateChannel(id: string, patch: Partial<Pick<Channel, 'name' | 'topic' | 'position'>>) {
  check(await supabase.from('channels').update(patch).eq('id', id));
}

export async function deleteChannel(id: string) {
  check(await supabase.from('channels').delete().eq('id', id));
}

// ------------------------------------------------------------------ roles ----
export async function listRoles(serverId: string): Promise<Role[]> {
  return check(
    await supabase.from('roles').select('*').eq('server_id', serverId).order('position'),
  ) as Role[];
}

export async function saveRole(serverId: string, role: Partial<Role> & { name: string }) {
  if (role.id) {
    const { id, ...rest } = role;
    check(await supabase.from('roles').update(rest).eq('id', id));
  } else {
    check(await supabase.from('roles').insert({ ...role, server_id: serverId }));
  }
}

export async function deleteRole(id: string) {
  check(await supabase.from('roles').delete().eq('id', id));
}

export async function listMembers(serverId: string): Promise<Member[]> {
  return check(
    await supabase
      .from('server_members')
      .select(`user_id, profiles(${PROFILE_COLS})`)
      .eq('server_id', serverId)
      .order('joined_at'),
  ) as unknown as Member[];
}

export async function listMemberRoles(serverId: string): Promise<{ user_id: string; role_id: string }[]> {
  return check(await supabase.from('member_roles').select('user_id, role_id').eq('server_id', serverId));
}

export async function setMemberRoles(serverId: string, userId: string, roleIds: string[]) {
  check(await supabase.from('member_roles').delete().eq('server_id', serverId).eq('user_id', userId));
  if (roleIds.length) {
    check(
      await supabase
        .from('member_roles')
        .insert(roleIds.map((role_id) => ({ server_id: serverId, user_id: userId, role_id }))),
    );
  }
}

export async function kickMember(serverId: string, userId: string) {
  check(await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', userId));
}

// -------------------------------------------------------------------- DMs ----
export async function listDMs(): Promise<DMChannel[]> {
  const rows = check(
    await supabase.from('channels').select('id, dm_members(user_id, profiles(id, nickname, avatar_url))').eq('kind', 'dm'),
  ) as unknown as { id: string; dm_members: { user_id: string; profiles: DMChannel['other'] }[] }[];
  const mine = me();
  return rows.map((r) => ({
    id: r.id,
    other: r.dm_members.find((m) => m.user_id !== mine)?.profiles ?? null,
  }));
}

export async function openDM(userId: string): Promise<string> {
  return check(await supabase.rpc('open_dm', { p_user: userId })) as string;
}

// --------------------------------------------------------------- messages ----
const MESSAGE_SELECT = '*, author:profiles(id, nickname, avatar_url)';

export async function listMessages(channelId: string): Promise<Message[]> {
  const rows = check(
    await supabase
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(100),
  ) as unknown as Message[];
  return rows.reverse();
}

export async function sendMessage(channelId: string, content: string, attachments: Attachment[] = []) {
  check(
    await supabase.from('messages').insert({ channel_id: channelId, author_id: me(), content, attachments }),
  );
}

export async function editMessage(id: string, content: string) {
  check(await supabase.from('messages').update({ content, edited_at: new Date().toISOString() }).eq('id', id));
}

export async function deleteMessage(id: string) {
  check(await supabase.from('messages').delete().eq('id', id));
}

// --------------------------------------------------------------- webhooks ----
export async function listWebhooks(serverId: string): Promise<Webhook[]> {
  return check(await supabase.from('webhooks').select('*').eq('server_id', serverId).order('created_at')) as Webhook[];
}

export async function createWebhook(serverId: string, channelId: string, name: string) {
  check(await supabase.from('webhooks').insert({ server_id: serverId, channel_id: channelId, name, created_by: me() }));
}

export async function deleteWebhook(id: string) {
  check(await supabase.from('webhooks').delete().eq('id', id));
}

/** Public POST endpoint for a webhook. Body: { "p_token": token, "p_content": "text" }. */
export const WEBHOOK_EXECUTE_URL = `${SUPABASE_URL}/rest/v1/rpc/execute_webhook`;
export const webhookBody = (token: string, content: string) => JSON.stringify({ p_token: token, p_content: content });

// ---------------------------------------------------------------- realtime ----
export interface ChatChannelHandle {
  pingNew(): void;
  sendTyping(nickname: string): void;
  close(): void;
}

/** Broadcast-based live updates. Broadcast carries only "something changed"
 *  pings and typing hints; the actual data always comes back through RLS-checked queries. */
export function openChatChannel(
  channelId: string,
  handlers: { onNew: () => void; onTyping: (nickname: string) => void },
): ChatChannelHandle {
  const ch: RealtimeChannel = supabase
    .channel(`chat:${channelId}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'new' }, () => handlers.onNew())
    .on('broadcast', { event: 'typing' }, ({ payload }) => handlers.onTyping(String(payload?.nickname ?? '')))
    .subscribe();
  return {
    pingNew: () => void ch.send({ type: 'broadcast', event: 'new', payload: {} }),
    sendTyping: (nickname) => void ch.send({ type: 'broadcast', event: 'typing', payload: { nickname } }),
    close: () => void supabase.removeChannel(ch),
  };
}
