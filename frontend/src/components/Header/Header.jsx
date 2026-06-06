import React from 'react';
import styles from './Header.module.css';
import useTheme from '../../hooks/useTheme';

function Header({ userName = 'Usuário', onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className={styles.header}>
      <h4 className={styles.brand}>Co<span>Balance</span></h4>
      <div className={styles.right}>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label="Alternar modo escuro"
          title={isDark ? 'Modo claro' : 'Modo escuro'}
          className={`${styles.themeToggle} ${isDark ? styles.themeToggleOn : ''}`}
          onClick={toggleTheme}
        >
          <span className={styles.themeIconSun} aria-hidden="true">☀️</span>
          <span className={styles.themeIconMoon} aria-hidden="true">🌙</span>
          <span className={styles.themeThumb} aria-hidden="true" />
        </button>
        <span className={styles.user}>Olá, {userName}</span>
        <button type="button" className={styles.logout} onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}

export default Header;
