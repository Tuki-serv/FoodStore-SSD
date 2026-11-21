/**
 * Aplica la URL del favicon al `<link id="favicon">` de `index.html` (lo crea si falta).
 * La URL llega de un import del asset del design system, así Vite la sirve en desarrollo y la empaqueta en producción
 * (un `href` relativo fuera de la raíz de Vite cae en el fallback de la SPA y devuelve HTML).
 */
export function aplicarFavicon(url: string, doc: Document = document): void {
  let enlace = doc.getElementById('favicon');
  if (enlace === null) {
    enlace = doc.createElement('link');
    enlace.id = 'favicon';
    enlace.setAttribute('rel', 'icon');
    enlace.setAttribute('type', 'image/svg+xml');
    doc.head.appendChild(enlace);
  }
  enlace.setAttribute('href', url);
}
