/**
 * Sound playback and desktop notification for HelloAGENTS.
 * Cross-platform: Windows (PowerShell), macOS (afplay/osascript), Linux (aplay/notify-send).
 */
import { platform } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const PLAT = platform();

const NOTIFY_MESSAGES = {
  complete: '任务完成',
  confirm: '需要确认',
  warning: '出现问题',
  error:   '执行出错',
  idle:    '等待输入',
};

const WIN_APPID = 'HelloAgents.Notification';

function resolveWav(pkgRoot, event) {
  const p = join(pkgRoot, 'assets', 'sounds', `${event}.wav`);
  return existsSync(p) ? p : null;
}

export function playSound(pkgRoot, event) {
  const wav = resolveWav(pkgRoot, event);
  if (!wav) { process.stderr.write('\x07'); return; }
  try {
    if (PLAT === 'win32') {
      spawnSync('powershell', ['-NoProfile', '-c',
        `(New-Object Media.SoundPlayer '${wav.replace(/'/g, "''")}').PlaySync()`],
        { stdio: 'ignore', windowsHide: true });
    } else if (PLAT === 'darwin') {
      spawnSync('afplay', [wav], { stdio: 'ignore' });
    } else {
      const result = spawnSync('aplay', ['-q', wav], { stdio: 'ignore' });
      if (result.status !== 0) {
        const pa = spawnSync('paplay', [wav], { stdio: 'ignore' });
        if (pa.status !== 0) process.stderr.write('\x07');
      }
    }
  } catch { process.stderr.write('\x07'); }
}

function ensureWinAppId(pkgRoot) {
  if (PLAT !== 'win32') return;
  const regKey = `HKCU:\\Software\\Classes\\AppUserModelId\\${WIN_APPID}`;
  spawnSync('powershell', ['-NoProfile', '-c',
    `if (-not (Test-Path '${regKey}')) { New-Item -Path '${regKey}' -Force | Out-Null; Set-ItemProperty -Path '${regKey}' -Name 'DisplayName' -Value 'HelloAgents 通知' -Force }`],
    { stdio: 'ignore', windowsHide: true });
}

export function desktopNotify(pkgRoot, event, extra) {
  const msg = extra || NOTIFY_MESSAGES[event] || event;
  const title = 'HelloAgents 通知';
  try {
    if (PLAT === 'win32') {
      ensureWinAppId(pkgRoot);
      const safeMsg = msg.replace(/'/g, "''");
      const iconPath = join(pkgRoot, 'assets', 'icons', 'icon.png').replace(/\//g, '\\');
      const iconXml = existsSync(iconPath) ? `<image placement="appLogoOverride" src="${iconPath}" />` : '';
      const ps = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null
$xml = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      ${iconXml}
      <text>${safeMsg}</text>
    </binding>
  </visual>
</toast>
"@
$doc = New-Object Windows.Data.Xml.Dom.XmlDocument
$doc.LoadXml($xml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${WIN_APPID}').Show($toast)
`.trim();
      spawnSync('powershell', ['-NoProfile', '-c', ps], { stdio: 'ignore', windowsHide: true });
    } else if (PLAT === 'darwin') {
      spawnSync('osascript', ['-e',
        `display notification "${msg.replace(/"/g, '\\"')}" with title "${title}"`],
        { stdio: 'ignore' });
    } else {
      const result = spawnSync('notify-send', [title, msg], { stdio: 'ignore' });
      if (result.status !== 0) process.stderr.write('\x07');
    }
  } catch { process.stderr.write('\x07'); }
}
