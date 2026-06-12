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
  pageTitle,
  repositoryStatus,
  syncStatus,
  userEmail,
  userProfile,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const deviceClass = `app-device-${deviceView ?? 'auto'}`

  return (
    <div className={`app-shell ${deviceClass}`} data-device-view={deviceView ?? 'auto'}>
      <Sidebar
        activePage={activePage}
        isOpen={sidebarOpen}
        navigation={navigation}
        onClose={() => setSidebarOpen(false)}
        onNavigate={onNavigate}
      />
      <main className="main-content">
        <Header
          accessProfiles={accessProfiles}
          activeProfile={activeProfile}
          deviceView={deviceView}
          deviceViewOptions={deviceViewOptions}
          icons={icons}
          onDeviceViewChange={onDeviceViewChange}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={onLogout}
          onProfileChange={onProfileChange}
          onResetData={onResetData}
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
