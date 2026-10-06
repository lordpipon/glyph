"use client";

import { useEffect, useState } from "react";
import { Check, Download, KeyRound, Link as LinkIcon, LogOut, Mail, Palette, Trash2, Type, Unlink, User } from "lucide-react";
import Dialog from "@/components/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONTS, THEMES } from "@/lib/types";
import type { FontId, Theme } from "@/lib/types";
import {
  changeEmail,
  changePassword,
  changeUsername,
  deleteAccount,
  displayName,
  linkProvider,
  listIdentities,
  signOut,
  unlinkProvider,
  type Account,
  type AuthResult,
  type AuthProvider,
  type Identity,
} from "@/lib/auth";

type Section = "appearance" | "account" | "data";

/**
 * Settings: the typeface, every theme, the account (if signed in), a data
 * download that works with or without an account, and the reset that puts the
 * welcome note back. Device + Inter is the default pair.
 */
export default function SettingsDialog({
  font,
  theme,
  noteCount,
  account,
  onFont,
  onTheme,
  onResetVault,
  onDownloadData,
  onClose,
}: {
  font: FontId;
  theme: Theme;
  noteCount: number;
  account: Account | null;
  onFont: (font: FontId) => void;
  onTheme: (theme: Theme) => void;
  onResetVault: () => void;
  onDownloadData: () => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<Section>("appearance");
  const [confirming, setConfirming] = useState<"reset" | "delete" | null>(null);

  if (confirming === "reset") {
    return (
      <Dialog title="Reset Glyph" onClose={() => setConfirming(null)} width={360}>
        <p className="dialog-copy">
          Every note in this browser is replaced by the welcome note. There is no
          cloud copy yet, so this cannot be undone.
        </p>
        <footer className="dialog-actions">
          <Button variant="ghost" onClick={() => setConfirming(null)}>
            Keep my notes
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onResetVault();
              setConfirming(null);
              onClose();
            }}
          >
            Erase {noteCount === 1 ? "the note" : `${noteCount} notes`}
          </Button>
        </footer>
      </Dialog>
    );
  }

  if (confirming === "delete") {
    return (
      <DeleteDialog account={account} onBack={() => setConfirming(null)} onDone={onClose} />
    );
  }

  return (
    <Dialog title="Settings" onClose={onClose} width={500}>
      {account && (
        <nav className="settings-tabs" aria-label="Settings sections">
          <button className={state === "appearance" ? "is-on" : ""} onClick={() => setState("appearance")}>
            <Palette /> Appearance
          </button>
          <button className={state === "account" ? "is-on" : ""} onClick={() => setState("account")}>
            <User /> Account
          </button>
          <button className={state === "data" ? "is-on" : ""} onClick={() => setState("data")}>
            <Download /> Your data
          </button>
        </nav>
      )}

      {state === "appearance" && (
        <>
          <AppearanceSection font={font} theme={theme} onFont={onFont} onTheme={onTheme} />
          <footer className="dialog-actions">
            <Button
              variant="ghost"
              disabled={isDefault(font, theme)}
              onClick={() => {
                onFont("inter");
                onTheme("system");
              }}
            >
              Reset appearance
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirming("reset")}>
              Reset notes
            </Button>
            <Button onClick={onClose}>Done</Button>
          </footer>
        </>
      )}

      {state === "account" && account && (
        <AccountSection account={account} onRequestDelete={() => setConfirming("delete")} onClose={onClose} />
      )}

      {state === "data" && <DataSection onDownloadData={onDownloadData} />}

      {!account && (
        <>
          <AppearanceSection font={font} theme={theme} onFont={onFont} onTheme={onTheme} />
          <hr className="settings-hr" />
          <DataSection onDownloadData={onDownloadData} />
          <footer className="dialog-actions">
            <Button
              variant="ghost"
              disabled={isDefault(font, theme)}
              onClick={() => {
                onFont("inter");
                onTheme("system");
              }}
            >
              Reset appearance
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirming("reset")}>
              Reset notes
            </Button>
            <Button onClick={onClose}>Done</Button>
          </footer>
        </>
      )}
    </Dialog>
  );
}

function isDefault(font: FontId, theme: Theme) {
  return font === "inter" && theme === "system";
}

