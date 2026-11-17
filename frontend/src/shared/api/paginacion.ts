/** Respuesta paginada del backend (`PaginatedResponse[T]`). */
export interface Paginado<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
