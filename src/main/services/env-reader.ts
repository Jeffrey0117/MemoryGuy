import { getPlatform } from './platform';
import type { EnvVar } from '@shared/types';

export class EnvReader {
  async getEnvVars(): Promise<EnvVar[]> {
    try {
      return await getPlatform().envOps.getEnvVars();
    } catch (error) {
      throw new Error(`Failed to read environment variables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
