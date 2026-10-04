import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center text-foreground">
        <h1 className="text-2xl font-bold mb-3">Access denied</h1>
        <p className="text-sm text-muted-foreground mb-6">
          You do not have permission to view this page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black">
            Home
          </Link>
          <Link href="/login" className="rounded-md border border-gray-600 px-4 py-2 text-sm font-medium">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
