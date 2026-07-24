const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const tens = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty",
  "Sixty", "Seventy", "Eighty", "Ninety",
];

function belowThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n]!;
  if (n < 100) {
    const t = tens[Math.floor(n / 10)]!;
    const o = ones[n % 10];
    return o ? `${t} ${o}` : t;
  }
  const h = ones[Math.floor(n / 100)]!;
  const rest = belowThousand(n % 100);
  return rest ? `${h} Hundred ${rest}` : `${h} Hundred`;
}

export function numberToWords(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return "Zero";

  let n = rounded;
  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (remainder) parts.push(belowThousand(remainder));

  return parts.join(" ") + " Only";
}

export function computeInvoiceTotals(
  items: Array<{ amount: number | string }>,
  cgstRate: number,
  sgstRate: number,
) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const cgstAmount = (subtotal * cgstRate) / 100;
  const sgstAmount = (subtotal * sgstRate) / 100;
  const gross = subtotal + cgstAmount + sgstAmount;
  const netTotal = Math.round(gross);
  const roundOff = netTotal - gross;
  const amountInWords = numberToWords(netTotal);

  return {
    subtotal: subtotal.toFixed(2),
    cgstAmount: cgstAmount.toFixed(2),
    sgstAmount: sgstAmount.toFixed(2),
    roundOff: roundOff.toFixed(2),
    netTotal: netTotal.toFixed(2),
    amountInWords,
  };
}
