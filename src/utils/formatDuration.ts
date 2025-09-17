export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  const parts = [];
  if (hours > 0) parts.push(`${hours}ч`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}м`);
  parts.push(`${seconds}.${milliseconds.toString().padStart(3, "0")}с`);

  return parts.join(" ");
}
