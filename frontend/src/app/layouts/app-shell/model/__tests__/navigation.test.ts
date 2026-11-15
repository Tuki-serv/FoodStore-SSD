import { describe, expect, it } from 'vitest';
import { seccionesParaRoles, type SeccionNav } from '../navigation';

const etiquetas = (secciones: SeccionNav[]): string[] =>
  secciones.flatMap((seccion) => seccion.items.map((item) => item.label));

const grupos = (secciones: SeccionNav[]): SeccionNav[] => secciones.filter((seccion) => seccion.titulo !== undefined);

describe('seccionesParaRoles sin sesión', () => {
  it('muestra Catálogo, Ingresar y Registrarse, sin grupos', () => {
    const secciones = seccionesParaRoles([]);

    expect(etiquetas(secciones)).toEqual(['Catálogo', 'Ingresar', 'Registrarse']);
    expect(grupos(secciones)).toEqual([]);
  });
});

const CLIENTE = ['Catálogo', 'Carrito', 'Mis pedidos', 'Direcciones', 'Mi cuenta'];
const PEDIDOS = [...CLIENTE, 'Gestión de pedidos'];
const ADMIN_GRUPO = ['Categorías', 'Ingredientes', 'Productos y stock', 'Usuarios', 'Dashboard'];

describe('seccionesParaRoles con sesión', () => {
  it('CLIENT ve las secciones de cliente y ningún grupo', () => {
    const secciones = seccionesParaRoles(['CLIENT']);

    expect(etiquetas(secciones)).toEqual(CLIENTE);
    expect(grupos(secciones)).toEqual([]);
  });

  it('PEDIDOS suma Gestión de pedidos', () => {
    expect(etiquetas(seccionesParaRoles(['PEDIDOS']))).toEqual(PEDIDOS);
  });

  it('ADMIN ve las de PEDIDOS y el grupo Administración con sus cinco ítems', () => {
    const secciones = seccionesParaRoles(['ADMIN']);
    const [grupo, ...otros] = grupos(secciones);

    expect(etiquetas(secciones)).toEqual([...PEDIDOS, ...ADMIN_GRUPO]);
    expect(otros).toEqual([]);
    expect(grupo?.titulo).toBe('Administración');
    expect(grupo?.items.map((item) => item.label)).toEqual(ADMIN_GRUPO);
  });

  it('STOCK ve las de CLIENT y un grupo Administración con solo Productos y stock (DD-25)', () => {
    const secciones = seccionesParaRoles(['STOCK']);

    expect(etiquetas(secciones)).toEqual([...CLIENTE, 'Productos y stock']);
    expect(grupos(secciones).map((grupo) => grupo.titulo)).toEqual(['Administración']);
  });
});

describe('seccionesParaRoles con varios roles', () => {
  it('CLIENT + PEDIDOS es igual a PEDIDOS, sin duplicados', () => {
    expect(seccionesParaRoles(['CLIENT', 'PEDIDOS'])).toEqual(seccionesParaRoles(['PEDIDOS']));
    expect(etiquetas(seccionesParaRoles(['CLIENT', 'PEDIDOS']))).toEqual(PEDIDOS);
  });

  it('el orden no depende del orden de entrada', () => {
    expect(etiquetas(seccionesParaRoles(['PEDIDOS', 'CLIENT']))).toEqual(PEDIDOS);
  });

  it('un rol repetido no duplica secciones', () => {
    expect(etiquetas(seccionesParaRoles(['CLIENT', 'CLIENT']))).toEqual(CLIENTE);
  });

  it('CLIENT + COCINA es igual a CLIENT (COCINA no agrega secciones)', () => {
    expect(etiquetas(seccionesParaRoles(['CLIENT', 'COCINA']))).toEqual(CLIENTE);
  });

  it('ADMIN + STOCK es igual a ADMIN', () => {
    expect(seccionesParaRoles(['ADMIN', 'STOCK'])).toEqual(seccionesParaRoles(['ADMIN']));
  });

  it('un rol desconocido solo se trata como sin sesión', () => {
    expect(etiquetas(seccionesParaRoles(['COCINA']))).toEqual(['Catálogo', 'Ingresar', 'Registrarse']);
  });
});
