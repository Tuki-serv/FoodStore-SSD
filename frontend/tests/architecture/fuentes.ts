import postcss from 'postcss';

export interface DeclaracionFontFace {
  familia: string;
  urls: string[];
  fontDisplay: string | undefined;
}

const URL_EN_SRC = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g;

const sinComillas = (valor: string): string => valor.trim().replace(/^["']|["']$/g, '');

/** Cada `@font-face` de un CSS: familia, urls de `src` y `font-display`. */
export function declaracionesFontFace(css: string): DeclaracionFontFace[] {
  const resultado: DeclaracionFontFace[] = [];
  postcss.parse(css).walkAtRules('font-face', (regla) => {
    let familia = '';
    let urls: string[] = [];
    let fontDisplay: string | undefined;
    regla.walkDecls((decl) => {
      if (decl.prop === 'font-family') familia = sinComillas(decl.value);
      if (decl.prop === 'font-display') fontDisplay = decl.value.trim();
      if (decl.prop === 'src') urls = [...decl.value.matchAll(URL_EN_SRC)].map((m) => (m[1] ?? m[2] ?? m[3]) as string);
    });
    resultado.push({ familia, urls, fontDisplay });
  });
  return resultado;
}

/** Primera familia de una custom property de tipografía (`--font-x: "A", "B", sans-serif` → `A`). */
export function primeraFamiliaDeToken(css: string, token: string): string | undefined {
  let valor: string | undefined;
  postcss.parse(css).walkDecls(token, (decl) => {
    valor ??= decl.value;
  });
  return valor === undefined ? undefined : sinComillas((valor.split(',')[0] ?? '').trim());
}

/** Urls que salen del origen de la app (`http:`, `https:` o protocolo relativo `//`). */
export function urlsRemotas(urls: readonly string[]): string[] {
  return urls.filter((url) => /^(https?:)?\/\//i.test(url));
}
