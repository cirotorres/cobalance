import api from "./api";

export const loginUser = async (data) => {
  const response = await api.post("/auth/login", data);
  return response.data;
};

export const listParticipants = async () => {
  const response = await api.get("/participants/self");
  return response.data;
};

export const listFinances = async () => {
  const response = await api.get("/financial/financial-entries");
  return response.data;
};

export const isAdmin = async () => {
  try {
    const response = await api.get("/auth/me");
    return response.data.is_admin === true; 
  } catch (error) {
    return false;
  }
}