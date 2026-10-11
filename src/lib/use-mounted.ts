import { useEffect, useState } from "react";

/** false during server rendering and hydration, true afterwards. Use it to render anything that depends on the viewer's clock, time zone or localStorage, so the server's HTML (UTC) and the browser's (local time) never disagree. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
