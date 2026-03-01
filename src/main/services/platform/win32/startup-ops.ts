import type { StartupOps, RawStartupItem } from '../types'
import { runPs, psEscape } from './shell'

export function createWin32StartupOps(): StartupOps {
  return {
    async getStartupItems(): Promise<RawStartupItem[]> {
      const script = [
        '$items = @()',
        '',
        '# HKCU Run (user startup, can toggle)',
        '$hkcuPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"',
        'if (Test-Path $hkcuPath) {',
        '  $reg = Get-Item $hkcuPath',
        '  foreach ($name in $reg.GetValueNames()) {',
        '    if ($name -eq "") { continue }',
        '    $enabled = -not $name.StartsWith("!")',
        '    $displayName = if ($enabled) { $name } else { $name.Substring(1) }',
        '    $items += @{',
        '      name = $displayName',
        '      command = $reg.GetValue($name)',
        '      location = "hkcu"',
        '      enabled = $enabled',
        '      fileName = $name',
        '    }',
        '  }',
        '}',
        '',
        '# HKLM Run (system startup, read-only)',
        '$hklmPath = "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"',
        'if (Test-Path $hklmPath) {',
        '  $reg = Get-Item $hklmPath',
        '  foreach ($name in $reg.GetValueNames()) {',
        '    if ($name -eq "") { continue }',
        '    $enabled = -not $name.StartsWith("!")',
        '    $displayName = if ($enabled) { $name } else { $name.Substring(1) }',
        '    $items += @{',
        '      name = $displayName',
        '      command = $reg.GetValue($name)',
        '      location = "hklm"',
        '      enabled = $enabled',
        '      fileName = $name',
        '    }',
        '  }',
        '}',
        '',
        '# Startup folder files',
        '$folder = [Environment]::GetFolderPath("Startup")',
        'if (Test-Path $folder) {',
        '  Get-ChildItem $folder -File | ForEach-Object {',
        '    $enabled = $_.Extension -ne ".disabled"',
        '    $displayName = if ($enabled) { $_.BaseName } else { [System.IO.Path]::GetFileNameWithoutExtension($_.BaseName) }',
        '    $items += @{',
        '      name = $displayName',
        '      command = $_.FullName',
        '      location = "folder"',
        '      enabled = $enabled',
        '      fileName = $_.Name',
        '    }',
        '  }',
        '}',
        '',
        'if ($items.Count -eq 0) { "[]" } else { $items | ConvertTo-Json -Compress }',
      ].join('\n')

      const raw = await runPs(script)
      if (raw === '[]') return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : [parsed]
    },

    async toggleStartupItem(item): Promise<{ success: boolean; error?: string }> {
      if (item.isAdmin) {
        return { success: false, error: 'Cannot modify system startup items (requires Admin)' }
      }

      try {
        if (item.location === 'hkcu') {
          const regPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
          const currentName = psEscape(item.fileName)
          const newName = psEscape(item.enabled ? `!${item.name}` : item.name)
          const script = [
            `$path = '${regPath}'`,
            `$val = (Get-ItemProperty -Path $path).'${currentName}'`,
            `Remove-ItemProperty -Path $path -Name '${currentName}'`,
            `New-ItemProperty -Path $path -Name '${newName}' -Value $val -PropertyType String | Out-Null`,
          ].join('\n')
          await runPs(script)
        } else if (item.location === 'folder') {
          const currentFile = psEscape(item.fileName)
          const newFile = psEscape(
            item.enabled
              ? `${item.fileName}.disabled`
              : item.fileName.replace(/\.disabled$/, ''),
          )
          const script = [
            `$folder = [Environment]::GetFolderPath('Startup')`,
            `Rename-Item -Path (Join-Path $folder '${currentFile}') -NewName '${newFile}'`,
          ].join('\n')
          await runPs(script)
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    },

    async removeStartupItem(item): Promise<{ success: boolean; error?: string }> {
      if (item.isAdmin) {
        return { success: false, error: 'Cannot remove system startup items (requires Admin)' }
      }

      try {
        if (item.location === 'hkcu') {
          const regPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
          const currentName = psEscape(item.fileName)
          const script = `Remove-ItemProperty -Path '${regPath}' -Name '${currentName}'`
          await runPs(script)
        } else if (item.location === 'folder') {
          const currentFile = psEscape(item.fileName)
          const script = [
            `$folder = [Environment]::GetFolderPath('Startup')`,
            `Remove-Item -Path (Join-Path $folder '${currentFile}') -Force`,
          ].join('\n')
          await runPs(script)
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
