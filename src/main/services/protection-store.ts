import { EventEmitter } from 'events';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { ProtectionRule } from '@shared/types';
import { SYSTEM_PROTECTED } from './platform';

const STORE_FILE = 'protection-rules.json';

function buildBuiltInRules(): ProtectionRule[] {
  return [...SYSTEM_PROTECTED].map((name) => ({
    id: `builtin-${name}`,
    pattern: name,
    label: name.replace('.exe', ''),
    mode: 'protect' as const,
    builtIn: true,
    enabled: true,
    createdAt: 0,
  }));
}

export class ProtectionStore extends EventEmitter {
  private rules: ProtectionRule[] = [];
  private readonly filePath: string;

  constructor() {
    super();
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, STORE_FILE);
  }

  start(): void {
    this.load();
  }

  stop(): void {
    this.save();
  }

  getRules(): ProtectionRule[] {
    return [...this.rules];
  }

  addRule(input: Omit<ProtectionRule, 'id' | 'builtIn' | 'createdAt'>): ProtectionRule {
    const rule: ProtectionRule = {
      ...input,
      id: crypto.randomUUID(),
      builtIn: false,
      createdAt: Date.now(),
    };
    this.rules = [...this.rules, rule];
    this.save();
    this.emit('rules-changed', this.rules);
    return rule;
  }

  removeRule(id: string): void {
    const rule = this.rules.find((r) => r.id === id);
    if (!rule || rule.builtIn) return;
    this.rules = this.rules.filter((r) => r.id !== id);
    this.save();
    this.emit('rules-changed', this.rules);
  }

  updateRule(id: string, updates: Partial<Pick<ProtectionRule, 'enabled' | 'mode' | 'label'>>): ProtectionRule | null {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const existing = this.rules[index];
    const updated: ProtectionRule = {
      ...existing,
      ...updates,
    };
    this.rules = this.rules.map((r) => (r.id === id ? updated : r));
    this.save();
    this.emit('rules-changed', this.rules);
    return updated;
  }

  isProtected(name: string): boolean {
    return this.rules.some(
      (r) => r.enabled && r.mode === 'protect' && r.pattern === name,
    );
  }

  isWatched(name: string): boolean {
    return this.rules.some(
      (r) => r.enabled && r.pattern === name,
    );
  }

  getProtectionStatus(name: string): 'protect' | 'watch' | 'none' {
    for (const rule of this.rules) {
      if (!rule.enabled || rule.pattern !== name) continue;
      if (rule.mode === 'protect') return 'protect';
      if (rule.mode === 'watch') return 'watch';
    }
    return 'none';
  }

  private load(): void {
    const builtIn = buildBuiltInRules();

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Invalid format');
        // Validate each rule's shape before accepting
        const userRules = parsed.filter((r: unknown): r is ProtectionRule => {
          if (typeof r !== 'object' || r === null) return false;
          const o = r as Record<string, unknown>;
          return (
            typeof o.id === 'string' &&
            typeof o.pattern === 'string' &&
            typeof o.label === 'string' &&
            (o.mode === 'watch' || o.mode === 'protect') &&
            typeof o.enabled === 'boolean' &&
            typeof o.createdAt === 'number' &&
            !o.builtIn
          );
        });
        this.rules = [...builtIn, ...userRules];
      } else {
        this.rules = builtIn;
      }
    } catch {
      this.rules = builtIn;
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Only persist user (non-builtIn) rules
      const userRules = this.rules.filter((r) => !r.builtIn);
      fs.writeFileSync(this.filePath, JSON.stringify(userRules, null, 2), 'utf-8');
    } catch {
      // Silently ignore save failures — rules still available in memory
    }
  }
}
