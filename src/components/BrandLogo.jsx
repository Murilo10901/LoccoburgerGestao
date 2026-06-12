export function BrandLogo({ compact = false }) {
  return (
    <div className={`brand-logo ${compact ? 'brand-logo-compact' : ''}`}>
      <img src="/assets/loccoburger-logo.jpg" alt="Locco Burger - Hamburgueria na Brasa" />
    </div>
  )
}
