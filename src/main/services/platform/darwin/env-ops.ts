import fs from 'fs'
import path from 'path'
import os from 'os'
import type { EnvOps } from '../types'
import type { EnvVar } from '@shared/types'

const SYSTEM_ENV_FILES = ['/etc/environment']
const USER_ENV_FILES = [
  path.join(os.homedir(), '.zshenv'),
  path.join(os.homedir(), '.bash_profile'),
  path.join(os.homedir(), '.bashrc'),
  path.join(os.homedir(), '.profile'),
]

function parseEnvFile(filePath: string, scope: 'system' | 'user'): EnvVar[] {
  try {
    if (!fs.existsSync(filePath)) return []
    const content = fs.readFileSync(filePath, 'utf-8')
    const vars: EnvVar[] = []

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      // Match: export KEY=VALUE or KEY=VALUE
      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match) continue
      const name = match[1]
      let value = match[2]
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      vars.push({ name, value, scope })
    }

    return vars
  } catch {
    return []
  }
}

export function createDarwinEnvOps(): EnvOps {
  return {
    async getEnvVars(): Promise<EnvVar[]> {
      const vars: EnvVar[] = []

      for (const filePath of SYSTEM_ENV_FILES) {
        vars.push(...parseEnvFile(filePath, 'system'))
      }

      for (const filePath of USER_ENV_FILES) {
        vars.push(...parseEnvFile(filePath, 'user'))
      }

      return vars
    },
  }
}
