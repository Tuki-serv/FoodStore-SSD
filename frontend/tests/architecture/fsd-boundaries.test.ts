// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { violacionesFsd, leerArbol } from './fsd';

const FIXTURES = new URL('./fixtures/', import.meta.url);
const SRC = new URL('../../src/', import.meta.url);

describe('violacionesFsd con fixtures que violan cada regla', () => {
  it('detecta capa superior (incluida shared → entities y entities → pages), cross-import entre páginas y entre entidades, import profundo y relativo fuera del slice', () => {
    const archivos = leerArbol(new URL('violaciones/', FIXTURES), '.fixture');

    expect(violacionesFsd(archivos)).toEqual([
      "app/router/rutas.ts: '@/pages/otra/ui/y' -> import profundo (usar '@/pages/otra')",
      "entities/a/model/a.ts: '@/entities/b' -> cross-import entre slices de entities",
      "entities/direccion/ui/a.tsx: '@/pages/direcciones' -> capa superior (entities no puede importar pages)",
      "entities/producto/ui/a.tsx: '@/entities/cart' -> cross-import entre slices de entities",
      "pages/a/ui/a.tsx: '@/pages/direcciones' -> cross-import entre slices de pages",
      "pages/home/ui/home.ts: '../../otra/ui/z' -> relativo fuera del slice",
      "pages/home/ui/home.ts: '@/app/router' -> capa superior (pages no puede importar app)",
      "pages/home/ui/home.ts: '@/pages/otra' -> cross-import entre slices de pages",
      "shared/api/a.ts: '@/entities/session' -> capa superior (shared no puede importar entities)",
      "shared/ui/boton.ts: '@/pages/home' -> capa superior (shared no puede importar pages)",
    ]);
  });
});

describe('violacionesFsd con código válido', () => {
  it('acepta app -> pages/shared por API pública, features -> entities (producto y cart, la combinación de agregar al carrito), pages -> entities/shared (p. ej. el selector de direcciones) y relativos dentro del slice', () => {
    const archivos = leerArbol(new URL('validos/', FIXTURES), '.fixture');

    expect(archivos.map((archivo) => archivo.ruta).sort()).toEqual([
      'app/router/rutas.ts',
      'entities/x/model/a.ts',
      'features/agregar-al-carrito/ui/a.tsx',
      'pages/x/ui/a.tsx',
      'pages/x/ui/pagina.ts',
      'shared/ui/boton.ts',
    ]);
    expect(violacionesFsd(archivos)).toEqual([]);
  });

  it('rechaza un import() dinámico con ruta calculada', () => {
    const archivos = leerArbol(new URL('dinamico/', FIXTURES), '.fixture');

    expect(violacionesFsd(archivos)).toEqual(['pages/x/carga.ts: import dinámico no literal']);
  });

  it('acepta un import() dinámico literal y una reexportación por API pública', () => {
    const archivos = [
      { ruta: 'app/router/lazy.ts', contenido: "export const p = () => import('@/pages/x');" },
      { ruta: 'app/index.ts', contenido: "export { Boton } from '@/shared/ui';" },
    ];

    expect(violacionesFsd(archivos)).toEqual([]);
  });

  it('rechaza el import profundo entre segmentos de shared y los imports multilínea', () => {
    const archivos = [
      {
        ruta: 'shared/ui/icono.ts',
        contenido: "import {\n  a,\n  b,\n} from '@/shared/lib/media-query/hook';",
      },
    ];

    expect(violacionesFsd(archivos)).toEqual([
      "shared/ui/icono.ts: '@/shared/lib/media-query/hook' -> import profundo (usar '@/shared/lib')",
    ]);
  });
});

describe('src/ real', () => {
  it('no tiene violaciones de las fronteras FSD', () => {
    const archivos = leerArbol(SRC);

    expect(archivos.length).toBeGreaterThan(0);
    expect(violacionesFsd(archivos)).toEqual([]);
  });
});
