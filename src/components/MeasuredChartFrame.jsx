import React, { useRef, useState, useEffect } from "react";

export default function MeasuredChartFrame({ height = 280, className = "", children }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;

    const update = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setWidth(Math.max(0, Math.floor(rect.width)));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  const ready = width > 0;

  return (
    <div
      ref={ref}
      className={`w-full min-w-[1px] overflow-hidden ${className}`}
      style={{ height, minHeight: height }}
    >
      {ready ? (
        children({ width, height })
      ) : (
        <div className="h-full w-full rounded-2xl bg-white/5 animate-pulse" />
      )}
    </div>
  );
}
