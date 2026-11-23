import { useState } from 'react';
import { Icon } from '@/shared/ui';
import { inicialDe } from '../model';

export interface ImagenProductoProps {
  nombre: string;
  /** Primera URL de `imagenes_url`, o `null` si el producto no tiene. */
  url: string | null;
  /** Respaldo en tamaño grande (detalle del producto). */
  grande?: boolean;
}

/**
 * Imagen del producto con texto alternativo igual al nombre; sin URL o si no carga, un respaldo tipográfico (nunca una imagen
 * rota): la inicial del nombre sobre el color de marca único, o el ícono si el nombre no tiene ningún carácter alfanumérico.
 */
export function ImagenProducto({ nombre, url, grande = false }: ImagenProductoProps) {
  const [fallida, setFallida] = useState<string | null>(null);
  if (url === null || fallida === url) {
    const inicial = inicialDe(nombre);
    return (
      <div className={grande ? 'ph lg' : 'ph'} role="img" aria-label={`Sin imagen de ${nombre}`}>
        {inicial === null ? <Icon name="plato" /> : <span className="ph-initial" aria-hidden="true">{inicial}</span>}
      </div>
    );
  }
  return <img className="ph-img" src={url} alt={nombre} loading="lazy" onError={() => setFallida(url)} />;
}
