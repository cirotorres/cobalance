import axios from "axios";

const api = axios.create({
    // baseURL: "http://localhost:8000", //Local
    // baseURL: "http://192.168.100.108:8000", // IP-CASA
    // baseURL: "http://172.19.87.9:8000", //IP - TCE
    // baseURL: "https://cobalance-dd35.onrender.com", //Deploy-RENDER
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
    "Content-Type": "application/json",
  },
})

// injeta de forma automatica o header com o token (injeta Authorization)

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api


api.interceptors.response.use((response) => response, async (error) => {
    const originalRequest = error.config;

    const isLoginUrl = originalRequest.url.includes('/auth/login');
    const isRefreshUrl = originalRequest.url.includes('/auth/refresh');

    // verifica se foi 401
    if (error.response?.status === 401 && !isLoginUrl && !isRefreshUrl) {
      try {
        const refresh_token =
          localStorage.getItem("refresh_token");

        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          // "http://localhost:8000/auth/refresh",
          // "http://192.168.100.108:8000/auth/refresh",
          // "http://172.19.87.9:8000/auth/refresh",
          // "https://cobalance-dd35.onrender.com/auth/refresh",
          {
            refresh_token,
          }
        );

        const new_access_token =
          response.data.access_token;

        localStorage.setItem(
          "token",
          new_access_token
        );

        // injeta novo token na request original
        originalRequest.headers.Authorization =
          `Bearer ${new_access_token}`;

        // refaz request original
        return api(originalRequest);

      } catch (refreshError) {

        // refresh falhou
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");

        window.location.href = "/";

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);



