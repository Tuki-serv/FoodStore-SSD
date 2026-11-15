// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VARIABLES_FRONTEND } from '../env';

function clavesDe(archivo: string): string[] {
  return readFileSync(resolve(process.cwd(), archivo), 'utf8')
    .split('\n')
    .map((linea) => /^([A-Z][A-Z0-9_]*)=/.exec(linea)?.[1])
    .filter((clave): clave is string => clave !== undefined);
}

describe('frontend/.env.example', () => {
  it('declara exactamente las variables que lee readConfig', () => {
    expect(clavesDe('.env.example').sort()).toEqual([...VARIABLES_FRONTEND].sort());
    expect([...VARIABLES_FRONTEND]).toEqual(['VITE_API_URL']);
  });
});
