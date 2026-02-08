export const animations = {
  fadeIn: 'animate-[fadeIn_200ms_ease-in-out]',
  fadeOut: 'animate-[fadeOut_150ms_ease-in-out]',
  slideUp: 'animate-[slideUp_200ms_ease-out]',
  slideDown: 'animate-[slideDown_200ms_ease-out]',
  slideLeft: 'animate-[slideLeft_200ms_ease-out]',
  slideRight: 'animate-[slideRight_200ms_ease-out]',
  scaleIn: 'animate-[scaleIn_200ms_ease-out]',
  scaleOut: 'animate-[scaleOut_150ms_ease-in]',
  spin: 'animate-spin',
  pulse: 'animate-pulse',
  ping: 'animate-ping',
  bounce: 'animate-bounce',
} as const;

export const keyframes = {
  fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
  fadeOut: { from: { opacity: '1' }, to: { opacity: '0' } },
  slideUp: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
  slideDown: { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
  slideLeft: { from: { transform: 'translateX(8px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
  slideRight: { from: { transform: 'translateX(-8px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
  scaleIn: { from: { transform: 'scale(0.95)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
  scaleOut: { from: { transform: 'scale(1)', opacity: '1' }, to: { transform: 'scale(0.95)', opacity: '0' } },
} as const;

/** CSS class to respect prefers-reduced-motion */
export const motionSafe = 'motion-safe:' as const;

/** Helper to wrap animation classes with motion-safe prefix */
export function withMotionSafe(animationClass: string): string {
  return animationClass
    .split(' ')
    .map((cls) => `motion-safe:${cls}`)
    .join(' ');
}
