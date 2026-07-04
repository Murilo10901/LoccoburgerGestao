import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/Card.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'
import {
  attachUserToStore,
  createManagedUser,
  deleteManagedUser,
  listUserProfiles,
  roleLabels,
  roles,
  updateUserRole,
} from '../lib/userProfileRepository.js'

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
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', role: 'atendimento' })
  const [deletingUserId, setDeletingUserId] = useState(null)

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

  async function handleCreateUser(event) {
    event.preventDefault()
    if (!canManageUsers) {
      setStatus('error')
      setMessage('Somente um administrador pode cadastrar usuarios.')
      return
    }

    setStatus('loading')
    setMessage('Criando usuario no Supabase...')
    const result = await createManagedUser(createForm)

    if (!result.ok) {
      setStatus('error')
      setMessage(result.message)
      return
    }

    setCreateForm({ email: '', password: '', fullName: '', role: 'atendimento' })
    setStatus('ready')
    setMessage(result.message)
    await loadProfiles()
  }

  async function handleDeleteUser(profile) {
    if (!canManageUsers) {
      setStatus('error')
      setMessage('Somente um administrador pode excluir usuarios.')
      return
    }

    if (profile.user_id === currentUser?.id) {
      setStatus('error')
      setMessage('Por seguranca, voce nao pode excluir o proprio usuario logado.')
      return
    }

    if (!window.confirm(`Excluir o usuario ${profile.email}? Essa acao remove o acesso dele ao sistema.`)) return

    setDeletingUserId(profile.user_id)
    setMessage('Excluindo usuario no Supabase...')
    const result = await deleteManagedUser(profile.user_id)

    if (!result.ok) {
      setStatus('error')
      setMessage(result.message)
      setDeletingUserId(null)
      return
    }

    setProfiles((currentProfiles) => currentProfiles.filter((item) => item.user_id !== profile.user_id))
    setStatus('ready')
    setMessage(result.message)
    setDeletingUserId(null)
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
                <th>Acao</th>
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
                  <td>
                    <button
                      className="ghost-button danger-button compact-action-button"
                      disabled={!canManageUsers || deletingUserId === profile.user_id || profile.user_id === currentUser?.id}
                      type="button"
                      onClick={() => handleDeleteUser(profile)}
                    >
                      {deletingUserId === profile.user_id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan="5">Nenhum usuario encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="full-span">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Novo acesso</p>
            <h2>Cadastrar usuario</h2>
          </div>
          <span className="soft-label">Admin cria e define cargo</span>
        </div>
        <form className="entry-form user-create-form" onSubmit={handleCreateUser}>
          <label>
            Nome
            <input
              disabled={!canManageUsers || status === 'loading'}
              onChange={(event) => setCreateForm((currentForm) => ({ ...currentForm, fullName: event.target.value }))}
              placeholder="Ex.: Cozinha Locco"
              value={createForm.fullName}
            />
          </label>
          <label>
            E-mail
            <input
              disabled={!canManageUsers || status === 'loading'}
              inputMode="email"
              onChange={(event) => setCreateForm((currentForm) => ({ ...currentForm, email: event.target.value }))}
              placeholder="cozinha@loccoburger.com"
              type="email"
              value={createForm.email}
            />
          </label>
          <label>
            Senha inicial
            <input
              disabled={!canManageUsers || status === 'loading'}
              onChange={(event) => setCreateForm((currentForm) => ({ ...currentForm, password: event.target.value }))}
              placeholder="Minimo 6 caracteres"
              type="password"
              value={createForm.password}
            />
          </label>
          <label>
            Cargo
            <select
              disabled={!canManageUsers || status === 'loading'}
              value={createForm.role}
              onChange={(event) => setCreateForm((currentForm) => ({ ...currentForm, role: event.target.value }))}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </select>
          </label>
          <button className="secondary-button" disabled={!canManageUsers || status === 'loading'} type="submit">
            {status === 'loading' ? 'Processando...' : 'Cadastrar usuario'}
          </button>
        </form>
        <p className="form-hint">
          Criar/excluir usuario exige Edge Functions administrativas no Supabase para manter a chave secreta fora do navegador.
        </p>
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
