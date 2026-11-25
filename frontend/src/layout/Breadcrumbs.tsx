import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { navItems } from './nav';

/** Workspace > Section > Details, derived from the URL. */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const section = navItems.find((i) => i.path !== '/' && i.path === `/${segments[0]}`);
  const crumbs: { label: string; to?: string }[] = [{ label: 'Workspace', to: '/' }];
  if (!segments.length) crumbs.push({ label: 'Overview' });
  else if (section) {
    crumbs.push(segments.length > 1 ? { label: section.short, to: section.path } : { label: section.short });
    if (segments.length > 1) crumbs.push({ label: 'Details' });
  } else crumbs.push({ label: 'Not found' });

  return (
    <nav aria-label="Location" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1.5 text-sm text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
              <li className="truncate">
                {c.to && !last ? (
                  <Link
                    to={c.to}
                    className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className={last ? 'font-medium text-foreground' : undefined}>
                    {c.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
