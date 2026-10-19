import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  ATTACHMENT_MAX_BYTES,
  deleteMessage,
  editMessage,
  listMessages,
  openChatChannel,
  sendMessage,
  uploadMedia,
  type ChatChannelHandle,
} from '../lib/api';
import { searchGifs, tenorEnabled, type TenorItem } from '../lib/tenor';
import { formatBytes, formatTime, isImageUrl, isVideoUrl, type Attachment, type Message } from '../lib/types';
import { Avatar, Modal, MAX_ATTACHMENT_LABEL, linkify } from './common';

const MAX_CONTENT = 4000;
const TYPING_MS = 3000;
const URL_ALL = /https?:\/\/[^\s<]+[^\s<.,;:!?)"']/g;

interface ChatViewProps {
  channelId: string;
  title: string;
  topic: string;
  canSend: boolean;
  canAttach: boolean;
  canManageMessages: boolean;
  me: { id: string; nickname: string };
  onError: (e: unknown) => void;
}

export function ChatView({ channelId, title, topic, canSend, canAttach, canManageMessages, me, onError }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [typers, setTypers] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [gifOpen, setGifOpen] = useState(false);
  const chatRef = useRef<ChatChannelHandle | null>(null);
  const lastTypingSent = useRef(0);
  const listEnd = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    setMessages(await listMessages(channelId));
  }, [channelId]);

  // Initial load and live updates. Broadcast only says "something changed";
  // data is always re-read through RLS-checked queries.
  useEffect(() => {
    reload().catch(onError);
    const handle = openChatChannel(channelId, {
      onNew: () => reload().catch(onError),
      onTyping: (nick) => {
        if (nick && nick !== me.nickname) setTypers((t) => ({ ...t, [nick]: Date.now() }));
      },
    });
    chatRef.current = handle;
    const prune = setInterval(() => {
      setTypers((t) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(t).filter(([, ts]) => now - ts < TYPING_MS));
        return Object.keys(next).length === Object.keys(t).length ? t : next;
      });
    }, 1000);
    return () => {
      clearInterval(prune);
      handle.close();
      chatRef.current = null;
    };
  }, [channelId, reload, me.nickname]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, channelId]);

  const notifyOthers = () => chatRef.current?.pingNew();

  const send = async () => {
    const content = text.trim();
    if (!content && attachments.length === 0) return;
    if (content.length > MAX_CONTENT) return onError(new Error(`Messages can be at most ${MAX_CONTENT} characters`));
    setBusy(true);
    try {
      await sendMessage(channelId, content, attachments);
      setText('');
      setAttachments([]);
      await reload();
      notifyOthers();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const attachFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_BYTES) return onError(new Error(`Files must be under ${MAX_ATTACHMENT_LABEL}`));
    setBusy(true);
    try {
      const url = await uploadMedia(file, 'attachments');
      setAttachments((a) => [...a, { url, name: file.name, type: file.type || 'application/octet-stream', size: file.size }]);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!busy) send();
    }
  };

  const onTextChange = (value: string) => {
    setText(value);
    if (value && Date.now() - lastTypingSent.current > TYPING_MS - 500) {
      lastTypingSent.current = Date.now();
      chatRef.current?.sendTyping(me.nickname);
    }
  };

  const saveEdit = async (id: string) => {
    try {
      await editMessage(id, editText.trim());
      setEditingId(null);
      await reload();
      notifyOthers();
    } catch (e) {
      onError(e);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await deleteMessage(id);
      await reload();
      notifyOthers();
    } catch (e) {
      onError(e);
    }
  };

  const typingNames = Object.keys(typers);

  return (
    <div className="chat">
      <header className="chat-header">
        <strong>{title}</strong>
        {topic && <span className="muted small truncate topic">{topic}</span>}
      </header>

      <div className="messages">
        {messages.length === 0 && <p className="muted pad">No messages yet. Say hello!</p>}
        {messages.map((m) => {
          const name = m.author?.nickname ?? m.author_name ?? 'Unknown';
          const own = m.author_id === me.id;
          const inlineUrls = (m.content.match(URL_ALL) ?? []).filter(isImageUrl);
          return (
            <div className="message" key={m.id}>
              <Avatar url={m.author?.avatar_url} name={name} size={36} />
              <div className="msg-body">
                <div className="msg-head">
                  <span className="msg-author">{name}</span>
                  {m.webhook_id && <span className="badge">BOT</span>}
                  <span className="muted small">{formatTime(m.created_at)}</span>
                  {m.edited_at && <span className="muted small">(edited)</span>}
                  <span className="msg-actions">
                    {own && !m.webhook_id && (
                      <button className="link-btn" onClick={() => { setEditingId(m.id); setEditText(m.content); }}>
                        Edit
                      </button>
                    )}
                    {(own || canManageMessages) && (
                      <button className="link-btn danger" onClick={() => remove(m.id)}>
                        Delete
                      </button>
                    )}
                  </span>
                </div>

                {editingId === m.id ? (
                  <div className="edit-box">
                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} />
                    <div className="row">
                      <button className="btn small primary" onClick={() => saveEdit(m.id)}>Save</button>
                      <button className="btn small" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  m.content && <div className="msg-content">{linkify(m.content)}</div>
                )}

                {inlineUrls.map((u) => (
                  <img key={u} className="media" src={u} alt="" loading="lazy" />
                ))}

                {m.attachments.map((a) => (
                  <AttachmentView key={a.url} a={a} />
                ))}
              </div>
            </div>
          );
        })}
        <div ref={listEnd} />
      </div>

      <div className="typing">
        {typingNames.length > 0 && `${typingNames.join(', ')} ${typingNames.length > 1 ? 'are' : 'is'} typing…`}
      </div>

      {canSend ? (
        <div className="composer">
          {attachments.length > 0 && (
            <div className="pending">
              {attachments.map((a, i) => (
                <span key={a.url} className="chip">
                  {a.name} {a.size ? `(${formatBytes(a.size)})` : ''}
                  <button className="link-btn" onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}>✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="composer-row">
            {canAttach && (
              <label className="icon-btn" title={`Attach a file (up to ${MAX_ATTACHMENT_LABEL})`}>
                📎
                <input hidden type="file" onChange={(e) => { attachFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
            {canAttach && tenorEnabled && (
              <button className="icon-btn" title="Add a GIF" onClick={() => setGifOpen(true)}>GIF</button>
            )}
            <textarea
              className="composer-input"
              placeholder={`Message ${title}`}
              value={text}
              rows={1}
              maxLength={MAX_CONTENT + 200}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="btn primary" disabled={busy} onClick={send}>
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="composer-disabled muted">You don't have permission to send messages here.</div>
      )}

      {gifOpen && (
        <TenorPicker
          onClose={() => setGifOpen(false)}
          onPick={(url) => {
            setAttachments((a) => [...a, { url, name: 'GIF', type: 'image/gif', size: 0 }]);
            setGifOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AttachmentView({ a }: { a: Attachment }) {
  if (a.type.startsWith('image/') || isImageUrl(a.url)) return <img className="media" src={a.url} alt={a.name} loading="lazy" />;
  if (a.type.startsWith('video/') || isVideoUrl(a.url)) return <video className="media" src={a.url} controls />;
  return (
    <a className="file-card" href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}>
      📄 {a.name} {a.size ? <span className="muted small">{formatBytes(a.size)}</span> : null}
    </a>
  );
}

function TenorPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<TenorItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      searchGifs(q)
        .then((r) => !cancelled && (setItems(r), setError(null)))
        .catch((e) => !cancelled && setError((e as Error).message))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <Modal title="GIFs (Tenor)" onClose={onClose} wide>
      <input className="field-input" placeholder="Search Tenor" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {error && <div className="error">{error}</div>}
      {loading && <p className="muted small">Loading…</p>}
      <div className="gif-grid">
        {items.map((g) => (
          <button key={g.id} className="gif-tile" onClick={() => onPick(g.url)}>
            <img src={g.preview} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
