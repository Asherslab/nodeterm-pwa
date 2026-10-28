// One drawn icon set: 24-unit grid, 1.75 stroke, round caps (the mockups' set).
const P: Record<string, string> = {
  rack: 'M3 4h18v16H3zM3 9.5h18M3 14.5h18M12 4v16',
  board: 'M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v13h-4z',
  mac: 'M4 5h16v11H4zM2 19h20',
  back: 'M15 5l-7 7 7 7',
  send: 'M12 19V5M6 11l6-6 6 6',
  term: 'M3 4h18v16H3zM7 9l3 3-3 3M12 15h5',
  chat: 'M4 5h16v11H9l-5 4z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16',
  paste: 'M6 4h12v17H6zM9 4V3h6v1M9 10h6M9 14h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  retry: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  x: 'M6 6l12 12M18 6L6 18'
}

export type IconName = keyof typeof P

export function Icon({ name, small }: { name: IconName; small?: boolean }) {
  return (
    <svg class={`ico${small ? ' sm' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}
