// Suspense fallback for every route under (app)/(subscription-guard) that
// doesn't ship its own loading.tsx. We deliberately do NOT render a full
// table/detail skeleton here anymore — that fallback fired on every
// soft navigation (because async server components await above this
// boundary), which made the app feel like it was "loading every click".
//
// Per-route loading.tsx files have been removed across distribution
// modules; this minimal fallback is what shows during a true cold start
// (hard refresh, first navigation into the subscription-guarded tree).
// A thin pulse bar gives operators a hint without redrawing chrome.

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
