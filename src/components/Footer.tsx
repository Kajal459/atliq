import { BrainIcon } from "@/components/AtliqLogo";

// Shared across the login screen and every dashboard page - quiet on
// purpose (Operate mode: this is a tool people use daily, not a marketing
// site, so the footer just orients rather than competing for attention).
export function Footer() {
  return (
    <footer className="border-t border-cream-100 bg-cream-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-xs text-gray-500 sm:flex-row sm:items-start sm:justify-between">
        <p className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-forest-500">
            <BrainIcon className="h-3 w-3 text-cream-100" />
          </span>
          <span className="font-serif italic text-forest-600">atliq</span>
          <span>Sales &amp; CRM Assistant</span>
        </p>
        <div className="leading-relaxed sm:text-right">
          <p className="font-medium tracking-wide text-gray-600">KAJAL ANEJA</p>
          <p>aneja.kajal@gmail.com</p>
          <p>m: 321-315-8063</p>
        </div>
      </div>
    </footer>
  );
}
