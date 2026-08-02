"use client";

import { useState } from "react";
import { askAboutDeal } from "./assistant-actions";

type Turn = { question: string; answer: string; ok: boolean };

// Companion to the Quick Capture launcher, rendered in the same floating row
// in the dashboard layout. Deliberately scoped to "ask about one deal by
// name" rather than an open-ended pipeline chatbot - see
// src/lib/extraction/assistant.ts for why: every answer is grounded in that
// one deal's own CRM record, activity, and approval history, so it stays
// checkable against what's already on the Deal Timeline page.
export function AskAssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setQuestion("");
    const result = await askAboutDeal(q);
    setTurns((prev) => [...prev, { question: q, answer: result.message, ok: result.ok }]);
    setAsking(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-forest-600 bg-white px-5 py-3 text-sm font-medium text-forest-700 shadow-lg hover:bg-forest-50"
      >
        <ChatIcon className="h-4 w-4" />
        Ask AtliQ
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-cream-100 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-serif text-lg italic text-ink">Ask AtliQ</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Ask about any deal by name - e.g. &quot;what&apos;s the status of Meridian?&quot;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex-1 space-y-3 overflow-y-auto">
              {turns.length === 0 && !asking && (
                <p className="border-l-2 border-cream-200 pl-3 text-xs text-gray-400">
                  Nothing asked yet this session - answers only use what&apos;s already on that deal&apos;s record.
                </p>
              )}
              {turns.map((t, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-forest-600 px-3 py-1.5 text-sm text-white">
                    {t.question}
                  </p>
                  <p
                    className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-1.5 text-sm ${
                      t.ok ? "bg-cream-50 text-ink" : "bg-coral-50 text-coral-700"
                    }`}
                  >
                    {t.answer}
                  </p>
                </div>
              ))}
              {asking && <p className="text-xs text-gray-400">Thinking...</p>}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
              className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3"
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What's the status of..."
                autoFocus
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!question.trim() || asking}
                className="rounded-full bg-forest-600 px-4 py-2 text-xs font-medium text-white hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ask
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4h16v11H7l-3 3V4z" />
    </svg>
  );
}
