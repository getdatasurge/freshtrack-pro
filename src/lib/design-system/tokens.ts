// SURFACE HIERARCHY (darkest to lightest)
export const surface = {
  base: 'bg-zinc-950',
  raised: 'bg-zinc-900',
  overlay: 'bg-zinc-900/95',
  sunken: 'bg-zinc-950/50',
  hover: 'bg-zinc-800/50',
  active: 'bg-zinc-800',
  selected: 'bg-zinc-800/80',
} as const;

// BORDER HIERARCHY
export const border = {
  default: 'border-zinc-800',
  subtle: 'border-zinc-800/50',
  strong: 'border-zinc-700',
  focus: 'border-blue-500',
  error: 'border-red-500',
} as const;

// TEXT HIERARCHY
export const text = {
  primary: 'text-zinc-50',
  secondary: 'text-zinc-300',
  tertiary: 'text-zinc-500',
  disabled: 'text-zinc-600',
  inverse: 'text-zinc-950',
  link: 'text-blue-400 hover:text-blue-300',
} as const;

// SEMANTIC STATUS COLORS
export const status = {
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500', icon: 'text-blue-400', ring: 'ring-blue-500/30' },
  success: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500', icon: 'text-emerald-400', ring: 'ring-emerald-500/30' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500', icon: 'text-amber-400', ring: 'ring-amber-500/30' },
  danger: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500', icon: 'text-red-400', ring: 'ring-red-500/30' },
  neutral: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/30', dot: 'bg-zinc-500', icon: 'text-zinc-400', ring: 'ring-zinc-500/30' },
} as const;

export type StatusVariant = keyof typeof status;

// ACCENT / INTERACTIVE COLORS
export const accent = {
  primary: { bg: 'bg-blue-600', hover: 'hover:bg-blue-500', text: 'text-white' },
  secondary: { bg: 'bg-zinc-700', hover: 'hover:bg-zinc-600', text: 'text-zinc-100' },
  ghost: { bg: 'bg-transparent', hover: 'hover:bg-zinc-800', text: 'text-zinc-300' },
  danger: { bg: 'bg-red-600', hover: 'hover:bg-red-500', text: 'text-white' },
  outline: { bg: 'bg-transparent', hover: 'hover:bg-zinc-800/50', text: 'text-zinc-300', border: 'border border-zinc-700' },
} as const;

// SPACING
export const spacing = {
  page: 'px-6 py-6 lg:px-8',
  card: 'p-5',
  cardCompact: 'p-3',
  section: 'py-6',
  stack: 'space-y-4',
  stackTight: 'space-y-2',
  stackLoose: 'space-y-6',
  inline: 'gap-3',
  inlineTight: 'gap-1.5',
  grid: 'gap-4',
  gridLoose: 'gap-6',
} as const;

// TYPOGRAPHY
export const typography = {
  h1: 'text-2xl font-semibold tracking-tight text-zinc-50',
  h2: 'text-xl font-semibold text-zinc-50',
  h3: 'text-lg font-medium text-zinc-50',
  h4: 'text-base font-medium text-zinc-100',
  body: 'text-sm text-zinc-300',
  bodyLarge: 'text-base text-zinc-300',
  bodySmall: 'text-xs text-zinc-400',
  label: 'text-sm font-medium text-zinc-200',
  caption: 'text-xs text-zinc-500',
  overline: 'text-[10px] font-semibold uppercase tracking-widest text-zinc-500',
  metric: 'text-3xl font-semibold tabular-nums text-zinc-50',
  metricSm: 'text-2xl font-semibold tabular-nums text-zinc-50',
  code: 'font-mono text-sm text-zinc-300',
} as const;

// RADII
export const radius = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
} as const;

// SHADOWS
export const shadow = {
  sm: 'shadow-sm shadow-black/20',
  md: 'shadow-md shadow-black/30',
  lg: 'shadow-lg shadow-black/40',
  glow: {
    blue: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
    green: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    amber: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    red: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
  },
} as const;

// TRANSITIONS
export const transition = {
  fast: 'transition-all duration-150 ease-in-out',
  default: 'transition-all duration-200 ease-in-out',
  slow: 'transition-all duration-300 ease-in-out',
  spring: 'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
} as const;

// Z-INDEX
export const zIndex = {
  base: 'z-0',
  dropdown: 'z-10',
  sticky: 'z-20',
  overlay: 'z-30',
  modal: 'z-40',
  popover: 'z-50',
  toast: 'z-[60]',
  command: 'z-[70]',
} as const;
