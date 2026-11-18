import { useState } from 'react';
import { Icon } from '@/shared/ui';

export interface ImagenProductoProps {
  nombre: string;
  /** Primera URL de `imagenes_url`, o `null` si el producto no tiene. */
  url: string | null;
}

/** Imagen del producto con texto alternativo igual al nombre; sin URL o si no carga, un marcador neutro (nunca una imagen rota). */
export function ImagenProducto({ nombre, url }: ImagenProductoProps) {
  const [fallida, setFallida] = useState<string | null>(null);
  if (url === null || fallida === url) {
    return (
      <div className="ph none" role="img" aria-label={`Sin imagen de ${nombre}`}>
        <Icon name="plato" />
      </div>
    );
  }
  return <img className="ph-img" src={url} alt={nombre} loading="lazy" onError={() => setFallida(url)} />;
}
