const DECLARACION = /(--[\w-]+)\s*:/g;
const USO_VAR = /^var\((--[\w-]+)\)$/;

/** Nombres de las custom properties declaradas en un CSS (`--x: valor`), sin contar los usos `var(--x)`. */
export function tokensDeclarados(css: string): Set<string> {
  return new Set([...css.matchAll(DECLARACION)].map((coincidencia) => coincidencia[1] as string));
}

function hojas(valor: unknown, acumulado: string[]): string[] {
  if (Array.isArray(valor)) {
    for (const elemento of valor) hojas(elemento, acumulado);
  } else if (valor !== null && typeof valor === 'object') {
    for (const elemento of Object.values(valor)) hojas(elemento, acumulado);
  } else {
    acumulado.push(String(valor));
  }
  return acumulado;
}

/** Hojas del tema que no son `var(--x)` con `--x` declarada: literales (hex, px, números) o variables inexistentes. */
export function valoresInvalidos(tema: unknown, declarados: ReadonlySet<string>): string[] {
  return hojas(tema, []).filter((hoja) => {
    const nombre = USO_VAR.exec(hoja)?.[1];
    return nombre === undefined || !declarados.has(nombre);
  });
}

/** Nombres de variable (`--x`) referenciados por las hojas del tema con `var(--x)`, sin duplicados. */
export function tokensReferenciados(tema: unknown): string[] {
  const nombres = hojas(tema, []).flatMap((hoja) => {
    const nombre = USO_VAR.exec(hoja)?.[1];
    return nombre === undefined ? [] : [nombre];
  });
  return [...new Set(nombres)];
}
