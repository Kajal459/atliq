// Shared logo lockup - icon mark + wordmark + tagline - used in the login
// header and the dashboard header. Plain presentational piece (no Link, no
// "use client") so each call site decides whether to wrap it in a Link.
export function AtliqLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-500">
        <BrainIcon className="h-[19px] w-[19px] text-cream-100" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-serif text-2xl italic text-cream-100">atliq</span>
        <span className="mt-0.5 text-[11px] text-forest-100">The CRM that remembers</span>
      </span>
    </div>
  );
}

// Tabler Icons' "brain" outline icon (MIT licensed) - the exact icon used in
// the mockup preview, inlined here so the logo doesn't need the full
// @tabler/icons package as a runtime dependency. Exported so other spots
// (e.g. the footer) can reuse the identical mark instead of only the header.
export function BrainIcon({ className }: { className?: string }) {
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
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" />
      <path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" />
      <path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" />
      <path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" />
      <path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5" />
      <path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" />
    </svg>
  );
}
