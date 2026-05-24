import { useState } from 'react';

import { useNavigate } from "react-router-dom";
import  './Login.css';
import googleIcon from '../../assets/google.svg'
import appleIcon from '../../assets/apple.svg'

import { loginUser } from "../../services/authService";
import api from '../../services/api';


function IconLoading() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      style={{ opacity: 1 }}
    >
      <g stroke="currentColor">
        <circle
          cx="12"
          cy="12"
          r="9.5"
          fill="none"
          strokeLinecap="round"
          strokeWidth="3"
        >
          <animate
            attributeName="stroke-dasharray"
            calcMode="spline"
            dur="1.5s"
            keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1"
            keyTimes="0;0.475;0.95;1"
            repeatCount="indefinite"
            values="0 150;42 150;42 150;42 150"
          />

          <animate
            attributeName="stroke-dashoffset"
            calcMode="spline"
            dur="1.5s"
            keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1"
            keyTimes="0;0.475;0.95;1"
            repeatCount="indefinite"
            values="0;-16;-59;-59"
          />
        </circle>

        <animateTransform
          attributeName="transform"
          dur="2s"
          repeatCount="indefinite"
          type="rotate"
          values="0 12 12;360 12 12"
        />
      </g>
    </svg>
  );
}




function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [name, setName] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const [isSignup, setIsSignup] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleSubLogin = async (e) => {
    e.preventDefault();

    try {
        setLoading(true)
        const data = await loginUser({
          email,
          password
        });
        console.log(data);

        if (data.access_token && data.refresh_token) {
          localStorage.setItem(
            "token",
            data.access_token
          );
          localStorage.setItem(
            "refresh_token",
            data.refresh_token
          );
        }
        setLoading(false)
        navigate("/home");

      } catch (error) {
        console.error(error);
        alert("Usuário ou Senha incorretos.")
        return
      } finally {
        setLoading(false);
      }
      
    };

  const handleSubRegister = async (e) => {
    e.preventDefault();

    if (!confirmPassword()) {
    alert("As senhas não coincidem")
    return
  }

    try {
      setLoading(true)
      await api.post("/users/", {
        email: email,
        name: name,
        password: password,
        age: 34
      })
        
      } catch (error) {
        console.error(error.response.data.detail);
        alert("Usuário já existente.")
        return
      }
      setLoading(false)
      setIsSignup(false)
      alert("Usuário criado com sucesso!")
    };


    const confirmPassword = () => {
      if (confirmPass !== password){
        console.log("As senhas não coincidem.")
        return false
      }
      return true
    }


   const onClickCreate = () => {
    setIsSignup(true)
    setEmail('')
    setPassword('')
   }

  return (
    <div className='screen'> 
    <div className={`card-flip ${isSignup ? "flipped" : ""}`}>
      <section className='face front'>
        <header className='header'>
          <h1 className='title'>Entrar</h1>
          <p className='subtitle'>Acesse sua conta com</p>
        </header>
        <div className='social'>
          <button className='iconsocial'>
          <img src={googleIcon} alt="Google" className='imagemsocial' />
          Google
          </button>

          <button className='iconsocial'>
            <img src={appleIcon} alt="Apple" className='imagemsocial' style={{height: 32}} />
            Apple
          </button>
        </div>

        <p className='separador'>ou</p>

        <form className='form' onSubmit={handleSubLogin}>
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

          <button type="submit" className='button' disabled={loading}>
            {loading ? <IconLoading /> : "Entrar"}
          </button>
        </form>
         <p className="signup-text">
          Ainda não tem conta? 
            <button className='pulsar-button' onClick={() => onClickCreate()}>
                  Crie aqui!
            </button>
         </p>
      </section>


      {/* card flip back  */}


      <section className='face back'>
        <div className="headervoltar">
            <button onClick={() => setIsSignup(false)} style={{background: 'transparent', width: 25, height: 30, border: "none", cursor: 'pointer'}} type="button" className="btn btn-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-chevron-left" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"></path>
                </svg>
            </button>
          <header className='header'> 
            <h1 className='title'>Criar conta </h1>
            <p className='subtitle'>Crie com</p>
          </header>

        </div>
        <div className='social'>
          <button className='iconsocial'>
          <img src={googleIcon} alt="Google" className='imagemsocial' />
          Google
          </button>

        <button className='iconsocial'>
          <img src={appleIcon} alt="Apple" className='imagemsocial' style={{height: 32}} />
          Apple
        </button>
        </div>

        <p className='separador'>ou</p>

        <form className='form' onSubmit={handleSubRegister}>
          <div className='field'>
            <label className='label' htmlFor="name">
              Nome
            </label>
            <input
              id="nome"
              className='input'
              type="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              required
            />
          </div>

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

          <div className='field'>
            <label className='label' htmlFor="password">
              Repetir Senha
            </label>
            <input
              id="password"
              className='input'
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className='button' disabled={loading}>
            { loading? <IconLoading /> : "Criar" }
          </button>
        </form>

      </section> 
      </div>
    </div> 
  );
}

export default Login;




