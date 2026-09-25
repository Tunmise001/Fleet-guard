import type { ReactNode } from "react";

/**
 * Renders the model-written incident report.
 *
 * The backend returns lightly-marked-up prose — a `## Fleet Manager Insight`
 * heading, `**bold**` runs, and a `**Recommended Action:**` section — which was
 * being dumped on screen as a single wall of literal asterisks and hashes.
 *
 * This is a deliberately tiny formatter rather than a markdown dependency: the
 * shape is fixed and produced by our own service, and rendering arbitrary
 * markdown (links, images, HTML) from a model would be a needless injection
 * surface. Anything it does not recognise is shown as plain text.
 */

const ACTION_RE = /\*\*Recommended Action:?\*\*:?/i;
const HEADING_RE = /^\s*#{1,6}\s*[^\n*]*/;

/** `**bold**` → <strong>, everything else verbatim. */
function renderBold(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function paragraphs(text: string, keyPrefix: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((p, i) => (
      <p key={`${keyPrefix}-p${i}`} className="leading-relaxed">
        {renderBold(p, `${keyPrefix}-p${i}`)}
      </p>
    ));
}

export default function InsightText({ text }: { text: string }) {
  if (!text?.trim()) return null;

  // Drop the "## Fleet Manager Insight" heading — the surrounding UI already
  // says what this is.
  const body = text.replace(HEADING_RE, "").trim();

  const [finding, action] = body.split(ACTION_RE);

  return (
    <div className="space-y-2 text-xs text-fg-muted">
      <div className="space-y-1.5">{paragraphs(finding ?? body, "f")}</div>

      {action?.trim() && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-warning">
            Recommended action
          </p>
          <div className="space-y-1.5">{paragraphs(action, "a")}</div>
        </div>
      )}
    </div>
  );
}
