import api from "./api";

export const listFinances = async () => {
  const response = await api.get("/financial/financial-entries");
  return response.data;
};