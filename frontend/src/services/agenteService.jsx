import api from '../services/api'

const conexaoAgente = async (text) => {
    try {
        const response = await api.post("/agente", { text });
        return response.data;

    } catch (error) {
        const message =
            error.response?.data?.detail ||
            "Erro inesperado ao comunicar com o agente.";

        throw new Error(message);
    }
}

export default conexaoAgente