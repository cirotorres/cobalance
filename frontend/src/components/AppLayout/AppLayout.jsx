import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import styles from './AppLayout.module.css';

function AppLayout({ userName, onLogout, children, headerExtra = null, containedScroll = false }) {
  return (
    <div className={`${styles.layout} ${containedScroll ? styles.containedScroll : ''}`}>
      <Header userName={userName} onLogout={onLogout} extra={headerExtra} />
      {/* <Sidebar /> */}
      <main className={styles.main}>{children}</main>
      <Footer />
    </div>
  );
}

export default AppLayout;
