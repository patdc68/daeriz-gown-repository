const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPeso(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return pesoFormatter.format(Number.isFinite(amount) ? amount : 0);
}
