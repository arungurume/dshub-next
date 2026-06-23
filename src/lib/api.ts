import axios, { AxiosInstance } from 'axios';

// Helper to get client-side cookies
export const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

// Helper to set client-side cookies
export const setCookie = (name: string, value: string, days = 7) => {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = '; expires=' + date.toUTCString();
  document.cookie = name + '=' + value + expires + '; path=/';
};

// Helper to clear cookies
export const removeCookie = (name: string) => {
  setCookie(name, '', -1);
};

const getAuthToken = (): string | null => {
  return getCookie('token') || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
};

// Configure interceptor for attaching auth headers and handling 401s
const configureAuthInterceptors = (client: AxiosInstance) => {
  client.interceptors.request.use(
    (config) => {
      const token = getAuthToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      // 401 Unauthorized handler
      if (error.response?.status === 401) {
        // Exclude Open-Meteo or any specific URLs if needed
        if (!error.config.url?.includes('open-meteo.com')) {
          // Clear authentication tokens and redirect
          removeCookie('token');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentUserOrg');
            localStorage.removeItem('role');
            window.location.href = '/signin';
          }
        }
      }
      return Promise.reject(error);
    }
  );
};

// Create client instances for each service
export const umsApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_UMS_API_URL,
});

export const cmsApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CMS_API_URL,
});

export const cmsApiV2 = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CMS_API_URL_V2,
});

export const omsApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_OMS_API_URL,
});

export const tmsApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_TMS_API_URL,
});

// Configure all clients
configureAuthInterceptors(umsApi);
configureAuthInterceptors(cmsApi);
configureAuthInterceptors(cmsApiV2);
configureAuthInterceptors(omsApi);
configureAuthInterceptors(tmsApi);

// Convenience alias — used by new pages as a single authenticated client.
// Points to cmsApi (main CMS backend) by default.
export const apiAuth = cmsApi;
