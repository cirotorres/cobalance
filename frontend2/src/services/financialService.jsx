import api from "./api";


export const listFinances = async () => {
  const response = await api.get("/financial/financial-entries");
  return response.data;
};

export const editFinances = async (id, finance) => {
  const response = await api.patch(`/financial/${id}`, finance);
  return response.data
};