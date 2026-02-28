; ============================================================
; MemoryGuy NSIS Installer
; Supports optional companion tool installation (REPIC, REVID)
; ============================================================

!include "MUI2.nsh"

; --- App metadata ---
!define APP_NAME "MemoryGuy"
!define APP_VERSION "0.1.0"
!define APP_PUBLISHER "MemoryGuy"
!define APP_EXE "MemoryGuy.exe"
!define APP_DIR "$PROGRAMFILES\${APP_NAME}"

; --- Companion installer filenames ---
; Place these in installer\companions\ before building
!define REPIC_INSTALLER "REPIC-Setup.exe"
!define REVID_INSTALLER "REVID-Setup.exe"

; --- Output ---
Name "${APP_NAME} ${APP_VERSION}"
OutFile "MemoryGuy-Setup.exe"
InstallDir "${APP_DIR}"
RequestExecutionLevel admin

; --- MUI Settings ---
!define MUI_ABORTWARNING

; --- Pages ---
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; --- Languages ---
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "TradChinese"

; ============================================================
; Section: MemoryGuy (required)
; ============================================================
Section "${APP_NAME}" SecMain
  SectionIn RO  ; Required — cannot uncheck

  SetOutPath "$INSTDIR"

  ; Copy the packaged Electron app
  ; Assumes: npm run package -> out\MemoryGuy-win32-x64\
  File /r "..\out\MemoryGuy-win32-x64\*.*"

  ; Start menu shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

  ; Desktop shortcut
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"

  ; Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Add/Remove Programs registry
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "Publisher" "${APP_PUBLISHER}"
SectionEnd

; ============================================================
; Section: REPIC Viewer (optional, checked by default)
; ============================================================
Section "REPIC Image Viewer" SecRepic
  SetOutPath "$TEMP"

  IfFileExists "$EXEDIR\companions\${REPIC_INSTALLER}" 0 repic_skip
    File "companions\${REPIC_INSTALLER}"
    DetailPrint "Installing REPIC Image Viewer..."
    ExecWait '"$TEMP\${REPIC_INSTALLER}" /S' $0
    Delete "$TEMP\${REPIC_INSTALLER}"
    DetailPrint "REPIC installation complete (exit code: $0)"
    Goto repic_done
  repic_skip:
    DetailPrint "REPIC installer not found in companions/ — skipping"
  repic_done:
SectionEnd

; ============================================================
; Section: REVID Player (optional, checked by default)
; ============================================================
Section "REVID Video Player" SecRevid
  SetOutPath "$TEMP"

  IfFileExists "$EXEDIR\companions\${REVID_INSTALLER}" 0 revid_skip
    File "companions\${REVID_INSTALLER}"
    DetailPrint "Installing REVID Video Player..."
    ExecWait '"$TEMP\${REVID_INSTALLER}" /S' $0
    Delete "$TEMP\${REVID_INSTALLER}"
    DetailPrint "REVID installation complete (exit code: $0)"
    Goto revid_done
  revid_skip:
    DetailPrint "REVID installer not found in companions/ — skipping"
  revid_done:
SectionEnd

; ============================================================
; Component descriptions (shown on hover)
; ============================================================
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} \
    "MemoryGuy — system monitor, memory optimizer, dev server dashboard (required)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecRepic} \
    "REPIC — opens virtualized image files (.repic) directly from the cloud"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecRevid} \
    "REVID — plays virtualized video files (.revid) directly from the cloud"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ============================================================
; Uninstaller
; ============================================================
Section "Uninstall"
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
SectionEnd
