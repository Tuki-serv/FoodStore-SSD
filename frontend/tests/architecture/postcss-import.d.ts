declare module 'postcss-import' {
  import type { PluginCreator } from 'postcss';

  interface OpcionesPostcssImport {
    resolve?: (id: string, base: string) => string | string[] | Promise<string | string[]>;
  }

  const plugin: PluginCreator<OpcionesPostcssImport>;
  export default plugin;
}
