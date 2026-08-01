"use client";

import { useState } from "react";
import { ConfirmButton } from "../_components/ConfirmButton";
import { addRecipient, removeRecipient, setDigestEnabled } from "./digest-test-actions";

export interface RecipientRow {
  id: string;
  name: string;
  email: string;
}

export function DigestRecipients({ recipients, enabled }: { recipients: RecipientRow[]; enabled: boolean }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-cream-100 bg-cream-50 px-3 py-2">
        <div>
          <p className="text-sm text-ink">Send automatically every day</p>
          <p className="text-xs text-gray-500">
            The time is fixed by the cron schedule in vercel.json - this only controls whether that daily run
            actually sends.
          </p>
        </div>
        <ConfirmButton
          label={enabled ? "On" : "Off"}
          confirmLabel={enabled ? "Pause it" : "Resume it"}
          confirmText={
            enabled
              ? "Pause the automatic daily digest? “Send test digest now” below still works regardless."
              : "Resume the automatic daily digest?"
          }
          onConfirm={() => setDigestEnabled(!enabled)}
          className={`rounded-full px-4 py-1 text-xs font-medium ${
            enabled ? "bg-forest-600 text-white hover:bg-forest-700" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        />
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Recipients</p>
        {recipients.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">Nobody&apos;s on the list yet - add an email below.</p>
        ) : (
          <ul className="mt-2 divide-y divide-cream-100">
            {recipients.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-ink">
                  {r.name} <span className="text-gray-400">- {r.email}</span>
                </span>
                <ConfirmButton
                  label="Remove"
                  confirmText={`Remove ${r.email} from the daily digest list?`}
                  confirmLabel="Remove"
                  tone="danger"
                  onConfirm={() => removeRecipient(r.id)}
                  className="text-xs text-gray-400 hover:text-warn"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddRecipientForm />
    </div>
  );
}

function AddRecipientForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("email", email);
    const result = await addRecipient(formData);
    setMessage(result.message);
    if (result.ok) {
      setName("");
      setEmail("");
    }
  }

  const ready = email.includes("@");

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-gray-500">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Email</label>
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setMessage(null);
            }}
            type="email"
            placeholder="name@example.com"
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <ConfirmButton
          label="Add"
          confirmText={`Add ${email || "this address"} to the daily digest recipient list?`}
          confirmLabel="Add"
          disabled={!ready}
          onConfirm={run}
          className="rounded-full bg-forest-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
      {message && <p className="mt-1.5 text-xs text-gray-500">{message}</p>}
    </div>
  );
}
