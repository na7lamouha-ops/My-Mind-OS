'use client';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-danger/40 bg-danger/10 p-6 text-center">
      <h2 className="text-lg font-semibold text-danger">حدث خطأ</h2>
      <p className="mt-2 text-sm text-muted">{error.message || 'تعذّر تحميل هذه الصفحة.'}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
