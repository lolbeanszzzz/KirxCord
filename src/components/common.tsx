import { useState, type ReactNode } from 'react';
import { ATTACHMENT_MAX_BYTES, uploadMedia, validateImage, IMAGE_TYPES } from '../lib/api';

export function Avatar({ url, name, size = 32 }: { url: string | null | undefined; name: string; size?: number }) {
  return url ? (
    <img className="avatar" src={url} alt="" style={{ width: size, height: size }} />
  ) : (
    <div className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Image upload for avatars, banners and icons. Accepts .jpg, .webp and animated .gif. */
export function ImageInput({
  label,
  value,
  folder,
  shape = 'square',
  onChange,
  onError,
}: {
  label: string;
  value: string | null;
  folder: string;
  shape?: 'square' | 'wide';
  onChange: (url: string | null) => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) return onError(problem);
    setBusy(true);
    try {
      onChange(await uploadMedia(file, folder));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="image-input">
      <div className="label">{label}</div>
      <div className={`image-preview ${shape}`}>
        {value ? <img src={value} alt="" /> : <span className="muted">None</span>}
      </div>
      <div className="row">
        <label className="btn secondary">
          {busy ? 'Uploading…' : 'Upload'}
          <input hidden type="file" accept={IMAGE_TYPES.join(',')} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {value && (
          <button className="btn ghost" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export const MAX_ATTACHMENT_LABEL = `${Math.round(ATTACHMENT_MAX_BYTES / 1048576)} MB`;

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g;

/** Turns plain text into text with clickable links. */
export function linkify(text: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
