import { runPs } from './powershell';
import type { EnvVar } from '@shared/types';

export class EnvReader {
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
    ].join('\n');

    try {
      const raw = await runPs(script);
      if (raw === '[]') return [];
      const json = JSON.parse(raw);
      const parsed: EnvVar[] = Array.isArray(json) ? json : [json];
      return parsed;
    } catch (error) {
      throw new Error(`Failed to read environment variables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
