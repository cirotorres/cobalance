import api from '../services/api'

const conexaoAgente = async (text) =>{
    const response = await api.post("/agente", {text});

    return response.data
}

export default conexaoAgente