import { useState } from 'react'
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
  onResetFinancialData,
  onResetInventoryStock,
  onResetOperationData,
  icons,
  onLogout,
  repositoryStatus,
  syncStatus,
  userEmail,
  userProfile,
}) {
  const MenuIcon = icons.Menu
  const canPreviewProfiles = userProfile?.role === 'admin'
  const canRunMaintenance = userProfile?.role === 'admin'
  const profileLabel = accessProfiles[activeProfile]?.label ?? 'Perfil'
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [maintenanceLoading, setMaintenanceLoading] = useState(null)
  const [maintenanceMessage, setMaintenanceMessage] = useState(null)

  async function runMaintenance(actionId, handler, confirmText) {
    if (!handler) return
    if (!window.confirm(confirmText)) return

    setMaintenanceLoading(actionId)
    setMaintenanceMessage(null)

    try {
      const result = await handler()
      setMaintenanceMessage({
        ok: result?.ok !== false,
        text: result?.message ?? 'Manutencao concluida.',
      })
    } catch (error) {
      setMaintenanceMessage({
        ok: false,
        text: error?.message ?? 'Nao foi possivel concluir a manutencao.',
      })
    } finally {
      setMaintenanceLoading(null)
    }
  }

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
        {canRunMaintenance && (
          <div className="maintenance-actions">
            <button
              className="ghost-button reset-button"
              type="button"
              onClick={() => setMaintenanceOpen((isOpen) => !isOpen)}
            >
              Manutencao
            </button>
            {maintenanceOpen && (
              <div className="maintenance-menu">
                <div>
                  <strong>Limpeza segura</strong>
                  <span>Salva a limpeza tambem no Supabase. Produtos e cardapio nao sao apagados.</span>
                </div>
                <button
                  className="ghost-button"
                  disabled={Boolean(maintenanceLoading)}
                  type="button"
                  onClick={() =>
                    runMaintenance(
                      'operation',
                      onResetOperationData,
                      'Limpar mesas, comandas, delivery e fila da cozinha? Esta acao zera a operacao atual.',
                    )
                  }
                >
                  {maintenanceLoading === 'operation' ? 'Limpando...' : 'Limpar operacao'}
                </button>
                <button
                  className="ghost-button"
                  disabled={Boolean(maintenanceLoading)}
                  type="button"
                  onClick={() =>
                    runMaintenance(
                      'financial',
                      onResetFinancialData,
                      'Limpar faturamento, pagamentos, lucro, DRE e fechamentos? Use quando quiser zerar testes financeiros.',
                    )
                  }
                >
                  {maintenanceLoading === 'financial' ? 'Limpando...' : 'Limpar financeiro/DRE'}
                </button>
                <button
                  className="ghost-button danger-button"
                  disabled={Boolean(maintenanceLoading)}
                  type="button"
                  onClick={() =>
                    runMaintenance(
                      'stock',
                      onResetInventoryStock,
                      'Zerar todas as quantidades do estoque? Os insumos continuam cadastrados.',
                    )
                  }
                >
                  {maintenanceLoading === 'stock' ? 'Zerando...' : 'Zerar estoque'}
                </button>
                <button
                  className="ghost-button danger-button"
                  disabled={Boolean(maintenanceLoading)}
                  type="button"
                  onClick={() =>
                    runMaintenance(
                      'all',
                      onResetData,
                      'Limpar todos os dados de teste da operacao, clientes, delivery e financeiro? Produtos e cardapio serao mantidos.',
                    )
                  }
                >
                  {maintenanceLoading === 'all' ? 'Limpando...' : 'Limpar tudo de teste'}
                </button>
                {maintenanceMessage && (
                  <p className={maintenanceMessage.ok ? 'form-hint' : 'form-alert'}>{maintenanceMessage.text}</p>
                )}
              </div>
            )}
          </div>
        )}
        <button className="ghost-button logout-button" type="button" onClick={onLogout}>
          Sair
        </button>
        <span className="shift-pill">Turno Noite</span>
        <BrandLogo compact />
      </div>
    </header>
  )
}
