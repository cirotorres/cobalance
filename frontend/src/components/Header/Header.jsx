import React from 'react';
import styles from './Header.module.css';

function Header({ userName = 'Usuário', onLogout }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>CoBalance</div>

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
