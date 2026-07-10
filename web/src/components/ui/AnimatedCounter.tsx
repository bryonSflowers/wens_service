import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}

export function AnimatedCounter({ value, duration = 800, prefix, suffix, decimals = 0, className }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef(0)
  const startTime = useRef(0)

  useEffect(() => {
    startRef.current = display
    startTime.current = Date.now()
    const raf = requestAnimationFrame(function tick() {
      const elapsed = Date.now() - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startRef.current + (value - startRef.current) * eased
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <span className={className}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  )
}
