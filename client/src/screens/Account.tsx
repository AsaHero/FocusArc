import { useState } from "react";
import { Button } from "../components/Button";
import { useStore } from "../store";
import { api } from "../api";
import "./shared.css";
import "./Settings.css";

export function Account() {
  const { settings, logout, setPhase } = useStore();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const changePassword = async () => {
    setToast(null);
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setToast({ kind: "ok", text: "Password updated." });
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.deleteAccount();
      await logout();
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
      setBusy(false);
    }
  };

  return (
    <div className="screen settings-screen">
      <div className="settings-stack">
        <div className="settings-top">
          <button className="settings-back" onClick={() => setPhase("settings")}>
            ← Back
          </button>
          <span className="eyebrow">Account</span>
          <span style={{ width: 48 }} />
        </div>

        <div className="field">
          <label>Signed in as</label>
          <div className="input" style={{ color: "var(--text)" }}>{settings?.name}</div>
        </div>

        <div className="settings-divider" />
        <p className="subtle" style={{ textAlign: "left" }}>Change password</p>

        <div className="field">
          <label>Current password</label>
          <input
            className="input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="field">
          <label>New password</label>
          <input
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="at least 6 characters"
            autoComplete="new-password"
          />
        </div>

        <div className="settings-actions">
          <Button variant="solid" onClick={() => void changePassword()} disabled={busy || !current || !next}>
            Update password
          </Button>
          <Button variant="ghost" onClick={() => void logout()} disabled={busy}>
            Log out
          </Button>
        </div>

        {toast && <div className={`settings-toast settings-toast-${toast.kind}`}>{toast.text}</div>}

        <div className="settings-divider" />
        {!confirmingDelete ? (
          <button className="link-btn danger" onClick={() => setConfirmingDelete(true)}>
            Delete account
          </button>
        ) : (
          <div className="center-stack" style={{ gap: 12 }}>
            <p className="subtle">This permanently deletes your account and all sessions.</p>
            <div className="row">
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="solid" onClick={() => void deleteAccount()} disabled={busy}>
                Delete forever
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
