import { useState } from 'react';
import  './Login.css';
import googleIcon from '../../assets/google.svg'
import appleIcon from '../../assets/apple.svg'

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Enviado:', { email, password });
  };

  return (
    <div className='screen'>
      <section className='card'>
        <header className='header'>
          <h1 className='title'>Entrar</h1>
          <p className='subtitle'>Acesse com sua conta</p>
        </header>
        <div className='social'>
          <button className='iconsocial'>
          <img src={googleIcon} alt="Google" className='imagemsocial' />
          Google
        </button>

        <button className='iconsocial'>
          <img src={appleIcon} alt="Apple" className='imagemsocial' />
          Apple
        </button>
        </div>

        <p className='separador'>ou</p>

        <form className='form' onSubmit={handleSubmit}>
          <div className='field'>
            <label className='label' htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className='input'
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teste@exemplo.com"
              autoComplete="email"
              required
            />
          </div>

          <div className='field'>
            <label className='label' htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              className='input'
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className='button'>
            Entrar
          </button>
        </form>
         <p className="signup-text">Ainda não tem conta? <a href="#" className="">Crie aqui!</a></p>

      </section>
    </div>
  );
}

export default Login;
