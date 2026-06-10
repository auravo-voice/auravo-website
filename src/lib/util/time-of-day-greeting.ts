/** Greeting phrase for the user's local hour (0–23). */
export function getTimeOfDayGreeting(hour: number): string {
  if (!Number.isFinite(hour)) return "Hello";
  const h = Math.floor(hour);
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Hello";
}
