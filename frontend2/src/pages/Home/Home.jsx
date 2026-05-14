import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import AppLayout from '../../components/AppLayout/AppLayout';
import Tabs from '../../components/Tabs/Tabs';
import LancamentosTab from './LancamentosTab/LancamentosTab';
import ExtratoTab from './ExtratoTab/ExtratoTab';
import ParticipantesTab from './ParticipantesTab/ParticipantesTab';
import styles from './Home.module.css';
import api from '../../services/api';


const TABS = [
  { id: 'lancamentos', label: 'Lançamentos' },
  { id: 'extrato', label: 'Extrato bancário' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'balanco', label: 'Balanço' },
];


function Home () {

    const [activeTab, setActiveTab] = useState('lancamentos');

    const [userName, setUserName] = useState("Usuário");

    const [participantColors, setParticipantColors] = useState({});

    const navigation = useNavigate()

    const logout = () => {
    localStorage.removeItem("token")
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

return (

    <AppLayout userName={userName} onLogout={logout}>
      <div className={styles.container}>
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <div className={styles.panel}>
          {activeTab === 'lancamentos' && (
            <LancamentosTab participantColors={participantColors} />
          )}
          {activeTab === 'extrato' && <ExtratoTab />}
          {activeTab === 'participantes' && (
            <ParticipantesTab
              participantColors={participantColors}
              setParticipantColors={setParticipantColors}
            />
          )}
          {activeTab === 'balanco' && (
            <div className={styles.placeholder}>Em breve — Balanço</div>
          )}
        </div>
      </div>
    </AppLayout>

    // <div>
    //     <button onClick={logout}>
    //         Logado, Sair
    //     </button>

    //     <h1 className="">Lista de participantes</h1>

    //     <ul className="">
    //         {participants.map((p) => (
    //             <li key={p.id}>
    //                 {p.name},
    //                 {p.user_id}
    //             </li>
    //         ))}
    //     </ul>
    // </div>
    )

}

export default Home