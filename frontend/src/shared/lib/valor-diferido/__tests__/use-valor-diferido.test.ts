import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useValorDiferido } from '../use-valor-diferido';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useValorDiferido', () => {
  it('«b», «bu», «burger» seguidos: sigue en el valor inicial a los 299 ms y toma «burger» a los 300 ms', () => {
    const { result, rerender } = renderHook(({ valor }) => useValorDiferido(valor, 300), { initialProps: { valor: '' } });

    rerender({ valor: 'b' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ valor: 'bu' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ valor: 'burger' });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('burger');
  });

  it('un cambio nuevo reinicia la espera', () => {
    const { result, rerender } = renderHook(({ valor }) => useValorDiferido(valor, 300), { initialProps: { valor: 'a' } });

    rerender({ valor: 'ab' });
    act(() => vi.advanceTimersByTime(250));
    rerender({ valor: 'abc' });
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe('abc');
  });

  it('al desmontar no queda ningún timer pendiente', () => {
    const { rerender, unmount } = renderHook(({ valor }) => useValorDiferido(valor, 300), { initialProps: { valor: 'a' } });
    rerender({ valor: 'b' });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
