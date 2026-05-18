import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:8000",
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

    // verifica se foi 401
    if (error.response?.status === 401) {

      try {

        const refresh_token =
          localStorage.getItem("refresh_token");


        const response = await axios.post(
          "http://localhost:8000/auth/refresh",
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



