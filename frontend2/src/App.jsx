
import googleIcon from './assets/google.svg'
import appleIcon from './assets/apple.svg'

const App = () => {
  return (
    <div className="login-container">
      <h2 className="form-title">Entre com</h2>
      <div className="social-login">
        <div className="group-buttons-social">
        <button className="social-button">
          <img src={googleIcon} alt="Google" className="social-icon" />
          Google
        </button>

        <button className="social-button">
          <img src={appleIcon} alt="Apple" className="social-icon" />
          Apple
        </button>
        </div>
      <p className="separator"><span>ou</span></p>

      <form action="#" className="login-form">
        <div className="input-wrapper">
          <input type="email" placeholder='Email' className="input-field" required/>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-envelope" viewBox="0 0 16 16">
            <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1zm13 2.383-4.708 2.825L15 11.105zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741M1 11.105l4.708-2.897L1 5.383z"/>
          </svg>
        </div>

        <div className="input-wrapper">
          <input type="password" placeholder='Senha' className="input-field" required/>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7zM8 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/>
        </svg>
        </div>
        <a href="#" className="forgot-pass-link">Esqueceu a senha?</a>
        <button className="login-button">Entrar</button>
      </form>

      <p className="signup-text">Não tem conta ainda? <a href="#" className="">Criar conta</a></p>
      </div>
    </div>
  )
}

export default App
