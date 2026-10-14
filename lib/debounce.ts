export type Debounced = {
  (): void;
  cancel: () => void;
};

export const REALTIME_REFRESH_DELAY_MS = 300;

// A burst of realtime events used to trigger one full remote refresh each. Collapsing them
// into a single trailing call keeps the request count proportional to user activity instead
// of to the number of events in the burst.
export function debounce(task: () => void, delayMs: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      task();
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return debounced;
}
