import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import api from "../../services/api"
import { listParticipants } from "../../services/authService"

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


function Home () {

    const [participants, setParticipants] = useState([]);

    const [activeTab, setActiveTab] = useState('lancamentos');

    const navigation = useNavigate()

    const logout = () => {
    localStorage.removeItem("token")
    navigation("/")
    }

    useEffect( () => {
        const fetchParticipants = async () =>{
            try{
                const data = await listParticipants();
                setParticipants(data);
            } catch (error) {
                console.error(error)
            };
        }
         fetchParticipants();
        }, [])

return (

    <AppLayout userName={"userName"} >
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