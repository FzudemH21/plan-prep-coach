/**
 * Canonical colors for Tests and Events across the entire app.
 * Use these constants everywhere tests/events are displayed visually.
 */
export const TEST_COLOR = '#f59e0b';   // amber-500
export const EVENT_COLOR = '#3b82f6';  // blue-500

export const testEventGradient = (direction = 'to right') =>
  `linear-gradient(${direction}, ${TEST_COLOR} 50%, ${EVENT_COLOR} 50%)`;
