import { useState } from "react";
import { Button } from "../components/Button";
import { useStore } from "../store";
import "./shared.css";

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function Auth() {
  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await register(n, password, tz);
      else await login(n, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError(null);
  };

  return (
    <div className="screen">
      <form className="center-stack" onSubmit={submit}>
        <span className="eyebrow">FocusArc</span>
        <h1 className="headline">{mode === "login" ? "Welcome back." : "Create your account."}</h1>

        <div className="field">
          <label>Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="your name"
            autoFocus
            autoComplete="username"
            maxLength={40}
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "at least 6 characters" : "password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>

        {error && <p className="subtle" style={{ color: "var(--accent)" }}>{error}</p>}

        <Button type="submit" variant="solid" disabled={!name.trim() || !password || busy}>
          {mode === "login" ? "Log in" : "Sign up"}
        </Button>

        <button type="button" className="link-btn" onClick={toggle}>
          {mode === "login" ? "No account? Sign up" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
