import { useState } from "react";
import { Button } from "../components/Button";
import { useStore } from "../store";
import { api } from "../api";
import "./shared.css";
import "./Settings.css";

export function Settings() {
  const { settings, saveSettings, setPhase } = useStore();
  const [name, setName] = useState(settings?.name ?? "");
  const [timezone, setTimezone] = useState(settings?.timezone ?? "UTC");
  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState(settings?.telegramChannelId ?? "");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const save = async () => {
    setBusy(true);
    setSavedMsg(null);
    try {
      await saveSettings({
        name: name.trim(),
        timezone: timezone.trim() || "UTC",
        telegramChannelId: channelId.trim(),
        // Only send token if the user typed one (leaves stored value intact otherwise).
        ...(botToken.trim() ? { telegramBotToken: botToken.trim() } : {}),
      });
      setBotToken("");
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(null), 1800);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setToast(null);
    setBusy(true);
    try {
      // Persist current values first so the test uses fresh credentials.
      await saveSettings({
        name: name.trim(),
        timezone: timezone.trim() || "UTC",
        telegramChannelId: channelId.trim(),
        ...(botToken.trim() ? { telegramBotToken: botToken.trim() } : {}),
      });
      setBotToken("");
      await api.testReport();
      setToast({ kind: "ok", text: "Test report sent to Telegram." });
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen settings-screen">
      <div className="settings-stack">
        <div className="settings-top">
          <button className="settings-back" onClick={() => setPhase("timer")}>
            ← Back
          </button>
          <span className="eyebrow">Settings</span>
          <span style={{ width: 48 }} />
        </div>

        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </div>

        <div className="field">
          <label>Timezone</label>
          <input
            className="input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder={detectedTz}
          />
          {timezone !== detectedTz && (
            <button className="settings-link" onClick={() => setTimezone(detectedTz)}>
              Use detected: {detectedTz}
            </button>
          )}
        </div>

        <div className="settings-divider" />
        <p className="subtle" style={{ textAlign: "left" }}>
          Telegram daily report (optional) — sent automatically at 23:59 your time.
        </p>

        <div className="field">
          <label>Bot token {settings?.telegramConfigured && <span className="accent">· configured</span>}</label>
          <input
            className="input"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={settings?.telegramConfigured ? "•••••••• (leave blank to keep)" : "123456:ABC-..."}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label>Channel ID</label>
          <input
            className="input"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="@mychannel or -100123..."
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="settings-actions">
          <Button variant="solid" onClick={() => void save()} disabled={busy}>
            {savedMsg ?? "Save"}
          </Button>
          <Button variant="ghost" onClick={() => void sendTest()} disabled={busy}>
            Send test report
          </Button>
        </div>

        {toast && <div className={`settings-toast settings-toast-${toast.kind}`}>{toast.text}</div>}
      </div>
    </div>
  );
}
