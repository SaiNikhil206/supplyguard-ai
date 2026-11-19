import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        The page you requested does not exist.{' '}
        <Link className="text-primary underline" to="/">
          Back to overview
        </Link>
      </p>
    </section>
  );
}
