import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import { attachUserToStore, listUserProfiles, roleLabels, roles, updateUserRole } from '../lib/userProfileRepository.js'

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function UserPermissions({ canManageUsers = false, currentUser }) {
  const [profiles, setProfiles] = useState([])
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('Carregando usuarios...')
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'atendimento' })

  const totals = useMemo(
    () => roles.map((role) => ({
      ...role,
      count: profiles.filter((profile) => profile.role === role.id).length,
    })),
    [profiles],
  )

  async function loadProfiles() {
    setStatus('loading')
    setMessage('Carregando usuarios...')
    const result = await listUserProfiles()

    if (!result.ok) {
      setStatus('error')
      setMessage(result.message)
      setProfiles([])
      return
    }

    setProfiles(result.profiles)
    setStatus('ready')
    setMessage('Usuarios carregados.')
  }

  async function handleRoleChange(userId, role) {
    if (!canManageUsers) {
      setStatus('error')
      setMessage('Somente um administrador pode editar permissoes de usuarios.')
      return
    }

    if (userId === currentUser?.id) {
      setStatus('error')
      setMessage('Por seguranca, nao altere o perfil do usuario logado por esta tela.')
      return
    }

    setUpdatingUserId(userId)
    setMessage('Atualizando perfil...')
    const result = await updateUserRole(userId, role)

    if (!result.ok) {
      setStatus('error')
      setMessage(result.message)
      setUpdatingUserId(null)
      return
    }

    setProfiles((currentProfiles) =>
      currentProfiles.map((profile) =>
        profile.user_id === userId ? { ...profile, role, updated_at: new Date().toISOString() } : profile,
      ),
    )
    setStatus('ready')
    setMessage(result.message)
    setUpdatingUserId(null)
  }

  async function handleAttachUser(event) {
    event.preventDefault()
    if (!canManageUsers) {
      setStatus('error')
      setMessage('Somente um administrador pode vincular usuarios a loja.')
      return
    }

    if (!inviteForm.email.trim()) return

    setStatus('loading')
    setMessage('Vinculando usuario a loja...')
    const result = await attachUserToStore(inviteForm.email.trim(), inviteForm.role)

    if (!result.ok) {
      setStatus('error')
      setMessage(result.message)
      return
    }

    setInviteForm({ email: '', role: 'atendimento' })
    setStatus('ready')
    setMessage(result.message)
    await loadProfiles()
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  return (
    <div className="page-grid user-permissions-page">
      <Card className="full-span">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Acesso por funcao</p>
            <h2>Usuarios e permissoes</h2>
          </div>
          <button className="ghost-button" type="button" onClick={loadProfiles} disabled={status === 'loading'}>
            Atualizar lista
          </button>
        </div>
        <p className={`auth-message ${status === 'error' ? 'error' : 'success'}`}>{message}</p>
        {!canManageUsers && (
          <p className="form-alert">Seu perfil pode visualizar, mas nao pode editar usuarios. Entre com uma conta admin para alterar acessos.</p>
        )}
      </Card>

      {totals.map((role) => (
        <Card className="permission-summary-card" key={role.id}>
          <span>{role.label}</span>
          <strong>{role.count}</strong>
        </Card>
      ))}

      <Card className="full-span">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Controle operacional</p>
            <h2>Perfis cadastrados</h2>
          </div>
        </div>

        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Perfil atual</th>
                <th>Alterar para</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.user_id}>
                  <td>
                    <strong>{profile.full_name || profile.email}</strong>
                    <small>{profile.email}</small>
                    {profile.user_id === currentUser?.id && <small>Seu usuario</small>}
                  </td>
                  <td><StatusBadge status={profile.role} /></td>
                  <td>
                    <select
                      className="permission-select"
                      value={profile.role}
                      disabled={!canManageUsers || updatingUserId === profile.user_id || profile.user_id === currentUser?.id}
                      onChange={(event) => handleRoleChange(profile.user_id, event.target.value)}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDate(profile.updated_at)}</td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan="4">Nenhum usuario encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="full-span">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Loja compartilhada</p>
            <h2>Codigo e vinculo de usuarios</h2>
          </div>
          <span className="soft-label">
            Codigo da loja: {profiles[0]?.store_invite_code ?? currentUser?.id?.slice(0, 8) ?? '-'}
          </span>
        </div>
        <form className="entry-form user-attach-form" onSubmit={handleAttachUser}>
          <label>
            E-mail do usuario ja cadastrado
            <input
              disabled={!canManageUsers}
              inputMode="email"
              onChange={(event) => setInviteForm((currentForm) => ({ ...currentForm, email: event.target.value }))}
              placeholder="funcionario@exemplo.com"
              type="email"
              value={inviteForm.email}
            />
          </label>
          <label>
            Perfil
            <select
              disabled={!canManageUsers}
              value={inviteForm.role}
              onChange={(event) => setInviteForm((currentForm) => ({ ...currentForm, role: event.target.value }))}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </select>
          </label>
          <button className="secondary-button" disabled={!canManageUsers} type="submit">Vincular a loja</button>
        </form>
        <p className="form-hint">
          Novo funcionario pode criar cadastro usando o codigo da loja, ou criar cadastro antes e ser vinculado aqui pelo e-mail.
        </p>
      </Card>
    </div>
  )
}
