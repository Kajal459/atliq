// Shared "does this text mention a company we already have a deal for"
// logic - used by Quick Capture (to link a note to its deal) and by the Ask
// Assistant (to figure out which deal a question is about). Longest company
// name wins so a short name doesn't false-match inside a longer one.

export function matchDealByText<T extends { company: string }>(text: string, deals: T[]): T | null {
  const lower = text.toLowerCase();
  const sorted = [...deals].sort((a, b) => b.company.length - a.company.length);
  return sorted.find((d) => lower.includes(d.company.toLowerCase())) ?? null;
}

// Finds every deal a free-text question could plausibly be about - used by
// the Ask Assistant, where people naturally shorten a name ("Meridian"
// instead of "Meridian Healthcare") rather than typing it in full the way a
// pasted email might. Matches on the full company name OR on any
// distinctive individual word from it, so a shortened name still counts.
// Deliberately permissive: if that surfaces more than one candidate (e.g.
// "Meridian" also matching the near-duplicate "Meridian Health LLC"), the
// caller asks the person to be more specific instead of guessing.
export function matchAllDealsByText<T extends { company: string }>(text: string, deals: T[]): T[] {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "");
  const lowerText = normalize(text);
  const questionWords = new Set(lowerText.split(/\s+/).filter(Boolean));

  return deals.filter((d) => {
    const lowerCompany = normalize(d.company);
    if (lowerText.includes(lowerCompany)) return true;
    const companyWords = lowerCompany.split(/\s+/).filter((w) => w.length >= 3);
    return companyWords.some((w) => questionWords.has(w));
  });
}
