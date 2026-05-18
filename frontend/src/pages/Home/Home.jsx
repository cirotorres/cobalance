import React, { useState } from 'react';
import AppLayout from '../../components/AppLayout/AppLayout';
import Tabs from '../../components/Tabs/Tabs';
import LancamentosTab from './LancamentosTab/LancamentosTab';
import ExtratoTab from './ExtratoTab/ExtratoTab';
import styles from './Home.module.css';

const TABS = [
  { id: 'lancamentos', label: 'Lançamentos' },
  { id: 'extrato', label: 'Extrato bancário' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'balanco', label: 'Balanço' },
];

function Home({ userName, onLogout }) {
  const [activeTab, setActiveTab] = useState('lancamentos');

  return (
    <AppLayout userName={userName} onLogout={onLogout}>
      <div className={styles.container}>
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div className={styles.panel}>
          {activeTab === 'lancamentos' && <LancamentosTab />}
          {activeTab === 'extrato' && <ExtratoTab />}
          {activeTab === 'participantes' && (
            <div className={styles.placeholder}>Em breve — Participantes</div>
          )}
          {activeTab === 'balanco' && (
            <div className={styles.placeholder}>Em breve — Balanço</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default Home;
