import api from "./api";

export const loginUser = async (data) => {
  const response = await api.post("/auth/login", data);
  return response.data;
};

export const isAdmin = async () => {
  try {
    const response = await api.get("/auth/me");
    return response.data.is_admin === true; 
  } catch {
    return false;
  }
}

export const refreshToken = async (refresh_token) => {
  try {
    const response = api.post("/auth/refresh", {refresh_token})
    return response.data

  } catch (error) {
    console.log(error);
    return false
  }

}