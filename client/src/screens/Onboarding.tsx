import { useState } from "react";
import { Button } from "../components/Button";
import { useStore } from "../store";
import "./shared.css";

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function Onboarding() {
  const onboard = useStore((s) => s.onboard);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onboard(trimmed, tz);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <form className="center-stack" onSubmit={submit}>
        <span className="eyebrow">FocusArc</span>
        <h1 className="headline">What's your name?</h1>
        <div className="field">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            maxLength={40}
          />
        </div>
        <Button type="submit" variant="solid" disabled={!name.trim() || busy}>
          Let's go
        </Button>
      </form>
    </div>
  );
}
