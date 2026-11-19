import { describe, expect, it } from 'vitest';
import type { Producto } from '@/entities/producto';
import { aCuerpoProducto, cambiosProducto, validarProducto, validarStock, valoresInicialesProducto, type ValoresProducto } from '../model';

const MENSAJE_PRECIO = 'Ingresá un precio desde 0 con hasta 2 decimales.';

const base: ValoresProducto = {
  nombre: 'Burger Doble',
  descripcion: '',
  precio_base: '2500',
  stock_cantidad: '10',
  disponible: true,
  categoria_ids: [1],
  categoria_principal: 1,
  ingredientes: [],
};

const tomate = { ingrediente_id: '8', cantidad: '2', unidad_medida_id: '5', es_removible: true };

describe('validarStock', () => {
  it('rechaza negativos, decimales y vacío con el mismo mensaje', () => {
    for (const texto of ['-1', '2.5', '', ' ', 'abc']) {
      expect(validarStock(texto)).toBe('Ingresá un número entero desde 0.');
    }
  });

  it('acepta 0 y enteros', () => {
    expect(validarStock('0')).toBeUndefined();
    expect(validarStock('12')).toBeUndefined();
  });
});

describe('validarProducto', () => {
  it('un producto completo no tiene errores', () => {
    expect(validarProducto({ ...base, ingredientes: [tomate] }, { alta: true })).toEqual({});
  });

  it('nombre vacío o de más de 150 caracteres', () => {
    expect(validarProducto({ ...base, nombre: '  ' }, { alta: true }).nombre).toBe('Ingresá un nombre.');
    expect(validarProducto({ ...base, nombre: 'a'.repeat(151) }, { alta: true }).nombre).toBe('Máximo 150 caracteres.');
    expect(validarProducto({ ...base, nombre: 'a'.repeat(150) }, { alta: true }).nombre).toBeUndefined();
  });

  it('precio: -5, 12,345 y 1.500,5 inválidos; 1500,5, 0 y 2500 válidos', () => {
    for (const precio of ['-5', '12,345', '1.500,5', '', 'abc']) {
      expect(validarProducto({ ...base, precio_base: precio }, { alta: true }).precio_base).toBe(MENSAJE_PRECIO);
    }
    for (const precio of ['1500,5', '0', '12.5', '2500']) {
      expect(validarProducto({ ...base, precio_base: precio }, { alta: true }).precio_base).toBeUndefined();
    }
  });

  it('sin categorías pide al menos una', () => {
    expect(validarProducto({ ...base, categoria_ids: [], categoria_principal: null }, { alta: true }).categorias).toBe('Elegí al menos una categoría.');
  });

  it('el stock inicial solo se valida en el alta', () => {
    expect(validarProducto({ ...base, stock_cantidad: '-3' }, { alta: true }).stock_cantidad).toBe('Ingresá un número entero desde 0.');
    expect(validarProducto({ ...base, stock_cantidad: '-3' }, { alta: false }).stock_cantidad).toBeUndefined();
  });

  it('un ingrediente repetido marca la segunda fila', () => {
    const errores = validarProducto({ ...base, ingredientes: [tomate, { ...tomate, cantidad: '1' }] }, { alta: true });

    expect(errores.ingredientes?.[0]).toBeUndefined();
    expect(errores.ingredientes?.[1]).toEqual({ ingrediente_id: 'Este ingrediente ya está en la lista.' });
  });

  it('cantidad 0, con 4 decimales o vacía es inválida; 0,5 y 2.250 son válidas', () => {
    for (const cantidad of ['0', '1.2345', '']) {
      expect(validarProducto({ ...base, ingredientes: [{ ...tomate, cantidad }] }, { alta: true }).ingredientes?.[0]?.cantidad).toBe(
        'Ingresá una cantidad mayor que 0, con hasta 3 decimales.',
      );
    }
    expect(validarProducto({ ...base, ingredientes: [{ ...tomate, cantidad: '0,5' }] }, { alta: true })).toEqual({});
    expect(validarProducto({ ...base, ingredientes: [{ ...tomate, cantidad: '2.250' }] }, { alta: true })).toEqual({});
  });

  it('una fila sin ingrediente elegido pide elegirlo', () => {
    const errores = validarProducto({ ...base, ingredientes: [{ ...tomate, ingrediente_id: '' }] }, { alta: true });

    expect(errores.ingredientes?.[0]?.ingrediente_id).toBe('Elegí un ingrediente.');
  });
});

