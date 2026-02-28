import { createHash } from 'crypto';
import { runPs, psEscape } from './powershell';
import type { StartupItem } from '@shared/types';

function makeId(location: string, name: string): string {
  return createHash('sha256').update(`${location}:${name}`).digest('hex').slice(0, 12);
}

interface RawStartupItem {
  readonly name: string;
  readonly command: string;
  readonly location: 'hkcu' | 'hklm' | 'folder';
  readonly enabled: boolean;
  readonly fileName: string; // actual registry value name or file name on disk
}

export class StartupManager {
  private lastItems: ReadonlyArray<StartupItem & { readonly fileName: string }> = [];

  async getStartupItems(): Promise<StartupItem[]> {
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
    ].join('\n');

    try {
      const raw = await runPs(script);
      const json: RawStartupItem[] = raw === '[]' ? [] : (() => {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
      })();

      const items = json.map((p) => ({
        id: makeId(p.location, p.name),
        name: p.name,
        command: p.command,
        location: p.location,
        enabled: p.enabled,
        isAdmin: p.location === 'hklm',
        fileName: p.fileName,
      }));

      this.lastItems = items;
      return items.map(({ fileName: _fn, ...rest }) => rest);
    } catch (error) {
      throw new Error(`Failed to read startup items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async toggleStartupItem(id: string): Promise<{ success: boolean; error?: string }> {
    const item = this.lastItems.find((i) => i.id === id);
    if (!item) {
      return { success: false, error: 'Item not found — try refreshing' };
    }
    if (item.isAdmin) {
      return { success: false, error: 'Cannot modify system startup items (requires Admin)' };
    }

    try {
      if (item.location === 'hkcu') {
        const regPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
        const currentName = psEscape(item.fileName);
        const newName = psEscape(item.enabled ? `!${item.name}` : item.name);
        const script = [
          `$path = '${regPath}'`,
          `$val = (Get-ItemProperty -Path $path).'${currentName}'`,
          `Remove-ItemProperty -Path $path -Name '${currentName}'`,
          `New-ItemProperty -Path $path -Name '${newName}' -Value $val -PropertyType String | Out-Null`,
        ].join('\n');
        await runPs(script);
      } else if (item.location === 'folder') {
        const currentFile = psEscape(item.fileName);
        const newFile = psEscape(
          item.enabled
            ? `${item.fileName}.disabled`
            : item.fileName.replace(/\.disabled$/, ''),
        );
        const script = [
          `$folder = [Environment]::GetFolderPath('Startup')`,
          `Rename-Item -Path (Join-Path $folder '${currentFile}') -NewName '${newFile}'`,
        ].join('\n');
        await runPs(script);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async removeStartupItem(id: string): Promise<{ success: boolean; error?: string }> {
    const item = this.lastItems.find((i) => i.id === id);
    if (!item) {
      return { success: false, error: 'Item not found — try refreshing' };
    }
    if (item.isAdmin) {
      return { success: false, error: 'Cannot remove system startup items (requires Admin)' };
    }

    try {
      if (item.location === 'hkcu') {
        const regPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
        const currentName = psEscape(item.fileName);
        const script = `Remove-ItemProperty -Path '${regPath}' -Name '${currentName}'`;
        await runPs(script);
      } else if (item.location === 'folder') {
        const currentFile = psEscape(item.fileName);
        const script = [
          `$folder = [Environment]::GetFolderPath('Startup')`,
          `Remove-Item -Path (Join-Path $folder '${currentFile}') -Force`,
        ].join('\n');
        await runPs(script);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
