import { describe, expect, it } from 'vitest';
import { ACCESO_RUTAS, puedeAcceder, RUTAS, type Acceso, type Rol } from '..';

describe('ACCESO_RUTAS', () => {
  it('declara el acceso de cada ruta exactamente como la spec', () => {
    expect(ACCESO_RUTAS).toEqual({
      '/catalogo': 'publica',
      '/ingresar': 'anonima',
      '/registrarse': 'anonima',
      '/carrito': 'sesion',
      '/mis-pedidos': 'sesion',
      '/direcciones': 'sesion',
      '/mi-cuenta': 'sesion',
      '/gestion-pedidos': { roles: ['PEDIDOS', 'ADMIN'] },
      '/admin/categorias': { roles: ['ADMIN'] },
      '/admin/ingredientes': { roles: ['ADMIN'] },
      '/admin/productos': { roles: ['ADMIN', 'STOCK'] },
      '/admin/usuarios': { roles: ['ADMIN'] },
      '/admin/dashboard': { roles: ['ADMIN'] },
    });
  });

  it('cubre todas las rutas de RUTAS, ni una más ni una menos', () => {
    expect(Object.keys(ACCESO_RUTAS).sort()).toEqual(Object.values(RUTAS).sort());
  });
});

type Caso = { acceso: Acceso; anonimo: boolean; roles: Partial<Record<Rol, boolean>> };

describe('puedeAcceder', () => {
  const casos: Caso[] = [
    { acceso: 'publica', anonimo: true, roles: { CLIENT: true, PEDIDOS: true, STOCK: true, ADMIN: true } },
    { acceso: 'anonima', anonimo: true, roles: { CLIENT: false, PEDIDOS: false, STOCK: false, ADMIN: false } },
    { acceso: 'sesion', anonimo: false, roles: { CLIENT: true, PEDIDOS: true, STOCK: true, ADMIN: true } },
    { acceso: { roles: ['PEDIDOS', 'ADMIN'] }, anonimo: false, roles: { CLIENT: false, PEDIDOS: true, STOCK: false, ADMIN: true } },
    { acceso: { roles: ['ADMIN', 'STOCK'] }, anonimo: false, roles: { CLIENT: false, PEDIDOS: false, STOCK: true, ADMIN: true } },
    { acceso: { roles: ['ADMIN'] }, anonimo: false, roles: { CLIENT: false, PEDIDOS: false, STOCK: false, ADMIN: true } },
  ];

  it.each(casos)('acceso $acceso: anónimo y cada rol', ({ acceso, anonimo, roles }) => {
    expect(puedeAcceder(acceso, 'anonima', [])).toBe(anonimo);
    for (const [rol, esperado] of Object.entries(roles)) {
      expect(puedeAcceder(acceso, 'autenticada', [rol]), `${rol} en ${JSON.stringify(acceso)}`).toBe(esperado);
    }
  });

  it('con varios roles alcanza con uno', () => {
    expect(puedeAcceder({ roles: ['ADMIN'] }, 'autenticada', ['CLIENT', 'ADMIN'])).toBe(true);
    expect(puedeAcceder({ roles: ['ADMIN'] }, 'autenticada', ['CLIENT', 'STOCK'])).toBe(false);
  });

  it('un rol que la UI no conoce (COCINA) no da acceso por roles', () => {
    expect(puedeAcceder({ roles: ['ADMIN'] }, 'autenticada', ['COCINA'])).toBe(false);
  });

  it('mientras la sesión se verifica solo las rutas públicas son accesibles', () => {
    expect(puedeAcceder('publica', 'verificando', [])).toBe(true);
    expect(puedeAcceder('sesion', 'verificando', [])).toBe(false);
    expect(puedeAcceder('anonima', 'verificando', [])).toBe(false);
    expect(puedeAcceder({ roles: ['ADMIN'] }, 'verificando', ['ADMIN'])).toBe(false);
  });
});
