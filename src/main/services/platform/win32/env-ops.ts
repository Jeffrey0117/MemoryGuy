import type { EnvOps } from '../types'
import type { EnvVar } from '@shared/types'
import { runPs } from './shell'

export function createWin32EnvOps(): EnvOps {
  return {
    async getEnvVars(): Promise<EnvVar[]> {
      const script = [
        '$vars = @()',
        '',
        '# System environment variables',
        '$sysPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"',
        'if (Test-Path $sysPath) {',
        '  $reg = Get-Item $sysPath',
        '  foreach ($name in $reg.GetValueNames()) {',
        '    if ($name -eq "") { continue }',
        '    $vars += @{ name = $name; value = [string]$reg.GetValue($name, "", "DoNotExpandEnvironmentNames"); scope = "system" }',
        '  }',
        '}',
        '',
        '# User environment variables',
        '$userPath = "HKCU:\\Environment"',
        'if (Test-Path $userPath) {',
        '  $reg = Get-Item $userPath',
        '  foreach ($name in $reg.GetValueNames()) {',
        '    if ($name -eq "") { continue }',
        '    $vars += @{ name = $name; value = [string]$reg.GetValue($name, "", "DoNotExpandEnvironmentNames"); scope = "user" }',
        '  }',
        '}',
        '',
        'if ($vars.Count -eq 0) { "[]" } else { $vars | ConvertTo-Json -Compress }',
      ].join('\n')

      const raw = await runPs(script)
      if (raw === '[]') return []
      const json = JSON.parse(raw)
      return Array.isArray(json) ? json : [json]
    },
  }
}
