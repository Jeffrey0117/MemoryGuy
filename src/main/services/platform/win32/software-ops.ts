import { execFile } from 'child_process'
import type { SoftwareOps, RawInstalledSoftware } from '../types'

const UNINSTALL_TIMEOUT = 120_000
const PS_TIMEOUT = 30_000
const MAX_BUFFER = 8 * 1024 * 1024 // 8 MB — software lists can be large

function runPsLarge(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: PS_TIMEOUT, maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.trim() || err.message))
        } else {
          resolve(stdout.trim())
        }
      },
    )
  })
}

/** Parse an uninstall string into executable + arguments (avoids cmd.exe shell) */
function parseUninstallString(raw: string): { exe: string; args: string[] } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Quoted executable: "C:\path to\uninstall.exe" /silent /norestart
  const quotedMatch = trimmed.match(/^"([^"]+)"(.*)$/)
  if (quotedMatch) {
    const exe = quotedMatch[1]
    const rest = quotedMatch[2].trim()
    return { exe, args: rest ? rest.split(/\s+/) : [] }
  }

  // Unquoted: find the .exe boundary
  const exeMatch = trimmed.match(/^(.+?\.exe)\b(.*)$/i)
  if (exeMatch) {
    const exe = exeMatch[1]
    const rest = exeMatch[2].trim()
    return { exe, args: rest ? rest.split(/\s+/) : [] }
  }

  return null
}

function runExeDirect(exe: string, args: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    execFile(
      exe,
      args,
      { timeout: UNINSTALL_TIMEOUT },
      (err, _stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr?.trim() || err.message })
        } else {
          resolve({ success: true })
        }
      },
    )
  })
}

export function createWin32SoftwareOps(): SoftwareOps {
  return {
    async getInstalledSoftware(): Promise<RawInstalledSoftware[]> {
      const script = [
        '$paths = @(',
        '  "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",',
        '  "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",',
        '  "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"',
        ')',
        '$items = @()',
        'foreach ($p in $paths) {',
        '  try {',
        '    Get-ItemProperty -Path $p -ErrorAction SilentlyContinue | ForEach-Object {',
        '      $dn = $_.DisplayName',
        '      if (-not $dn) { return }',
        '      if ($_.SystemComponent -eq 1) { return }',
        '      if ($_.ParentKeyName) { return }',
        '      if ($dn -match "^KB\\d") { return }',
        '      if ($_.WindowsInstaller -eq 1 -and -not $_.UninstallString) { return }',
        '      $items += @{',
        '        registryKey = $_.PSPath',
        '        name = [string]$dn',
        '        publisher = if ($_.Publisher) { [string]$_.Publisher } else { "" }',
        '        version = if ($_.DisplayVersion) { [string]$_.DisplayVersion } else { "" }',
        '        installDate = if ($_.InstallDate) { [string]$_.InstallDate } else { "" }',
        '        estimatedSize = if ($_.EstimatedSize) { [int64]$_.EstimatedSize * 1024 } else { 0 }',
        '        quietUninstallString = if ($_.QuietUninstallString) { [string]$_.QuietUninstallString } else { "" }',
        '        uninstallString = if ($_.UninstallString) { [string]$_.UninstallString } else { "" }',
        '        isSystemComponent = [bool]($_.SystemComponent -eq 1)',
        '      }',
        '    }',
        '  } catch {}',
        '}',
        'if ($items.Count -eq 0) { "[]" } else { $items | ConvertTo-Json -Compress -Depth 2 }',
      ].join('\n')

      const raw = await runPsLarge(script)
      if (raw === '[]' || !raw) return []
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        return []
      }
    },

    async uninstallSoftware(item): Promise<{ success: boolean; error?: string }> {
      // Prefer QuietUninstallString (silent uninstall)
      if (item.quietUninstallString) {
        const parsed = parseUninstallString(item.quietUninstallString)
        if (parsed) return runExeDirect(parsed.exe, parsed.args)
      }

      // MSI uninstall: extract product code — use msiexec directly with arg array
      const msiMatch = item.uninstallString.match(/\{[0-9A-Fa-f\-]+\}/)
      if (msiMatch) {
        return runExeDirect('msiexec.exe', ['/x', msiMatch[0], '/qn'])
      }

      // Fallback: parse UninstallString into exe + args (may open GUI)
      if (item.uninstallString) {
        const parsed = parseUninstallString(item.uninstallString)
        if (parsed) return runExeDirect(parsed.exe, parsed.args)
      }

      return { success: false, error: 'No uninstall command available' }
    },
  }
}
