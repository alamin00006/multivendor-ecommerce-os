import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-6xl font-bold text-primary-700">404</p>
      <h1 className="text-lg font-semibold">This admin page does not exist</h1>
      <Link href="/" className="rounded-md bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white">
        Back to dashboard
      </Link>
    </div>
  );
}
