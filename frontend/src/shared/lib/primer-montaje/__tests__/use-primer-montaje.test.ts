import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePrimerMontaje } from '../use-primer-montaje';

describe('usePrimerMontaje', () => {
  it('devuelve true en el primer render y false en los siguientes', () => {
    const { result, rerender } = renderHook(() => usePrimerMontaje());

    expect(result.current).toBe(true);
    rerender();
    expect(result.current).toBe(false);
    rerender();
    expect(result.current).toBe(false);
  });

  it('cada montaje nuevo vuelve a empezar en true; el estado no se comparte entre instancias', () => {
    const primera = renderHook(() => usePrimerMontaje());
    primera.rerender();
    const segunda = renderHook(() => usePrimerMontaje());

    expect(primera.result.current).toBe(false);
    expect(segunda.result.current).toBe(true);
  });

  it('no provoca un re-render propio: cambiar de valor solo pasa cuando el componente se vuelve a renderizar', () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return usePrimerMontaje();
    });

    expect(renders).toBe(1);
  });
});
