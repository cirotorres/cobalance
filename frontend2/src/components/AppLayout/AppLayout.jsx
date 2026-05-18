import React from 'react';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import Footer from '../Footer/Footer';
import styles from './AppLayout.module.css';

function AppLayout({ userName, onLogout, children }) {
  return (
    <div className={styles.layout}>
      <Header userName={userName} onLogout={onLogout} />
      <Sidebar />
      <main className={styles.main}>{children}</main>
      <Footer />
    </div>
  );
}

export default AppLayout;
