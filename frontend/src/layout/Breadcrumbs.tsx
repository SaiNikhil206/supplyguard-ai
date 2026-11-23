import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSupplier } from '@/api/queries';
import { navItems } from './nav';

/** Supplier name for /suppliers/:id (shares the page's query cache); falls back to the id while loading. */
function SupplierCrumb({ id }: { id: string }) {
  const q = useSupplier(id);
  return <>{q.data?.name ?? id}</>;
}

/** "Risk / RC-000045", "Suppliers / Pune Forge & Motors": real page names derived from the URL. */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const section = navItems.find((i) => i.path !== '/' && i.path === `/${segments[0]}`);
  const detailId = segments[1];

  const crumbs: { key: string; to?: string; node: React.ReactNode }[] = [];
  if (!segments.length) crumbs.push({ key: 'overview', node: 'Overview' });
  else if (section) {
    crumbs.push({ key: section.path, to: detailId ? section.path : undefined, node: section.short });
    if (detailId) {
      crumbs.push({
        key: 'detail',
        node: section.path === '/suppliers' ? <SupplierCrumb id={detailId} /> : detailId,
      });
    }
  } else crumbs.push({ key: 'nf', node: 'Page not found' });

  return (
    <nav aria-label="Location" className="hidden min-w-0 sm:block">
      <ol className="flex items-center gap-2 text-sm text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={c.key}>
              {i > 0 && (
                <li aria-hidden="true" className="text-border">
                  /
                </li>
              )}
              <li className="min-w-0 truncate">
                {c.to && !last ? (
                  <Link
                    to={c.to}
                    className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.node}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className={last ? 'font-medium text-foreground' : undefined}>
                    {c.node}
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
