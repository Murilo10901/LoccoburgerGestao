import { BrandLogo } from './BrandLogo.jsx'

export function Sidebar({ activePage, navigation, onNavigate, isOpen, onClose }) {
  return (
    <>
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="brand">
          <BrandLogo />
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
