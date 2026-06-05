import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import AppLayout from '../../components/AppLayout/AppLayout';
import Tabs from '../../components/Tabs/Tabs';
import LancamentosTab from './LancamentosTab/LancamentosTab';
import ExtratoTab from './ExtratoTab/ExtratoTab';
import ParticipantesTab from './ParticipantesTab/ParticipantesTab';
import BalancoTab from './BalancoTab/BalancoTab';
import AgenteTab from './AgenteTab/AgenteTab';
import styles from './Home.module.css';
import api from '../../services/api';
import { listParticipants } from '../../services/participantService';
import { listFinances } from '../../services/financialService'
import { EMPTY_FILTERS } from '../Home/FinancesFilters/filterFinances';


const TABS = [
  { id: 'lancamentos', label: 'Lançamentos', shortLabel: 'Lanç.', icon: 'list' },
  { id: 'extrato', label: 'Extrato bancário', shortLabel: 'Extrato', icon: 'file' },
  { id: 'participantes', label: 'Participantes', shortLabel: 'Pessoas', icon: 'users' },
  { id: 'balanco', label: 'Balanço', shortLabel: 'Balanço', icon: 'chart' },
  { id: 'agente', label: 'Agente', shortLabel: 'Agente', icon: 'bot' },
];


function Home () {
    const [activeTab, setActiveTab] = useState('lancamentos');
    const [userName, setUserName] = useState("Usuário");
    const [participants, setParticipants] = useState([]);
    const [participantColors, setParticipantColors] = useState({});
    const [lancamentos, setLancamentos] = useState([]);
    const [agentMessages, setAgentMessages] = useState([]);
    const [agentInput, setAgentInput] = useState('');
    const [filtersLan, setFiltersLan] = useState(EMPTY_FILTERS);
    const [filtersExt, setFiltersExt] = useState(EMPTY_FILTERS);
    const navigation = useNavigate()

    const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("refresh_token")
    navigation("/")
    }

    useEffect(() =>{
        const fetchUserName = async () => {
    try {
      const response = await api.get("/auth/me");
      const name = response.data.email.split("@")[0]
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
      setUserName(formattedName);


    } catch (error) {
      console.error(error);
    }
  };

  fetchUserName();
    },[])


  const fetchParticipants = async () => {
    try {
      const data = await listParticipants();
      setParticipants(data);

      const colors = {};
      data.forEach((participant) => {
        if (participant.color) {
          colors[participant.id] = participant.color;
        }
      });
      setParticipantColors(colors);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchParticipants();
  }, [activeTab]);


  const fetchFinancesExtrato = async () => {
    try {
      const data = await listFinances();
      const data_filt = data.filter(
        (finance) => finance.source === "extrato"
      );
      setLancamentos(data_filt);
    } catch (error) {
      console.error(error);
    }
  };

  const updateLancamentoInState = (id, updates) => {
    setLancamentos(prev => prev.map(lancamento => lancamento.id === id
          ? { ...lancamento, ...updates }
          : lancamento
        )
      );
  };

  useEffect(() => {
    if (activeTab === 'extrato') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchFinancesExtrato();
    }
  }, [activeTab]);

return (

    <AppLayout userName={userName} onLogout={logout}>
      <div className={styles.container}>
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div className={styles.panel}>
          {activeTab === 'lancamentos' && (
            <LancamentosTab
              participantColors={participantColors}
              filters={filtersLan}
              setFilters={setFiltersLan}
              />
          )}
          {activeTab === 'extrato' && (
            <ExtratoTab
              lancamentos={lancamentos}
              participantColors={participantColors}
              participants={participants}
              refreshfinances={fetchFinancesExtrato}
              updateLancamentoInState={updateLancamentoInState}
              filters={filtersExt}
              setFilters={setFiltersExt}
              />
          )}
          {activeTab === 'participantes' && (
            <ParticipantesTab
              participants={participants}
              participantColors={participantColors}
              setParticipantColors={setParticipantColors}
              />
          )}
          {activeTab === 'balanco' && (
            <BalancoTab
              participants={participants}
              participantColors={participantColors}
              />
          )}
          {activeTab === 'agente' && (
            <AgenteTab
              messages={agentMessages}
              setMessages={setAgentMessages}
              input={agentInput}
              setInput={setAgentInput}
            />
          )}
        </div>
      </div>
    </AppLayout>
    )

}

export default Home