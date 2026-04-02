"use client"

import * as React from "react"

const BOBA_COUNT = 20

type BobaItem = {
  id: number
  leftPct: string
  delayS: number
  durationS: number
  sizePx: number
  opacity: number
}

export function FallingBobaBackground() {
  const items = React.useMemo<BobaItem[]>(() => {
    return Array.from({ length: BOBA_COUNT }, (_, i) => ({
      id: i,
      leftPct: `${((i * 37) % 92) + 4}%`,
      delayS: (i * 0.55) % 10,
      durationS: 11 + (i % 9),
      sizePx: 26 + (i % 6) * 8,
      opacity: 0.22 + (i % 5) * 0.06,
    }))
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="falling-boba absolute top-0"
          style={{
            left: item.leftPct,
            width: item.sizePx,
            height: item.sizePx,
            opacity: item.opacity,
            // `backwards`: during animation-delay, use the 0% keyframe (off-screen top)
            // so bubbles don’t sit at top:0 untransformed before the first frame runs.
            animation: `falling-boba-fall ${item.durationS}s linear ${item.delayS}s infinite backwards`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/boba.png"
            alt=""
            className="h-full w-full object-contain select-none"
            draggable={false}
          />
        </div>
      ))}
    </div>
  )
}
