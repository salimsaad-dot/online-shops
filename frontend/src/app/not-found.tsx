import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-5xl font-semibold text-ink-3">404</p>
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-ink-2">The page or shop you are looking for doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 text-sm font-medium text-ink underline-offset-4 hover:underline">Go to the home page</Link>
    </div>
  );
}
