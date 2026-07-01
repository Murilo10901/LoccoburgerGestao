import { useState } from 'react'
import { Header } from './Header.jsx'
import { Sidebar } from './Sidebar.jsx'

export function Layout({
  accessProfiles,
  activePage,
  activeProfile,
  children,
  deviceView,
  deviceViewOptions,
  icons,
  navigation,
  onDeviceViewChange,
  onNavigate,
  onLogout,
  onProfileChange,
  onResetData,
  onResetFinancialData,
  onResetInventoryStock,
  onResetOperationData,
  pageTitle,
  repositoryStatus,
  syncStatus,
  userEmail,
  userProfile,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const deviceClass = `app-device-${deviceView ?? 'auto'}`
  const pageClass = activePage ? `app-page-${activePage}` : ''
  const profileClass = activeProfile ? `app-profile-${activeProfile}` : ''

  return (
    <div className={`app-shell ${deviceClass} ${pageClass} ${profileClass} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-device-view={deviceView ?? 'auto'}>
      <Sidebar
        activePage={activePage}
        isCollapsed={sidebarCollapsed}
        isOpen={sidebarOpen}
        navigation={navigation}
        onClose={() => setSidebarOpen(false)}
        onNavigate={onNavigate}
        onToggleCollapse={() => setSidebarCollapsed((isCollapsed) => !isCollapsed)}
      />
      <main className="main-content">
        <Header
          accessProfiles={accessProfiles}
          activeProfile={activeProfile}
          deviceView={deviceView}
          deviceViewOptions={deviceViewOptions}
          icons={icons}
          onDeviceViewChange={onDeviceViewChange}
          onMenuClick={() => {
            setSidebarCollapsed(false)
            setSidebarOpen(true)
          }}
          onLogout={onLogout}
          onProfileChange={onProfileChange}
          onResetData={onResetData}
          onResetFinancialData={onResetFinancialData}
          onResetInventoryStock={onResetInventoryStock}
          onResetOperationData={onResetOperationData}
          pageTitle={pageTitle}
          repositoryStatus={repositoryStatus}
          syncStatus={syncStatus}
          userEmail={userEmail}
          userProfile={userProfile}
        />
        <div className="content-area">{children}</div>
      </main>
    </div>
  )
}
