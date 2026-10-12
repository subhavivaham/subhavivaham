import type { ReactNode } from "react";

// the member sidebar is hidden below lg, so a page reached from it has no way
// back on a phone. the top nav carries the dashboard link on every member page,
// so this header only needs the page title and its optional action.
export function MemberPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
          {title}
        </h1>
        {description ? <p className="mt-1 text-charcoal-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
