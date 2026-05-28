import React from 'react';
import styles from './Header.module.css';

function Header({ userName = 'Usuário', onLogout }) {
  return (
    <header className={styles.header}>
      <h4 className={styles.brand}>Co<span>Balance</span></h4>
      <div className={styles.right}>
        <span className={styles.user}>Olá, {userName}</span>
        <button type="button" className={styles.logout} onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}

export default Header;
