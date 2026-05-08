/**
 * Sound playback and desktop notification for HelloAGENTS.
 * Cross-platform: Windows (PowerShell), macOS (afplay/osascript), Linux (aplay/notify-send).
 */
import { platform } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const PLAT = platform();

const NOTIFY_MESSAGES = {
  complete: '任务完成',
  confirm: '需要确认',
  warning: '出现问题',
  error:   '执行出错',
  idle:    '等待输入',
};

const WIN_APPID = 'HelloAgents.Notification';
const DISABLE_OS_NOTIFICATIONS = process.env.HELLOAGENTS_DISABLE_OS_NOTIFICATIONS === '1';

function escapeToastText(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAppleScriptText(value = '') {
  return String(value).replace(/"/g, '\\"');
}

export function buildDesktopNotificationContent(event, extra) {
  const options = extra && typeof extra === 'object'
    ? extra
    : { message: extra || '' };
  const message = options.message || NOTIFY_MESSAGES[event] || event;
  const title = options.title || 'HelloAgents 通知';
  const sourceLabel = options.sourceLabel || '';
  const body = sourceLabel ? `${sourceLabel}\n${message}` : message;
  const toastLines = sourceLabel ? [sourceLabel, message] : [message];

  return {
    title,
    message,
    sourceLabel,
    body,
    toastLines,
  };
}

function resolveWav(pkgRoot, event) {
  const p = join(pkgRoot, 'assets', 'sounds', `${event}.wav`);
  return existsSync(p) ? p : null;
}

function runDetached(command, args) {
  try {
    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value = '') {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

export function playSound(pkgRoot, event) {
  if (DISABLE_OS_NOTIFICATIONS) return;
  const wav = resolveWav(pkgRoot, event);
  if (!wav) { process.stderr.write('\x07'); return; }
  try {
    if (PLAT === 'win32') {
      runDetached('powershell', [
        '-NoProfile',
        '-c',
        `(New-Object Media.SoundPlayer '${wav.replace(/'/g, "''")}').PlaySync()`,
      ]);
    } else if (PLAT === 'darwin') {
      runDetached('afplay', [wav]);
    } else {
      runDetached('sh', ['-c', `if command -v aplay >/dev/null 2>&1; then aplay -q ${shellQuote(wav)}; elif command -v paplay >/dev/null 2>&1; then paplay ${shellQuote(wav)}; else printf '\\a'; fi`]);
    }
  } catch { process.stderr.write('\x07'); }
}

function buildWindowsToastScript(notification, iconPath) {
  const regKey = `HKCU:\\Software\\Classes\\AppUserModelId\\${WIN_APPID}`;
  const iconXml = existsSync(iconPath)
    ? `<image placement="appLogoOverride" src="${escapeToastText(iconPath)}" />`
    : '';
  const textXml = notification.toastLines
    .map((line) => `<text>${escapeToastText(line)}</text>`)
    .join('\n      ');
  return `
if (-not (Test-Path '${regKey}')) {
  New-Item -Path '${regKey}' -Force | Out-Null
  Set-ItemProperty -Path '${regKey}' -Name 'DisplayName' -Value 'HelloAgents 通知' -Force
}
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null
$xml = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      ${iconXml}
      ${textXml}
    </binding>
  </visual>
</toast>
"@
$doc = New-Object Windows.Data.Xml.Dom.XmlDocument
$doc.LoadXml($xml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${WIN_APPID}').Show($toast)
`.trim();
}

export function desktopNotify(pkgRoot, event, extra) {
  if (DISABLE_OS_NOTIFICATIONS) return;
  const notification = buildDesktopNotificationContent(event, extra);
  try {
    if (PLAT === 'win32') {
      const iconPath = join(pkgRoot, 'assets', 'icons', 'icon.png').replace(/\//g, '\\');
      runDetached('powershell', ['-NoProfile', '-c', buildWindowsToastScript(notification, iconPath)]);
    } else if (PLAT === 'darwin') {
      const subtitle = notification.sourceLabel
        ? ` subtitle "${escapeAppleScriptText(notification.sourceLabel)}"`
        : '';
      runDetached('osascript', ['-e',
        `display notification "${escapeAppleScriptText(notification.message)}" with title "${escapeAppleScriptText(notification.title)}"${subtitle}`],
      );
    } else {
      runDetached('sh', ['-c', `if command -v notify-send >/dev/null 2>&1; then notify-send ${shellQuote(notification.title)} ${shellQuote(notification.body)}; else printf '\\a'; fi`]);
    }
  } catch { process.stderr.write('\x07'); }
}
