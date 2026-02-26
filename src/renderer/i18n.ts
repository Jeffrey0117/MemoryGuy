export type Locale = 'en' | 'zh';

const translations = {
  // App
  'app.title': { en: 'MEMORYGUY', zh: 'MEMORYGUY' },
  'app.version': { en: 'v0.1.0', zh: 'v0.1.0' },

  // Tabs
  'tab.dashboard': { en: 'Dashboard', zh: '儀表板' },
  'tab.processes': { en: 'Processes', zh: '程序' },
  'tab.actions': { en: 'Quick Actions', zh: '快速操作' },

  // Dashboard
  'dashboard.loading': { en: 'Loading system info...', zh: '載入系統資訊...' },
  'dashboard.ramUsage': { en: 'RAM Usage', zh: 'RAM 使用量' },
  'dashboard.cpuLoad': { en: 'CPU Load', zh: 'CPU 負載' },
  'dashboard.ramHistory': { en: 'RAM History (30 min)', zh: 'RAM 歷史 (30 分鐘)' },
  'dashboard.cpuHistory': { en: 'CPU History (30 min)', zh: 'CPU 歷史 (30 分鐘)' },

  // Process List
  'process.loading': { en: 'Loading processes...', zh: '載入程序...' },
  'process.search': { en: 'Search by name or PID...', zh: '搜尋名稱或 PID...' },
  'process.group': { en: 'Group', zh: '分組' },
  'process.count': { en: 'processes', zh: '個程序' },
  'process.none': { en: 'No processes found', zh: '找不到程序' },
  'process.name': { en: 'Name', zh: '名稱' },
  'process.ram': { en: 'RAM', zh: 'RAM' },
  'process.cpu': { en: 'CPU', zh: 'CPU' },
  'process.trend': { en: 'Trend', zh: '趨勢' },
  'process.action': { en: 'Action', zh: '操作' },
  'process.kill': { en: 'Kill', zh: '終止' },
  'process.killAll': { en: 'Kill All', zh: '全部終止' },
  'process.killAllConfirm': { en: 'Kill All?', zh: '確定全部終止？' },
  'process.sure': { en: 'Sure?', zh: '確定？' },

  // Quick Actions
  'actions.loading': { en: 'Loading...', zh: '載入中...' },
  'actions.oneClick': { en: 'One-Click Optimize', zh: '一鍵優化' },
  'actions.oneClickDesc': {
    en: 'Safely reclaims unused memory — no apps will be closed',
    zh: '安全回收未使用的記憶體 — 不會關閉任何應用程式',
  },
  'actions.analyze': { en: 'Analyze', zh: '分析' },
  'actions.analyzing': { en: 'Analyzing...', zh: '分析中...' },
  'actions.optimizeNow': { en: 'Optimize Now', zh: '立即優化' },
  'actions.trimming': { en: 'Trimming...', zh: '優化中...' },
  'actions.ramStatus': { en: 'RAM', zh: 'RAM' },
  'actions.estimatedReclaimable': { en: 'Estimated reclaimable', zh: '預估可回收' },
  'actions.across': { en: 'across', zh: '橫跨' },
  'actions.processes': { en: 'processes', zh: '個程序' },
  'actions.done': { en: 'Done —', zh: '完成 —' },
  'actions.trimmed': { en: 'Trimmed', zh: '已優化' },
  'actions.reclaimed': { en: 'reclaimed', zh: '已回收' },
  'actions.trimFailed': { en: 'could not be trimmed (access denied)', zh: '無法優化（權限不足）' },
  'actions.noPermission': {
    en: 'No processes could be trimmed — try running as Administrator for full access',
    zh: '無法優化任何程序 — 以系統管理員身分執行可獲得完整權限',
  },

  // Recommendations
  'rec.title': { en: 'Recommendations', zh: '建議' },
  'rec.healthy': { en: 'No issues detected — system looks healthy', zh: '未偵測到問題 — 系統運作正常' },
  'rec.leak': { en: 'LEAK', zh: '洩漏' },
  'rec.suspect': { en: 'Suspect', zh: '疑似' },
  'rec.idle': { en: 'Idle', zh: '閒置' },
  'rec.end': { en: 'End', zh: '結束' },
  'rec.endProcess': { en: 'End process?', zh: '結束程序？' },
  'rec.multiProcess': { en: 'Multi-process', zh: '多程序' },
  'rec.multiProcessApps': { en: 'Multi-Process Apps', zh: '多程序應用' },

  // Auto-Protect
  'protect.title': { en: 'Auto-Protect', zh: '自動保護' },
  'protect.enable': { en: 'Enable auto-protect', zh: '啟用自動保護' },
  'protect.ramThreshold': { en: 'RAM threshold', zh: 'RAM 閾值' },
  'protect.autoTrim': { en: 'Auto-trim memory', zh: '自動優化記憶體' },
  'protect.autoTrimDesc': {
    en: 'Safely reclaim unused memory when threshold exceeded (no apps closed)',
    zh: '超過閾值時安全回收未使用的記憶體（不會關閉應用程式）',
  },

  // Manual Kill
  'manual.title': { en: 'Advanced: Manual Process Control', zh: '進階：手動程序控制' },
  'manual.warning': {
    en: 'Warning: Killing processes may cause data loss. Multi-process apps (Chrome, VS Code, Edge) will crash if their processes are terminated.',
    zh: '警告：終止程序可能導致資料遺失。多程序應用（Chrome、VS Code、Edge）如果其程序被終止將會崩潰。',
  },
  'manual.showingOf': { en: 'Showing 50 of', zh: '顯示 50 個，共' },
  'manual.useSearch': { en: '— use search to filter', zh: '— 使用搜尋過濾' },

  // Leak Alert
  'leak.critical': { en: 'CRITICAL LEAK', zh: '嚴重洩漏' },
  'leak.suspect': { en: 'SUSPECT', zh: '疑似洩漏' },
  'leak.dismiss': { en: 'Dismiss', zh: '忽略' },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, locale: Locale): string {
  return translations[key]?.[locale] ?? key;
}

export { translations, type TranslationKey };
