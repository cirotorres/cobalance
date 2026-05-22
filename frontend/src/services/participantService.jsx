import api from "./api";

export const listParticipants = async () => {
  const response = await api.get("/participants/self");
  return response.data;
};

export const updateParticipantColor = async (id, color) => {
  const response = await api.patch(`/participants/${id}`, {
    color,
  });

  return response.data;
};

export const updateParticipant = async (id, data) => {
  const response = await api.patch(`/participants/${id}`, data);

  return response.data;
};

export const adicionarParticipante = async (name) => {
  const response = await api.post("/participants/", {
    name,
  });

  return response.data;
}

export const deleteParticipante = async (id) => {
  const response = await api.delete(`/participants/${id}`);

  return response.data;
}