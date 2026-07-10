import { useEffect, useRef, useState } from 'react'
import { BrandLogo } from './BrandLogo.jsx'

export function Header({
  accessProfiles,
  activeProfile,
  deviceView,
  deviceViewOptions,
  pageTitle,
  notifications = [],
  onClearNotifications,
  onDeviceViewChange,
  onMenuClick,
  onNavigate,
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
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [dismissedToastId, setDismissedToastId] = useState(null)
  const notificationsRef = useRef(null)
  const maintenanceRef = useRef(null)
  const visibleNotificationPages = accessProfiles[activeProfile]?.pages ?? []
  const visibleNotifications = activeProfile === 'admin'
    ? notifications
    : notifications.filter((notification) => (
        notification.targetPage ? visibleNotificationPages.includes(notification.targetPage) : notification.type === activeProfile
      ))
  const latestNotification = visibleNotifications[0]
  const showNotificationToast = latestNotification && dismissedToastId !== latestNotification.id
  const shouldShowRepositoryStatus = repositoryStatus &&
    ['local', 'supabase-error'].includes(repositoryStatus.mode)

  useEffect(() => {
    if (!latestNotification) return undefined

    const timeoutId = window.setTimeout(() => setDismissedToastId(latestNotification.id), 5200)
    return () => window.clearTimeout(timeoutId)
  }, [latestNotification])

  useEffect(() => {
    if (!notificationsOpen && !maintenanceOpen) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false)
      }
      if (maintenanceOpen && maintenanceRef.current && !maintenanceRef.current.contains(target)) {
        setMaintenanceOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setNotificationsOpen(false)
      setMaintenanceOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [maintenanceOpen, notificationsOpen])

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
        <div className="admin-notifications" ref={notificationsRef}>
          <button
            className={`notification-button ${visibleNotifications.length > 0 ? 'has-items' : ''}`}
            type="button"
            onClick={() => setNotificationsOpen((isOpen) => !isOpen)}
          >
            <span>Notificacoes</span>
            {visibleNotifications.length > 0 && <b>{visibleNotifications.length}</b>}
          </button>
          {notificationsOpen && (
            <div className="notification-menu">
              <div className="notification-menu-head">
                <strong>Central de notificacoes</strong>
                <button type="button" onClick={onClearNotifications}>Limpar</button>
              </div>
              {visibleNotifications.length === 0 ? (
                <p>Nenhuma notificacao agora.</p>
              ) : visibleNotifications.slice(0, 20).map((notification) => (
                <article className={`notification-row notification-${notification.type}`} key={notification.id}>
                  <div>
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    <small>{new Date(notification.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                  {notification.targetPage && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate?.(notification.targetPage)
                        setNotificationsOpen(false)
                      }}
                    >
                      Ver
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
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
        {shouldShowRepositoryStatus && (
          <span className={`storage-pill storage-${repositoryStatus.mode}`}>{repositoryStatus.label}</span>
        )}
        {userEmail && <span className="user-email-pill">{userEmail}</span>}
        {canRunMaintenance && (
          <div className="maintenance-actions" ref={maintenanceRef}>
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
        <BrandLogo compact />
      </div>
      {showNotificationToast && (
        <div className={`admin-notification-toast notification-${latestNotification.type}`} role="status" aria-live="polite">
          <div>
            <strong>{latestNotification.title}</strong>
            <span>{latestNotification.message}</span>
          </div>
          <button type="button" onClick={() => setDismissedToastId(latestNotification.id)}>×</button>
        </div>
      )}
    </header>
  )
}
