import "../marketing.css";

/** MarketingShell applies the marketing styles. */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return <div className="mk min-h-dvh">{children}</div>;
}