function AppearanceSection({
  font,
  theme,
  onFont,
  onTheme,
}: {
  font: FontId;
  theme: Theme;
  onFont: (font: FontId) => void;
  onTheme: (theme: Theme) => void;
}) {
  return (
    <>
      <section className="settings-section">
        <header className="settings-head">
          <Type />
          <div>
            <h3>Typeface</h3>
            <p>The font Glyph writes and reads in.</p>
          </div>
        </header>
        <Select value={font} onValueChange={(v) => onFont(v as FontId)}>
          <SelectTrigger
            className="select-control"
            aria-label="Default font"
            style={{ fontFamily: `var(--f-${font})` }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f.id} value={f.id} style={{ fontFamily: `var(--f-${f.id})` }}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="settings-section">
        <header className="settings-head">
          <Palette />
          <div>
            <h3>Appearance</h3>
            <p>Device now matches the dark look; Light flips to a pale ground.</p>
          </div>
        </header>
        <div className="option-grid" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={t.id === theme}
              className={`theme-card ${t.id === theme ? "is-on" : ""}`}
              onClick={() => onTheme(t.id)}
            >
              <Swatch theme={t.id} />
              <span className="theme-name">{t.name}</span>
              {t.id === theme && (
                <span className="theme-tick">
                  <Check />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function AccountSection({
  account,
  onRequestDelete,
  onClose,
}: {
  account: Account;
  onRequestDelete: () => void;
  onClose: () => void;
}) {
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState(account.username ?? "");
  const [oldEmail, setOldEmail] = useState(account.email);
  const [newEmail, setNewEmail] = useState("");
  const [curPassword, setCurPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [identities, setIdentities] = useState<Identity[]>([]);

  useEffect(() => {
    let alive = true;
    void listIdentities().then((found) => alive && setIdentities(found));
    return () => {
      alive = false;
    };
  }, []);

  const report = (result: AuthResult) => {
    setBusy(false);
    setMessage(result.ok ? { kind: "ok", text: result.message } : { kind: "error", text: result.message });
  };

  return (
    <>
      <section className="settings-section">
        <header className="settings-head">
          <User />
          <div>
            <h3>Profile</h3>
            <p>
              Signed in as <strong>{account.email}</strong> — friends see{" "}
              <strong>{displayName(account)}</strong> on shared notes.
            </p>
          </div>
        </header>
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setMessage(null);
            void changeUsername(username).then(report);
          }}
        >
          <label className="auth-label">
            <span>Username</span>
            <Input
              value={username}
              autoCapitalize="none"
              autoComplete="username"
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy || username.trim() === (account.username ?? "")}>
            Save username
          </Button>
        </form>
      </section>

      <section className="settings-section">
        <header className="settings-head">
          <Mail />
          <div>
            <h3>Email</h3>
            <p>Changing it asks for your current password and confirms the new address.</p>
          </div>
        </header>
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setMessage(null);
            void changeEmail(oldEmail, newEmail, curPassword).then(report);
          }}
        >
          <label className="auth-label">
            <span>Current email</span>
            <Input type="email" value={oldEmail} onChange={(e) => setOldEmail(e.target.value)} />
          </label>
          <label className="auth-label">
            <span>New email</span>
            <Input
              type="email"
              value={newEmail}
              placeholder="new@example.com"
              spellCheck={false}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </label>
          <label className="auth-label">
            <span>Current password</span>
            <Input
              type="password"
              value={curPassword}
              autoComplete="current-password"
              onChange={(e) => setCurPassword(e.target.value)}
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            Send confirmation for {newEmail.trim() || "new email"}
          </Button>
        </form>
      </section>

      <section className="settings-section">
        <header className="settings-head">
          <KeyRound />
          <div>
            <h3>Password</h3>
            <p>Verifies the current one, then sets the new.</p>
          </div>
        </header>
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setMessage(null);
            void changePassword(curPassword, nextPassword, confirmPassword).then(report);
          }}
        >
          <label className="auth-label">
            <span>Current password</span>
            <Input
              type="password"
              value={curPassword}
              autoComplete="current-password"
              onChange={(e) => setCurPassword(e.target.value)}
            />
          </label>
          <label className="auth-label">
            <span>New password</span>
            <Input
              type="password"
              value={nextPassword}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              onChange={(e) => setNextPassword(e.target.value)}
            />
          </label>
          <label className="auth-label">
            <span>Confirm new password</span>
            <Input
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            Update password
          </Button>
        </form>
      </section>

      <section className="settings-section">
        <header className="settings-head">
          <LinkIcon />
          <div>
            <h3>Sign-in methods</h3>
            <p>Link Google or GitHub so you never lose access to this email.</p>
          </div>
        </header>
        <div className="provider-row">
          <span className="provider-name">
            <span className="provider-dot is-google" /> Google
          </span>
          <ProviderButton
            provider="google"
            linked={identities.some((i) => i.provider === "google")}
            busy={busy}
            onAction={report}
          />
        </div>
        <div className="provider-row">
          <span className="provider-name">
            <span className="provider-dot is-github" /> GitHub
          </span>
          <ProviderButton
            provider="github"
            linked={identities.some((i) => i.provider === "github")}
            busy={busy}
            onAction={report}
          />
        </div>
      </section>

      {message && <p className={`settings-msg is-${message.kind}`}>{message.text}</p>}

      <footer className="dialog-actions">
        <Button
          variant="ghost"
          onClick={async () => {
            setBusy(true);
            await signOut();
            onClose();
          }}
        >
          <LogOut /> Sign out
        </Button>
        <Button variant="destructive" onClick={onRequestDelete}>
          <Trash2 /> Delete account…
        </Button>
      </footer>
    </>
  );
}

