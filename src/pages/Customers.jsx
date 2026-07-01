import { useMemo, useRef, useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import {
  defaultCustomerPromotions,
  getCustomerOrders,
  getCustomerRelationship,
  getRankedCustomers,
} from '../lib/customerRepository.js'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const emptyCustomerForm = {
  id: '',
  name: '',
  phone: '',
  address: '',
  notes: '',
  tags: '',
}

export function Customers({
  campaignHistory,
  cashbackRate,
  customers,
  deliveries,
  onCreateCampaign,
  onSaveCustomer,
}) {
  const rankedCustomers = useMemo(
    () => getRankedCustomers(customers, deliveries, cashbackRate),
    [cashbackRate, customers, deliveries],
  )
  const [selectedCustomerId, setSelectedCustomerId] = useState(rankedCustomers[0]?.id ?? '')
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm)
  const [campaignForm, setCampaignForm] = useState({
    customerId: rankedCustomers[0]?.id ?? '',
    promotionId: defaultCustomerPromotions[0].id,
    channel: 'WhatsApp',
    message: '',
  })
  const [customerMessage, setCustomerMessage] = useState(null)
  const [campaignMessage, setCampaignMessage] = useState(null)
  const profileRef = useRef(null)

  const selectedCustomer =
    rankedCustomers.find((customer) => customer.id === Number(selectedCustomerId)) ?? rankedCustomers[0]
  const campaignCustomer =
    rankedCustomers.find((customer) => customer.id === Number(campaignForm.customerId)) ?? selectedCustomer
  const selectedPromotion = defaultCustomerPromotions.find((promotion) => promotion.id === campaignForm.promotionId)
  const selectedCustomerOrders = selectedCustomer ? getCustomerOrders(selectedCustomer, deliveries) : []
  const totalRevenue = rankedCustomers.reduce((total, customer) => total + customer.relationship.total, 0)
  const totalCashback = rankedCustomers.reduce((total, customer) => total + customer.relationship.cashbackBalance, 0)
  const activeCustomers = rankedCustomers.filter((customer) => customer.relationship.orders > 0).length
  const bestCustomer = rankedCustomers[0]

  function editCustomer(customer) {
    setCustomerForm({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      notes: customer.notes,
      tags: (customer.tags ?? []).join(', '),
    })
  }

  function viewCustomer(customer) {
    setSelectedCustomerId(customer.id)
    setCustomerMessage({ ok: true, text: `Mostrando perfil de ${customer.name}.` })

    window.setTimeout(() => {
      profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function handleSaveCustomer(event) {
    event.preventDefault()
    const savedCustomer = onSaveCustomer(customerForm)

    if (!savedCustomer) {
      setCustomerMessage({ ok: false, text: 'Preencha nome, telefone e endereco para salvar o cliente.' })
      return
    }

    setCustomerMessage({ ok: true, text: `${savedCustomer.name} salvo no cadastro de clientes.` })
    setSelectedCustomerId(savedCustomer.id)
    setCampaignForm((form) => ({ ...form, customerId: savedCustomer.id }))
    setCustomerForm(emptyCustomerForm)
  }

  function handleCreateCampaign(event) {
    event.preventDefault()
    const campaign = onCreateCampaign(campaignForm)

    if (!campaign) {
      setCampaignMessage({ ok: false, text: 'Selecione cliente e promocao para registrar a campanha.' })
      return
    }

    setCampaignMessage({ ok: true, text: `${campaign.code} registrada para ${campaign.customerName}.` })
    setCampaignForm((form) => ({ ...form, message: '' }))
  }

  return (
    <div className="customers-grid">
      <section className="stats-grid compact-stats">
        <Card className="stat-card">
          <span>Clientes cadastrados</span>
          <strong>{customers.length}</strong>
        </Card>
        <Card className="stat-card">
          <span>Clientes com compra</span>
          <strong>{activeCustomers}</strong>
        </Card>
        <Card className="stat-card">
          <span>Receita identificada</span>
          <strong>{currency.format(totalRevenue)}</strong>
        </Card>
        <Card className="stat-card">
          <span>Cashback previsto</span>
          <strong>{currency.format(totalCashback)}</strong>
        </Card>
      </section>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Relacionamento</p>
            <h2>Melhores clientes</h2>
          </div>
          <span className="soft-label">Cashback {cashbackRate}%</span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Pedidos</th>
                <th>Total</th>
                <th>Ticket medio</th>
                <th>Preferencia</th>
                <th>Cashback</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody>
              {rankedCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <strong>{customer.name}</strong>
                    <span className="muted">{customer.phone}</span>
                  </td>
                  <td>{customer.relationship.orders}</td>
                  <td>{currency.format(customer.relationship.total)}</td>
                  <td>{currency.format(customer.relationship.ticketAverage)}</td>
                  <td>{customer.relationship.favoriteItem}</td>
                  <td>{currency.format(customer.relationship.cashbackBalance)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="ghost-button" type="button" onClick={() => viewCustomer(customer)}>
                        Ver
                      </button>
                      <button className="ghost-button" type="button" onClick={() => editCustomer(customer)}>
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cadastro</p>
            <h2>{customerForm.id ? 'Editar cliente' : 'Novo cliente'}</h2>
          </div>
        </div>
        <form className="entry-form" onSubmit={handleSaveCustomer}>
          <label>
            Nome
            <input value={customerForm.name} onChange={(event) => setCustomerForm((form) => ({ ...form, name: event.target.value }))} />
          </label>
          <div className="form-grid">
            <label>
              Telefone
              <input value={customerForm.phone} onChange={(event) => setCustomerForm((form) => ({ ...form, phone: event.target.value }))} />
            </label>
            <label>
              Tags
              <input
                value={customerForm.tags}
                onChange={(event) => setCustomerForm((form) => ({ ...form, tags: event.target.value }))}
                placeholder="Frequente, Combo"
              />
            </label>
          </div>
          <label>
            Endereco
            <input value={customerForm.address} onChange={(event) => setCustomerForm((form) => ({ ...form, address: event.target.value }))} />
          </label>
          <label>
            Observacoes
            <textarea
              rows="3"
              value={customerForm.notes}
              onChange={(event) => setCustomerForm((form) => ({ ...form, notes: event.target.value }))}
            />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit">Salvar cliente</button>
            {customerForm.id && (
              <button className="ghost-button" type="button" onClick={() => setCustomerForm(emptyCustomerForm)}>
                Cancelar
              </button>
            )}
          </div>
          {customerMessage && <div className={customerMessage.ok ? 'form-hint' : 'form-alert'}>{customerMessage.text}</div>}
        </form>
      </Card>

      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Promocoes</p>
            <h2>Campanha por cliente</h2>
          </div>
        </div>
        <form className="entry-form" onSubmit={handleCreateCampaign}>
          <label>
            Cliente
            <select
              value={campaignForm.customerId}
              onChange={(event) => setCampaignForm((form) => ({ ...form, customerId: Number(event.target.value) }))}
            >
              {rankedCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Promocao
              <select
                value={campaignForm.promotionId}
                onChange={(event) => setCampaignForm((form) => ({ ...form, promotionId: event.target.value }))}
              >
                {defaultCustomerPromotions.map((promotion) => (
                  <option key={promotion.id} value={promotion.id}>{promotion.label}</option>
                ))}
              </select>
            </label>
            <label>
              Canal
              <select value={campaignForm.channel} onChange={(event) => setCampaignForm((form) => ({ ...form, channel: event.target.value }))}>
                <option value="WhatsApp">WhatsApp</option>
                <option value="SMS">SMS</option>
                <option value="Ligacao">Ligacao</option>
                <option value="App proprio">App proprio</option>
              </select>
            </label>
          </div>
          {campaignCustomer && selectedPromotion && (
            <div className="form-hint">
              Sugestao: {selectedPromotion.type === 'Cashback'
                ? `${campaignCustomer.name} tem ${currency.format(getCustomerRelationship(campaignCustomer, deliveries, cashbackRate).cashbackBalance)} de cashback previsto.`
                : `${selectedPromotion.label} para ${campaignCustomer.name}.`}
            </div>
          )}
          <label>
            Mensagem
            <textarea
              rows="3"
              value={campaignForm.message}
              onChange={(event) => setCampaignForm((form) => ({ ...form, message: event.target.value }))}
              placeholder="Ex.: Rogerio, hoje tem cupom especial para seu burger favorito."
            />
          </label>
          {campaignMessage && <div className={campaignMessage.ok ? 'form-hint' : 'form-alert'}>{campaignMessage.text}</div>}
          <button className="primary-button" type="submit">Registrar campanha</button>
        </form>
      </Card>

      <Card className="customer-profile-card" ref={profileRef}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Perfil</p>
            <h2>{selectedCustomer?.name ?? 'Cliente'}</h2>
          </div>
          {bestCustomer?.id === selectedCustomer?.id && <StatusBadge status="vip" />}
        </div>
        {selectedCustomer && (
          <div className="customer-profile">
            <p>{selectedCustomer.phone}</p>
            <p>{selectedCustomer.address}</p>
            <p>{selectedCustomer.notes}</p>
            <div className="customer-tags">
              {(selectedCustomer.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <div className="summary-stack">
              <div><span>Total consumido</span><strong>{currency.format(selectedCustomer.relationship.total)}</strong></div>
              <div><span>Ticket medio</span><strong>{currency.format(selectedCustomer.relationship.ticketAverage)}</strong></div>
              <div><span>Cashback previsto</span><strong>{currency.format(selectedCustomer.relationship.cashbackBalance)}</strong></div>
            </div>
            <div className="campaign-box">
              <strong>Proxima acao sugerida</strong>
              <span>{selectedCustomer.relationship.orders >= 3 ? 'Oferecer cashback ou combo personalizado.' : 'Enviar campanha de segunda compra.'}</span>
            </div>
          </div>
        )}
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historico</p>
            <h2>Consumo do cliente</h2>
          </div>
          <span className="soft-label">{selectedCustomerOrders.length} pedidos</span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Canal</th>
                <th>Status</th>
                <th>Itens</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedCustomerOrders.length === 0 ? (
                <tr>
                  <td colSpan="5">Cliente ainda sem historico de consumo.</td>
                </tr>
              ) : selectedCustomerOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.channel}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>{(order.items ?? []).map((item) => `${item.quantity}x ${item.name}`).join(', ')}</td>
                  <td>{currency.format(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="wide-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CRM</p>
            <h2>Campanhas registradas</h2>
          </div>
          <span className="soft-label">{campaignHistory.length} campanhas</span>
        </div>
        <div className="list-stack">
          {campaignHistory.length === 0 ? (
            <p className="empty-state">Nenhuma campanha registrada ainda.</p>
          ) : campaignHistory.map((campaign) => (
            <div className="list-row" key={campaign.id}>
              <div>
                <strong>{campaign.code} - {campaign.customerName}</strong>
                <span>{campaign.createdAt} {campaign.time} - {campaign.channel} - {campaign.promotionLabel}</span>
                <span>{campaign.message || 'Sem mensagem personalizada'}</span>
              </div>
              <StatusBadge status={campaign.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
