import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import api from "../../services/api"
import { listParticipants } from "../../services/authService"

function Home () {

    const [participants, setParticipants] = useState([]);

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

    <div>
        <button onClick={logout}>
            Logado, Sair
        </button>

        <h1 className="">Lista de participantes</h1>

        <ul className="">
            {participants.map((p) => (
                <li key={p.id}>
                    {p.name},
                    {p.user_id}
                </li>
            ))}
        </ul>
    </div>
    )

}

export default Home