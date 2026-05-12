import { useState } from 'react';
import Login from './pages/Login/Login';
import Home from './pages/Home/Home';

function App() {
  const [view, setView] = useState('login');
  const [userName, setUserName] = useState('Usuário');

  const handleLogin = ({ email } = {}) => {
    if (email) {
      const name = email.split('@')[0];
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
    }
    setView('home');
  };

  const handleLogout = () => {
    setView('login');
  };

  if (view === 'home') {
    return <Home userName={userName} onLogout={handleLogout} />;
  }

  return <Login onLogin={handleLogin} />;
}

export default App;
