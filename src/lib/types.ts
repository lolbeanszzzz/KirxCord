export const PERM = {
  ADMINISTRATOR: 1,
  MANAGE_SERVER: 2,
  MANAGE_CHANNELS: 4,
  MANAGE_ROLES: 8,
  KICK_MEMBERS: 16,
  MANAGE_MESSAGES: 32,
  SEND_MESSAGES: 64,
  ATTACH_FILES: 128,
  MANAGE_WEBHOOKS: 256,
  MANAGE_INVITES: 512,
} as const;

export const PERM_LABELS: Record<number, string> = {
  [PERM.ADMINISTRATOR]: 'Administrator',
  [PERM.MANAGE_SERVER]: 'Manage server',
  [PERM.MANAGE_CHANNELS]: 'Manage channels',
  [PERM.MANAGE_ROLES]: 'Manage roles',
  [PERM.KICK_MEMBERS]: 'Kick members',
  [PERM.MANAGE_MESSAGES]: 'Manage messages',
  [PERM.SEND_MESSAGES]: 'Send messages',
  [PERM.ATTACH_FILES]: 'Attach files',
  [PERM.MANAGE_WEBHOOKS]: 'Manage webhooks',
  [PERM.MANAGE_INVITES]: 'Manage invites',
};

export const hasBits = (perms: number, bit: number) =>
  (perms & PERM.ADMINISTRATOR) === PERM.ADMINISTRATOR || (perms & bit) === bit;

export interface Profile {
  id: string;
  nickname: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
}

export interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  owner_id: string;
  invite_code: string;
}

export interface Channel {
  id: string;
  server_id: string | null;
  kind: 'text' | 'dm';
  name: string;
  topic: string;
  position: number;
}

export interface Role {
  id: string;
  server_id: string;
  name: string;
  color: string;
  permissions: number;
  position: number;
  is_default: boolean;
}

export interface Member {
  user_id: string;
  profiles: Profile;
}

export interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string | null;
  author_name: string | null;
  webhook_id: string | null;
  content: string;
  attachments: Attachment[];
  created_at: string;
  edited_at: string | null;
  author: Pick<Profile, 'id' | 'nickname' | 'avatar_url'> | null;
}

export interface Webhook {
  id: string;
  server_id: string;
  channel_id: string;
  name: string;
  avatar_url: string | null;
  token: string;
}

export interface Session {
  token: string;
  user_id: string;
  nickname: string;
}

export interface DMChannel {
  id: string;
  other: Pick<Profile, 'id' | 'nickname' | 'avatar_url'> | null;
}

// Common link / media detection used by message rendering and uploads.
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)(\?.*)?$/i;
export const isImageUrl = (url: string) => IMAGE_EXT.test(url);
export const isVideoUrl = (url: string) => VIDEO_EXT.test(url);

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
