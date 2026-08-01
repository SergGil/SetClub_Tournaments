"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 70;
const MAX_PULL = 120;

/**
 * iOS Safari never implements pull-to-refresh for home-screen (standalone)
 * web apps - unlike Android Chrome or a regular browser tab, it's simply
 * absent there. This emulates the gesture with touch events, scoped to that
 * exact case so it doesn't double up with browsers that already have it.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const dragging = useRef(false);
  const distance = useRef(0);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    const isIOS = /iP(hone|ad|od)/.test(nav.userAgent);
    if (!isStandalone || !isIOS) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshing) return;
      startY.current = e.touches[0].clientY;
      dragging.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!dragging.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        dragging.current = false;
        distance.current = 0;
        setPullDistance(0);
        return;
      }
      distance.current = Math.min(delta, MAX_PULL);
      setPullDistance(distance.current);
    }

    function onTouchEnd() {
      if (!dragging.current) return;
      dragging.current = false;
      if (distance.current > PULL_THRESHOLD) {
        setRefreshing(true);
        setPullDistance(PULL_THRESHOLD);
        router.refresh();
        window.setTimeout(() => {
          setRefreshing(false);
          setPullDistance(0);
        }, 600);
      } else {
        setPullDistance(0);
      }
      distance.current = 0;
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [refreshing, router]);

  if (pullDistance === 0 && !refreshing) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center overflow-hidden"
      style={{ height: pullDistance }}
    >
      <div className="flex items-end pb-2">
        <div
          className={`h-6 w-6 rounded-full border-2 border-primary border-t-transparent ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pullDistance * 3}deg)` }}
        />
      </div>
    </div>
  );
}
