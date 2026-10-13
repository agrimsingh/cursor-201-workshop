import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-slate-500">That record does not exist. It may have been removed when the database was re-seeded.</p>
      <Link className="btn-primary mt-4" href="/">
        Back to dashboard
      </Link>
    </div>
  );
}
