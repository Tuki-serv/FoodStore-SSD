export {
  productoGestionQueries,
  productoQueries,
  useCrearProducto,
  useEditarProducto,
  useEliminarProducto,
  useFijarDisponibilidad,
  useFijarStock,
} from './api';
export type { FiltrosGestion, FiltrosProductos } from './api';
export {
  aProductoParaCarrito,
  alergenos,
  categoriaPrincipal,
  estadoStock,
  formatearPrecio,
  imagenPrincipal,
  ingredientesRemovibles,
  UMBRAL_POCAS_UNIDADES,
} from './model';
export type {
  CategoriaDeProducto,
  DatosParaCarrito,
  EstadoStock,
  IngredienteDeProductoDatos,
  IngredienteProducto,
  Producto,
  ProductoCambios,
  ProductoDatos,
} from './model';
export { ImagenProducto, MarcaStock, Precio, TarjetaProducto } from './ui';
export type { TarjetaProductoProps } from './ui';
