import api from "./api";

export const loginUser = async (data) => {
  const response = await api.post("/auth/login", data);
  return response.data;
};

export const listUsers = async (data) => {
  const response = await api.get("/users", data);
  return response.data;
};