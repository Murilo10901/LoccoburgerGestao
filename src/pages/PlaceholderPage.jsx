import { Card } from '../components/Card.jsx'

export function PlaceholderPage({ title, icon: Icon }) {
  return (
    <Card className="placeholder-card">
      <div className="placeholder-icon">
        <Icon size={34} />
      </div>
      <h2>{title}</h2>
      <p>Modulo preparado para a proxima etapa da gestao operacional.</p>
    </Card>
  )
}