function DeleteDialog({
  account,
  onBack,
  onDone,
}: {
  account: Account | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  return (
    <Dialog title="Delete your account" onClose={onBack} width={360}>
      <p className="dialog-copy">
        <strong>{displayName(account)}&apos;s account is deleted for good</strong> — the username,
        email and sign-in methods are removed. Notes that live in this browser stay right where they
        are.
      </p>
      {message && <p className={`settings-msg is-${message.kind}`}>{message.text}</p>}
      <footer className="dialog-actions">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Keep my account
        </Button>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const result = await deleteAccount();
            setBusy(false);
            if (result.ok) {
              onDone();
            } else {
              setMessage({ kind: "error", text: result.message });
            }
          }}
        >
          {busy ? "Deleting…" : "Delete account"}
        </Button>
      </footer>
    </Dialog>
  );
}

function ProviderButton({
  provider,
  linked,
  busy,
  onAction,
}: {
  provider: AuthProvider;
  linked: boolean;
  busy: boolean;
  onAction: (r: AuthResult) => void;
}) {
  return linked ? (
    <Button variant="outline" className="w-full" disabled={busy} onClick={() => void unlinkProvider(provider).then(onAction)}>
      <Unlink /> Unlink
    </Button>
  ) : (
    <Button variant="outline" className="w-full" disabled={busy} onClick={() => void linkProvider(provider).then(onAction)}>
      <LinkIcon /> Link
    </Button>
  );
}

function DataSection({ onDownloadData }: { onDownloadData: () => void }) {
  return (
    <section className="settings-section">
      <header className="settings-head">
        <Download />
        <div>
          <h3>Your data</h3>
          <p>
            Every note, folder and setting, as one JSON file. Works with or without an account — the
            notes are yours either way.
          </p>
        </div>
      </header>
      <Button onClick={onDownloadData} className="w-full">
        <Download /> Download all data
      </Button>
    </section>
  );
}

/** Three colour chips so each theme is recognisable in the grid. */
function Swatch({ theme }: { theme: Theme }) {
  const palettes: Record<Theme, [string, string, string]> = {
    system: ["#17161c", "#2c2b35", "#f4f4f6"],
    light: ["#fbfbfd", "#e2e2ea", "#16181d"],
    dark: ["#17161c", "#2c2b35", "#f4f4f6"],
    aluminium: ["#17161c", "#2c2b35", "#f4f4f6"],
    blue: ["#0b141d", "#1f3341", "#8ec8ff"],
    red: ["#170f11", "#332326", "#ff9f8f"],
    yellow: ["#17140c", "#332d1c", "#f0c674"],
    catppuccin: ["#1e1e2e", "#45475a", "#cba6f7"],
    amoled: ["#000000", "#1e2129", "#d3d8e4"],
  };
  const [bg, mid, accent] = palettes[theme] ?? palettes.system;
  return (
    <span className="swatch" aria-hidden>
      <i style={{ background: bg }} />
      <i style={{ background: mid }} />
      <i style={{ background: accent }} />
    </span>
  );
}