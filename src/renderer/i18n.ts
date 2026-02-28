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
  'protect.desc': {
    en: 'Automatically reclaim unused memory when RAM usage exceeds the threshold — no apps will be closed',
    zh: '當 RAM 使用率超過閾值時，自動回收閒置記憶體 — 不會關閉任何應用程式',
  },
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

  // Tabs (new)
  'tab.guardian': { en: 'Guardian', zh: '守護' },
  'tab.devservers': { en: 'Dev Servers', zh: '開發伺服器' },

  // Guardian
  'guardian.title': { en: 'Process Guardian', zh: '程序守護' },
  'guardian.rules': { en: 'Protection Rules', zh: '保護規則' },
  'guardian.addRule': { en: 'Add Rule', zh: '新增規則' },
  'guardian.pattern': { en: 'Pattern', zh: '匹配名稱' },
  'guardian.label': { en: 'Label', zh: '標籤' },
  'guardian.mode': { en: 'Mode', zh: '模式' },
  'guardian.modeWatch': { en: 'Watch', zh: '監控' },
  'guardian.modeProtect': { en: 'Protect', zh: '保護' },
  'guardian.enabled': { en: 'Enabled', zh: '啟用' },
  'guardian.builtIn': { en: 'Built-in', zh: '內建' },
  'guardian.custom': { en: 'Custom', zh: '自訂' },
  'guardian.remove': { en: 'Remove', zh: '移除' },
  'guardian.watchedProcesses': { en: 'Watched Processes', zh: '監控中的程序' },
  'guardian.noWatched': { en: 'No watched processes running', zh: '沒有監控中的程序在執行' },
  'guardian.eventLog': { en: 'Event Log', zh: '事件紀錄' },
  'guardian.noEvents': { en: 'No termination events recorded', zh: '沒有終止事件紀錄' },
  'guardian.clearLog': { en: 'Clear', zh: '清除' },
  'guardian.terminated': { en: 'terminated', zh: '已終止' },
  'guardian.hookGenerate': { en: 'Generate Hook', zh: '產生 Hook' },
  'guardian.hookSuccess': { en: 'Hook generated successfully', zh: 'Hook 產生成功' },
  'guardian.hookFailed': { en: 'Hook generation failed', zh: 'Hook 產生失敗' },
  'guardian.hookDesc': {
    en: 'Generate a Claude Code hook to block dangerous kill commands for protected processes',
    zh: '產生 Claude Code Hook 以攔截對受保護程序的危險終止指令',
  },

  // Dev Servers
  'devservers.title': { en: 'Dev Servers', zh: '開發伺服器' },
  'devservers.scan': { en: 'Scan Now', zh: '立即掃描' },
  'devservers.scanning': { en: 'Scanning...', zh: '掃描中...' },
  'devservers.empty': { en: 'No dev servers detected', zh: '未偵測到開發伺服器' },
  'devservers.emptyHint': {
    en: 'Start a dev server (e.g. npm run dev) and it will appear here',
    zh: '啟動開發伺服器（例如 npm run dev）即會顯示在此',
  },
  'devservers.open': { en: 'Open', zh: '開啟' },
  'devservers.kill': { en: 'Kill', zh: '終止' },
  'devservers.killConfirm': { en: 'Sure?', zh: '確定？' },
  'devservers.addProtect': { en: 'Protect', zh: '保護' },
  'devservers.search': { en: 'Search servers...', zh: '搜尋伺服器...' },
  'devservers.group': { en: 'Group', zh: '分組' },
  'devservers.ungrouped': { en: 'Standalone', zh: '獨立' },
  'devservers.autoRestart': { en: 'Auto-Restart', zh: '自動重啟' },
  'devservers.protected': { en: 'Protected', zh: '受保護' },
  'devservers.protectGroup': { en: 'Protect Group', zh: '保護群組' },
  'devservers.autoRestartOn': { en: 'Auto-restart enabled', zh: '已啟用自動重啟' },
  'devservers.autoRestartOff': { en: 'Enable auto-restart', zh: '啟用自動重啟' },

  // Startup Programs
  'tab.startup': { en: 'Startup', zh: '開機程式' },
  'startup.title': { en: 'Startup Programs', zh: '開機程式' },
  'startup.refresh': { en: 'Refresh', zh: '重新整理' },
  'startup.refreshing': { en: 'Refreshing...', zh: '重新整理中...' },
  'startup.search': { en: 'Search startup items...', zh: '搜尋開機程式...' },
  'startup.name': { en: 'Name', zh: '名稱' },
  'startup.command': { en: 'Command', zh: '指令' },
  'startup.location': { en: 'Location', zh: '來源' },
  'startup.enabled': { en: 'Enabled', zh: '啟用' },
  'startup.action': { en: 'Action', zh: '操作' },
  'startup.remove': { en: 'Remove', zh: '移除' },
  'startup.removeConfirm': { en: 'Sure?', zh: '確定？' },
  'startup.empty': { en: 'No startup items found', zh: '未找到開機程式' },
  'startup.adminOnly': { en: 'Admin only', zh: '需要管理員' },
  'startup.hkcu': { en: 'User', zh: '使用者' },
  'startup.hklm': { en: 'System', zh: '系統' },
  'startup.folder': { en: 'Folder', zh: '資料夾' },

  // Environment Variables
  'tab.envvars': { en: 'Env Vars', zh: '環境變數' },
  'envvars.title': { en: 'Environment Variables', zh: '環境變數' },
  'envvars.refresh': { en: 'Refresh', zh: '重新整理' },
  'envvars.refreshing': { en: 'Refreshing...', zh: '重新整理中...' },
  'envvars.search': { en: 'Search variables...', zh: '搜尋變數...' },
  'envvars.system': { en: 'System Variables', zh: '系統變數' },
  'envvars.user': { en: 'User Variables', zh: '使用者變數' },
  'envvars.copy': { en: 'Copy', zh: '複製' },
  'envvars.copied': { en: 'Copied!', zh: '已複製！' },
  'envvars.empty': { en: 'No environment variables found', zh: '未找到環境變數' },
  // Disk Cleanup
  'tab.diskcleanup': { en: 'Disk Cleanup', zh: '磁碟清理' },
  'diskcleanup.scan': { en: 'Scan All Drives', zh: '掃描所有磁碟' },
  'diskcleanup.scanning': { en: 'Scanning...', zh: '掃描中...' },
  'diskcleanup.cancel': { en: 'Cancel', zh: '取消' },
  'diskcleanup.clean': { en: 'Clean Selected', zh: '清理選取項目' },
  'diskcleanup.cleaning': { en: 'Cleaning...', zh: '清理中...' },
  'diskcleanup.empty': { en: 'No cleanup items found', zh: '未找到可清理項目' },
  'diskcleanup.emptyHint': { en: 'Click "Scan All Drives" to find junk files', zh: '點擊「掃描所有磁碟」來尋找垃圾檔案' },
  'diskcleanup.found': { en: 'found', zh: '已找到' },
  'diskcleanup.selected': { en: 'Selected', zh: '已選取' },
  'diskcleanup.freed': { en: 'Cleaned successfully', zh: '清理成功' },
  'diskcleanup.failed': { en: 'Failed to clean', zh: '清理失敗' },
  'diskcleanup.confirmClean': { en: 'Confirm Cleanup', zh: '確認清理' },
  'diskcleanup.confirmCleanDesc': {
    en: 'Delete {count} selected items ({size})? This cannot be undone.',
    zh: '刪除 {count} 個選取項目（{size}）？此操作無法復原。',
  },
  'diskcleanup.stale': { en: 'stale', zh: '老舊' },
  'diskcleanup.devDeps': { en: 'Dev Dependencies', zh: '開發相依套件' },
  'diskcleanup.devBuild': { en: 'Build Output', zh: '建置輸出' },
  'diskcleanup.pkgCache': { en: 'Package Cache', zh: '套件快取' },
  'diskcleanup.temp': { en: 'System Temp', zh: '系統暫存' },
  'diskcleanup.browserCache': { en: 'Browser Cache', zh: '瀏覽器快取' },
  'diskcleanup.recycleBin': { en: 'Recycle Bin', zh: '資源回收筒' },
  'diskcleanup.selectAll': { en: 'Select All', zh: '全選' },
  'diskcleanup.reinstallHint': {
    en: 'node_modules deleted — run "npm install" in affected projects before starting them',
    zh: 'node_modules 已刪除 — 啟動專案前請先在該目錄執行 npm install',
  },

  // Disk Virtualization
  'tab.virtualize': { en: 'Virtualize', zh: '虛擬化' },
  'virt.selectFolder': { en: 'Select Folder', zh: '選擇資料夾' },
  'virt.changeFolder': { en: 'Change', zh: '切換' },
  'virt.threshold': { en: 'Min size', zh: '最小大小' },
  'virt.loading': { en: 'Loading...', zh: '載入中...' },
  'virt.cancel': { en: 'Cancel', zh: '取消' },
  'virt.found': { en: 'found', zh: '已找到' },
  'virt.selectAll': { en: 'Select All', zh: '全選' },
  'virt.selected': { en: 'Selected', zh: '已選取' },
  'virt.files': { en: 'files', zh: '個檔案' },
  // File status
  'virt.status.original': { en: 'Original', zh: '原始檔' },
  'virt.status.virtualized': { en: 'Virtualized', zh: '已虛擬化' },
  // Actions
  'virt.virtualize': { en: 'Virtualize', zh: '虛擬化' },
  'virt.restore': { en: 'Restore', zh: '還原' },
  'virt.batchVirtualize': { en: 'Batch Virtualize', zh: '批次虛擬化' },
  'virt.batchRestore': { en: 'Batch Restore', zh: '批次還原' },
  'virt.virtualizing': { en: 'Virtualizing...', zh: '虛擬化中...' },
  'virt.restoring': { en: 'Restoring...', zh: '還原中...' },
  // Filters
  'virt.filter.all': { en: 'All', zh: '全部' },
  'virt.filter.video': { en: 'Video', zh: '影片' },
  'virt.filter.image': { en: 'Image', zh: '圖片' },
  'virt.filter.archive': { en: 'Archive', zh: '壓縮檔' },
  'virt.filter.document': { en: 'Document', zh: '文件' },
  'virt.filter.other': { en: 'Other', zh: '其他' },
  // Confirmation
  'virt.confirm.virtualize': { en: 'Confirm Virtualize', zh: '確認虛擬化' },
  'virt.confirm.virtualizeDesc': {
    en: 'Virtualize {count} files ({size})? Originals will be replaced with pointer files.',
    zh: '虛擬化 {count} 個檔案（{size}）？原始檔將替換為指標檔。',
  },
  'virt.confirm.restore': { en: 'Confirm Restore', zh: '確認還原' },
  'virt.confirm.restoreDesc': {
    en: 'Restore {count} files ({size}) from cloud?',
    zh: '從雲端還原 {count} 個檔案（{size}）？',
  },
  // Results
  'virt.result.virtualized': { en: 'Virtualized successfully', zh: '虛擬化成功' },
  'virt.result.restored': { en: 'Restored successfully', zh: '還原成功' },
  'virt.result.failed': { en: 'Errors', zh: '錯誤' },
  // Config
  'virt.config.title': { en: 'Storage Settings', zh: '儲存設定' },
  'virt.config.endpoint': { en: 'Endpoint URL', zh: '端點 URL' },
  'virt.config.fieldName': { en: 'Field Name', zh: '欄位名稱' },
  'virt.config.responsePath': { en: 'Response URL Path', zh: '回應 URL 路徑' },
  'virt.config.save': { en: 'Save', zh: '儲存' },
  'virt.config.variant': { en: 'Service', zh: '服務類型' },
  'virt.config.video': { en: 'Video', zh: '影片' },
  'virt.config.audio': { en: 'Audio', zh: '音訊' },
  'virt.config.general': { en: 'General', zh: '通用' },
  'virt.config.apiKey': { en: 'API Key', zh: 'API 金鑰' },
  'virt.config.routingHint': { en: 'Tip: duky=video, dukic=audio, dukbox=any file type', zh: '提示：duky=影片、dukic=音訊、dukbox=所有檔案類型' },
  'virt.config.selfHostedHint': { en: 'Self-hosted refile server — POST /upload, GET file URL, HEAD verify', zh: '自架 refile 伺服器 — POST /upload 上傳、GET 檔案 URL、HEAD 驗證' },
  // Empty / no config
  'virt.noConfig': { en: 'No backend configured', zh: '尚未設定後端' },
  'virt.noConfigHint': { en: 'Configure a storage backend to start virtualizing files', zh: '設定儲存後端以開始虛擬化檔案' },
  'virt.empty': { en: 'Select a folder to browse files', zh: '選擇資料夾以瀏覽檔案' },
  'virt.emptyHint': { en: 'Files above the size threshold will appear here', zh: '超過大小門檻的檔案會顯示在這裡' },
  'virt.noFiles': { en: 'No files found', zh: '沒有找到檔案' },
  'virt.noFilesHint': { en: 'This folder appears to be empty', zh: '此資料夾似乎沒有檔案' },
  // Progress phases
  'virt.phase.scanning': { en: 'Scanning', zh: '掃描中' },
  'virt.phase.hashing': { en: 'Hashing', zh: '計算雜湊' },
  'virt.phase.uploading': { en: 'Uploading', zh: '上傳中' },
  'virt.phase.downloading': { en: 'Downloading', zh: '下載中' },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, locale: Locale): string {
  return translations[key]?.[locale] ?? key;
}

export { translations, type TranslationKey };
