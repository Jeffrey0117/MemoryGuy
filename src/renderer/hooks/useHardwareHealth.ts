import { useState, useCallback } from 'react';
import type { HardwareHealth, MemoryGuyAPI } from '@shared/types';

const api = (window as unknown as { memoryGuy: MemoryGuyAPI }).memoryGuy;

export function useHardwareHealth() {
  const [health, setHealth] = useState<HardwareHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getHardwareHealth();
      setHealth(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hardware check failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { health, isLoading, error, load };
}
