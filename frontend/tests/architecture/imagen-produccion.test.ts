// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const leer = (ruta: string): string => readFileSync(new URL(ruta, import.meta.url), 'utf8');

const PACKAGE = JSON.parse(leer('../../package.json')) as { scripts: Record<string, string> };
const sinCr = (texto: string): string => texto.replaceAll('\r\n', '\n');
const DOCKERFILE = sinCr(leer('../../Dockerfile'));
const COMPOSE = sinCr(leer('../../../docker-compose.yml'));

/** Etapas de un Dockerfile multi-stage: nombre -> instrucciones de esa etapa. */
function etapas(dockerfile: string): Record<string, string> {
  const resultado: Record<string, string> = {};
  let nombre = '';
  for (const linea of dockerfile.split('\n')) {
    const desde = /^FROM\s+\S+\s+AS\s+(\S+)/i.exec(linea);
    if (desde?.[1] !== undefined) {
      nombre = desde[1];
      resultado[nombre] = '';
    } else if (nombre !== '') {
      resultado[nombre] += `${linea}\n`;
    }
  }
  return resultado;
}

/** Bloque (líneas con más sangría) de un servicio de `docker-compose.yml`. */
function servicio(nombre: string): string {
  const lineas = COMPOSE.split('\n');
  const inicio = lineas.findIndex((linea) => linea === `  ${nombre}:`);
  if (inicio === -1) return '';
  const resto = lineas.slice(inicio + 1);
  const fin = resto.findIndex((linea) => /^ {0,2}\S/.test(linea));
  return resto.slice(0, fin === -1 ? undefined : fin).join('\n');
}

describe('script de build', () => {
  it('valida tipos y genera el sitio estático', () => {
    expect(PACKAGE.scripts.build).toBe('tsc --noEmit -p tsconfig.json && vite build');
  });
});

describe('Dockerfile del frontend', () => {
  const porEtapa = etapas(DOCKERFILE);

  it('tiene los objetivos dev y prod', () => {
    expect(Object.keys(porEtapa)).toEqual(expect.arrayContaining(['dev', 'prod']));
  });

  it('dev sigue levantando el servidor de desarrollo de Vite', () => {
    expect(porEtapa.dev).toContain('npm", "run", "dev"');
  });

  it('prod sirve el build con un servidor estático y no ejecuta npm run dev', () => {
    expect(porEtapa.prod).toMatch(/nginx/i);
    expect(porEtapa.prod).toContain('/app/dist');
    expect(porEtapa.prod).not.toMatch(/npm.*run.*dev/);
  });

  it('el build recibe VITE_API_URL en tiempo de construcción y ejecuta npm run build', () => {
    const construccion = Object.values(porEtapa).find((etapa) => etapa.includes('npm run build'));

    expect(construccion).toBeDefined();
    expect(construccion).toMatch(/ARG VITE_API_URL/);
    expect(DOCKERFILE).toMatch(/--from=design-system/);
  });

  it('la última etapa es prod: construir sin objetivo da la imagen de producción', () => {
    const nombres = Object.keys(porEtapa);

    expect(nombres[nombres.length - 1]).toBe('prod');
  });
});

describe('configuración del servidor estático', () => {
  it('cae en index.html para que el enrutado del cliente resuelva /mis-pedidos', () => {
    expect(leer('../../nginx.conf')).toMatch(/try_files\s+\$uri\s+\/index\.html/);
  });
});

describe('docker-compose.yml', () => {
  it('el servicio frontend por defecto usa el objetivo dev y publica 5173', () => {
    const frontend = servicio('frontend');

    expect(frontend).toMatch(/target:\s*dev/);
    expect(frontend).toContain('5173:5173');
    expect(frontend).not.toContain('profiles');
  });

  it('frontend-prod solo existe bajo el perfil prod, con objetivo prod y contexto del design system', () => {
    const produccion = servicio('frontend-prod');

    expect(produccion).toMatch(/profiles:\s*\[\s*"prod"\s*\]/);
    expect(produccion).toMatch(/target:\s*prod/);
    expect(produccion).toMatch(/design-system:\s*\.\/design-system/);
    expect(produccion).toContain('VITE_API_URL');
  });
});
