import { BrandLogo } from './BrandLogo.jsx'

export function Sidebar({ activePage, navigation, onNavigate, isCollapsed = false, isOpen, onClose, onToggleCollapse }) {
  return (
    <>
      <aside className={`sidebar ${isOpen ? 'is-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}>
        <div className="brand sidebar-brand-row">
          <BrandLogo />
          <button
            className="sidebar-collapse-button"
            type="button"
            aria-label={isCollapsed ? 'Abrir menu lateral' : 'Recolher menu lateral'}
            aria-pressed={isCollapsed}
            onClick={onToggleCollapse}
          >
            {isCollapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="nav-list" aria-label="Menu principal">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id)
                  onClose()
                }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>
      <button className={`sidebar-scrim ${isOpen ? 'is-open' : ''}`} type="button" onClick={onClose} aria-label="Fechar menu" />
    </>
  )
}
