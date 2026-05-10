import { useNavigate } from "react-router-dom"

function Home () {

const navigation = useNavigate()

const token = localStorage.getItem("token")

const logout = () => {
  localStorage.removeItem("token")
  navigation("/")
}

    return (
    <div>

        {token ? (
        <button onClick={logout}>
            Logado, Sair
        </button>
        ) :(<button onClick={()=> navigation("/")}>Não logado, voltar para login.</button>)}

    </div>
    )

}

export default Home