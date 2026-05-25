// Outer (app)-group Suspense fallback. Same rationale as the
// subscription-guard fallback below it — we don't want a full skeleton
// to flash on every soft navigation. This minimal pulse only shows on
// a true cold start of the app shell.

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      <div
        className="h-0.5 w-full overflow-hidden bg-divider"
        role="progressbar"
        aria-label="Loading"
        aria-busy="true"
      >
        <div className="h-full w-2/5 animate-[listing-slide_1.2s_ease-in-out_infinite] rounded-sm bg-primary" />
      </div>
    </div>
  );
}
