export function formatDisplayDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}


export function formatDisplayDay(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
