import axios, { type AxiosInstance } from 'axios';
import { useAuthStore } from '@/shared/auth';
import { readConfig } from '@/shared/config';
import { unirUrl } from './url';

const PREFIJO_API = '/api/v1';
const TIMEOUT_MS = 15_000;

/**
 * Instancia de Axios apuntada al backend, con credenciales (la cookie HttpOnly del refresh) y el access como Bearer.
 * Lugar único donde se arma el header de autorización.
 */
export function crearInstancia(): AxiosInstance {
  const instancia = axios.create({
    baseURL: unirUrl(readConfig(import.meta.env).apiUrl, PREFIJO_API),
    withCredentials: true,
    timeout: TIMEOUT_MS,
  });
  instancia.interceptors.request.use((config) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken !== null) config.headers.set('Authorization', `Bearer ${accessToken}`);
    return config;
  });
  return instancia;
}
