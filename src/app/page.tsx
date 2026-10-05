"use client";

import dynamic from "next/dynamic";

/**
 * The editor reads from localStorage on mount, so it renders on the client
 * only. The server ships a plain shell, which also means there is no
 * hydration pass over a vault the server cannot see.
 */
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <p>Opening your vault…</p>
    </div>
  ),
});

export default function Page() {
  return <App />;
}