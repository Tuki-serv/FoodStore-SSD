import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setViewport } from '@/test/viewport';
import { useMediaQuery } from '../use-media-query';

const DESKTOP = '(min-width: 1024px)';

describe('useMediaQuery', () => {
  it('es true con un viewport de escritorio', () => {
    setViewport(1440);

    const { result } = renderHook(() => useMediaQuery(DESKTOP));

    expect(result.current).toBe(true);
  });

  it('es false con un viewport de celular', () => {
    setViewport(390);

    const { result } = renderHook(() => useMediaQuery(DESKTOP));

    expect(result.current).toBe(false);
  });

  it('se actualiza cuando el viewport cruza el breakpoint, en ambos sentidos', () => {
    setViewport(1440);
    const { result } = renderHook(() => useMediaQuery(DESKTOP));

    act(() => setViewport(390));
    expect(result.current).toBe(false);

    act(() => setViewport(1024));
    expect(result.current).toBe(true);
  });
});
