import type { StateStorage } from 'zustand/middleware';

/** El almacenamiento del navegador puede no existir o lanzar (modo privado, cuota): ante un fallo el store sigue vivo en memoria. */
export const almacenamientoSeguro: StateStorage = {
  getItem: (nombre) => {
    try {
      return window.localStorage.getItem(nombre);
    } catch {
      return null;
    }
  },
  setItem: (nombre, valor) => {
    try {
      window.localStorage.setItem(nombre, valor);
    } catch {
      // Sin persistencia: el dato vale solo para esta sesión del navegador.
    }
  },
  removeItem: (nombre) => {
    try {
      window.localStorage.removeItem(nombre);
    } catch {
      // Nada que limpiar.
    }
  },
};
