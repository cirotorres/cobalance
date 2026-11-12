import axios from 'axios';
import { clearActiveModuleSelection } from '../components/ModuleSwitcher/moduleSession';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Uma renovação em trânsito por refresh, compartilhada por todas as requisições.
let inflightRefresh = null;

function isAuthEndpoint(url = '') {
  return /\/auth\/(login|refresh)\/?(?:\?.*)?$/.test(url);
}

function getRefreshedAccess(refreshToken) {
  if (!inflightRefresh || inflightRefresh.refreshToken !== refreshToken) {
    const promise = axios.post(`${api.defaults.baseURL || ''}/auth/refresh`, {
      refresh_token: refreshToken,
    }).then(({ data }) => {
      if (typeof data?.access_token !== 'string' || !data.access_token) {
        throw new Error('Refresh retornou access inválido.');
      }
      return data.access_token;
    });

    const entry = { refreshToken, promise };
    inflightRefresh = entry;
    // Não criar uma promise rejeitada extra ao liberar o lock.
    promise.then(
      () => { if (inflightRefresh === entry) inflightRefresh = null; },
      () => { if (inflightRefresh === entry) inflightRefresh = null; },
    );
  }
  return inflightRefresh.promise;
}

function clearExpiredSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  // Sem identidade confiável disponível, limpa apenas as chaves de seleção R7.
  clearActiveModuleSelection(null);
  window.location.assign('/');
}

api.interceptors.request.use((config) => {
  if (!isAuthEndpoint(config.url)) {
    const token = localStorage.getItem('token');
    if (config._retry && config._sessionRefreshToken !== localStorage.getItem('refresh_token')) {
      throw new axios.CanceledError('Sessão alterada durante a renovação.');
    }
    if (token) config.headers.Authorization = `Bearer ${token}`;
    else delete config.headers.Authorization;
    // A requisição pertence a esta sessão: nunca repetir sob outra conta.
    if (config._sessionRefreshToken === undefined) {
      config._sessionRefreshToken = localStorage.getItem('refresh_token');
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || !original || original._retry || isAuthEndpoint(original.url)) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('refresh_token');
    // Evita reaproveitar solicitação antiga depois de logout / nova conta.
    if (original._sessionRefreshToken !== refreshToken) return Promise.reject(error);

    if (!refreshToken) {
      clearExpiredSession();
      return Promise.reject(error);
    }

    original._retry = true; // uma única repetição, mesmo se esta também retornar 401
    const currentAccess = localStorage.getItem('token');
    const sentAccess = original.headers?.Authorization?.replace(/^Bearer\s+/, '');

    // Outra requisição desta mesma sessão já renovou o token enquanto esta estava em trânsito.
    if (currentAccess && sentAccess && currentAccess !== sentAccess) {
      original.headers.Authorization = `Bearer ${currentAccess}`;
      return api(original);
    }

    try {
      const newAccess = await getRefreshedAccess(refreshToken);
      // Não restaurar credenciais da conta anterior em uma nova sessão ou após logout.
      if (localStorage.getItem('refresh_token') !== refreshToken) return Promise.reject(error);
      localStorage.setItem('token', newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch (refreshError) {
      // 5xx/falha de rede não invalidam o refresh ainda vigente: nova tentativa futura.
      if (refreshError.response?.status === 401 && localStorage.getItem('refresh_token') === refreshToken) {
        clearExpiredSession();
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
