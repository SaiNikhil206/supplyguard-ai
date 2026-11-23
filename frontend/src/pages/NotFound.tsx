import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center duration-200 animate-in fade-in slide-in-from-bottom-1">
      <p
        aria-hidden="true"
        className="text-5xl font-semibold tabular-nums tracking-tight text-muted"
      >
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted">
        The page you requested does not exist, or it moved.
      </p>
      <Button asChild className="mt-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to overview
        </Link>
      </Button>
    </section>
  );
}
