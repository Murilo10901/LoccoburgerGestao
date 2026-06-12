import { BrandLogo } from './BrandLogo.jsx'

export function Header({
  accessProfiles,
  activeProfile,
  deviceView,
  deviceViewOptions,
  pageTitle,
  onDeviceViewChange,
  onMenuClick,
  onProfileChange,
  onResetData,
  icons,
  onLogout,
  repositoryStatus,
  syncStatus,
  userEmail,
  userProfile,
}) {
  const MenuIcon = icons.Menu
  const canPreviewProfiles = userProfile?.role === 'admin'
  const profileLabel = accessProfiles[activeProfile]?.label ?? 'Perfil'

  return (
    <header className="header">
      <button className="icon-button menu-toggle" type="button" onClick={onMenuClick} aria-label="Abrir menu">
        <MenuIcon size={20} />
      </button>
      <div className="header-title">
        <p className="eyebrow">LoccoBurger Gestao</p>
        <h1>{pageTitle}</h1>
      </div>
      <div className="header-actions">
        <label className="device-switcher">
          Visual
          <select value={deviceView ?? 'auto'} onChange={(event) => onDeviceViewChange?.(event.target.value)}>
            {(deviceViewOptions ?? []).map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        {canPreviewProfiles ? (
          <label className="profile-switcher">
            Visao
            <select value={activeProfile} onChange={(event) => onProfileChange(event.target.value)}>
              {Object.entries(accessProfiles).map(([profileId, profile]) => (
                <option key={profileId} value={profileId}>{profile.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <span className="role-pill">{profileLabel}</span>
        )}
        {userProfile?.store_name && <span className="role-pill">{userProfile.store_name}</span>}
        <span className={`storage-pill storage-${repositoryStatus.mode}`}>{repositoryStatus.label}</span>
        {syncStatus && <span className={`sync-pill sync-${syncStatus.mode}`}>{syncStatus.label}</span>}
        {userEmail && <span className="user-email-pill">{userEmail}</span>}
        <button className="ghost-button reset-button" type="button" onClick={onResetData}>
          Limpar testes
        </button>
        <button className="ghost-button logout-button" type="button" onClick={onLogout}>
          Sair
        </button>
        <span className="shift-pill">Turno Noite</span>
        <BrandLogo compact />
      </div>
    </header>
  )
}
