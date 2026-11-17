/** Une una URL base con un path sin importar las barras sobrantes: `unirUrl('http://x/', '/api/v1')` → `http://x/api/v1`. */
export function unirUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
