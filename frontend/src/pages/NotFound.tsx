import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="relative">
        <p
          aria-hidden="true"
          className="bg-gradient-to-br from-primary to-violet-500 bg-clip-text text-8xl font-bold tracking-tighter text-transparent"
        >
          404
        </p>
        <span className="absolute -right-4 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted">
        The page you requested does not exist, or it moved. Let&apos;s get you
        back on track.
      </p>
      <Button asChild size="lg">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to overview
        </Link>
      </Button>
    </section>
  );
}