describe('aCuerpoProducto', () => {
  it('arma el cuerpo exacto: precio con 2 decimales, descripción vacía como null, principal primero', () => {
    const cuerpo = aCuerpoProducto({
      ...base,
      nombre: '  Burger Doble ',
      precio_base: '1500,5',
      categoria_ids: [1, 4],
      categoria_principal: 4,
      ingredientes: [tomate],
    });

    expect(cuerpo).toEqual({
      nombre: 'Burger Doble',
      descripcion: null,
      precio_base: '1500.50',
      stock_cantidad: 10,
      disponible: true,
      categoria_ids: [4, 1],
      ingredientes: [{ ingrediente_id: 8, cantidad: '2', unidad_medida_id: 5, es_removible: true }],
    });
  });

  it('con la principal ya primera no reordena; recorta la descripción y normaliza la coma de la cantidad', () => {
    const cuerpo = aCuerpoProducto({
      ...base,
      descripcion: ' Doble carne ',
      categoria_ids: [1, 4],
      categoria_principal: 1,
      ingredientes: [{ ...tomate, cantidad: '0,5' }],
    });

    expect(cuerpo.categoria_ids).toEqual([1, 4]);
    expect(cuerpo.descripcion).toBe('Doble carne');
    expect(cuerpo.ingredientes[0]?.cantidad).toBe('0.5');
  });
});

const vegana: Producto = {
  id: 3,
  nombre: 'Burger Vegana',
  descripcion: null,
  unidad_venta_id: null,
  precio_base: '1800.00',
  imagenes_url: null,
  imagenes_public_id: null,
  stock_cantidad: 20,
  disponible: true,
  categorias: [
    { id: 4, nombre: 'Veganas', es_principal: false },
    { id: 1, nombre: 'Hamburguesas', es_principal: true },
  ],
  ingredientes: [{ id: 8, nombre: 'Tomate', es_alergeno: false, es_removible: true, cantidad: '2.000', unidad_medida_id: 5 }],
};

describe('valoresInicialesProducto y cambiosProducto', () => {
  const inicial = valoresInicialesProducto(vegana);

  it('carga los datos del producto: principal elegida y cantidad sin ceros finales', () => {
    expect(inicial).toMatchObject({
      nombre: 'Burger Vegana',
      descripcion: '',
      precio_base: '1800.00',
      categoria_principal: 1,
      ingredientes: [{ ingrediente_id: '8', cantidad: '2', unidad_medida_id: '5', es_removible: true }],
    });
    expect([...inicial.categoria_ids].sort()).toEqual([1, 4]);
  });

  it('sin cambios devuelve {}', () => {
    expect(cambiosProducto(inicial, { ...inicial })).toEqual({});
  });

  it('si solo cambió el precio envía solo precio_base', () => {
    expect(cambiosProducto(inicial, { ...inicial, precio_base: '1900' })).toEqual({ precio_base: '1900.00' });
  });

  it('nombre y descripción cambiados viajan recortados; descripción vacía como null', () => {
    expect(cambiosProducto(inicial, { ...inicial, nombre: ' Burger Vegana XL ', descripcion: ' rica ' })).toEqual({
      nombre: 'Burger Vegana XL',
      descripcion: 'rica',
    });
    expect(cambiosProducto({ ...inicial, descripcion: 'rica' }, { ...inicial, descripcion: '' })).toEqual({ descripcion: null });
  });

  it('categorías: cambia el conjunto o solo la principal; reordenar sin cambiar la principal no cuenta', () => {
    expect(cambiosProducto(inicial, { ...inicial, categoria_ids: [1], categoria_principal: 1 })).toEqual({ categoria_ids: [1] });
    expect(cambiosProducto(inicial, { ...inicial, categoria_principal: 4 })).toEqual({ categoria_ids: [4, 1] });
    expect(cambiosProducto(inicial, { ...inicial, categoria_ids: [4, 1] })).toEqual({});
  });

  it('ingredientes: una cantidad o es_removible cambiados envían la lista completa', () => {
    const otro = { ...tomate, ingrediente_id: '9' };
    const dos = { ...inicial, ingredientes: [...inicial.ingredientes, otro] };

    expect(cambiosProducto(dos, { ...dos, ingredientes: [dos.ingredientes[0]!, { ...otro, cantidad: '3' }] })).toEqual({
      ingredientes: [
        { ingrediente_id: 8, cantidad: '2', unidad_medida_id: 5, es_removible: true },
        { ingrediente_id: 9, cantidad: '3', unidad_medida_id: 5, es_removible: true },
      ],
    });
    expect(cambiosProducto(inicial, { ...inicial, ingredientes: [{ ...tomate, es_removible: false }] })).toEqual({
      ingredientes: [{ ingrediente_id: 8, cantidad: '2', unidad_medida_id: 5, es_removible: false }],
    });
    expect(cambiosProducto(inicial, { ...inicial, ingredientes: [] })).toEqual({ ingredientes: [] });
  });
});
