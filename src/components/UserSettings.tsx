import { useState } from 'react';
import { logout, updateProfile } from '../lib/api';
import type { Profile } from '../lib/types';
import { Avatar, ImageInput, Modal } from './common';

interface Props {
  profile: Profile;
  onClose: () => void;
  onChanged: (p: Profile) => void;
  onLogout: () => void;
  onError: (msg: string) => void;
}

export function UserSettings({ profile, onClose, onChanged, onLogout, onError }: Props) {
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saving, setSaving] = useState(false);

  const patch = async (p: Partial<Pick<Profile, 'bio' | 'avatar_url' | 'banner_url'>>) => {
    try {
      await updateProfile(p);
      onChanged({ ...profile, ...p });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const saveBio = async () => {
    setSaving(true);
    await patch({ bio: bio.slice(0, 190) });
    setSaving(false);
  };

  const doLogout = async () => {
    await logout().catch(() => undefined);
    onLogout();
  };

  return (
    <Modal title="User settings" onClose={onClose} wide>
      <div className="settings-user">
        <div className="banner-preview" style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined} />
        <div className="profile-row">
          <Avatar url={profile.avatar_url} name={profile.nickname} size={72} />
          <div>
            <strong>{profile.nickname}</strong>
          </div>
        </div>

        <ImageInput
          label="Avatar (.jpg, .webp or animated .gif)"
          folder="avatars"
          value={profile.avatar_url}
          onChange={(url) => patch({ avatar_url: url })}
          onError={onError}
        />
        <ImageInput
          label="Banner (.jpg, .webp or animated .gif)"
          folder="banners"
          shape="wide"
          value={profile.banner_url}
          onChange={(url) => patch({ banner_url: url })}
          onError={onError}
        />

        <label className="field">
          <span>About me ({bio.length}/190)</span>
          <textarea rows={3} maxLength={190} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <div className="row-end">
          <button className="btn primary" disabled={saving || bio === (profile.bio ?? '')} onClick={saveBio}>
            Save bio
          </button>
        </div>

        <hr />
        <button className="btn danger" onClick={doLogout}>
          Log out
        </button>
      </div>
    </Modal>
  );
}
