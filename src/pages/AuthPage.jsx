import { BrandLogo } from '../components/BrandLogo.jsx'

export function AuthPage({
  authMode,
  authStatus,
  email,
  message,
  onEmailChange,
  onModeChange,
  onPasswordChange,
  onPasswordReset,
  onStoreCodeChange,
  onSubmit,
  password,
  storeCode,
}) {
  const isSignUp = authMode === 'signup'
  const isBusy = authStatus === 'loading'

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <BrandLogo />
          <div>
            <p className="eyebrow">LoccoBurger Gestao</p>
            <h1>{isSignUp ? 'Criar acesso' : 'Entrar no sistema'}</h1>
            <p>Use seu e-mail para carregar os dados da operacao com seguranca.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            E-mail
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="seuemail@exemplo.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Senha
            <input
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={6}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Minimo 6 caracteres"
              required
              type="password"
              value={password}
            />
          </label>

          {isSignUp && (
            <label>
              Codigo da loja
              <input
                autoComplete="off"
                onChange={(event) => onStoreCodeChange(event.target.value.toUpperCase())}
                placeholder="Deixe em branco para criar a loja"
                type="text"
                value={storeCode}
              />
              <small>Funcionarios usam o codigo fornecido pelo administrador.</small>
            </label>
          )}

          {message && <p className={`auth-message ${message.type}`}>{message.text}</p>}

          <button className="primary-button auth-submit" disabled={isBusy} type="submit">
            {isBusy ? (isSignUp ? 'Cadastrando...' : 'Entrando...') : isSignUp ? 'Criar cadastro' : 'Entrar'}
          </button>
        </form>

        {!isSignUp && (
          <button
            className="ghost-button auth-mode-button"
            disabled={isBusy}
            onClick={onPasswordReset}
            type="button"
          >
            Esqueci minha senha
          </button>
        )}

        <button
          className="ghost-button auth-mode-button"
          disabled={isBusy}
          onClick={() => onModeChange(isSignUp ? 'signin' : 'signup')}
          type="button"
        >
          {isSignUp ? 'Ja tenho cadastro' : 'Criar novo cadastro'}
        </button>
      </section>
    </main>
  )
}
