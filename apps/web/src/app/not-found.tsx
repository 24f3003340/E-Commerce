import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center py-24 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-gray-500">The page you are looking for does not exist or has been moved.</p>
      <Link href="/" className="btn-primary mt-6">
        Continue shopping
      </Link>
    </div>
  );
}
