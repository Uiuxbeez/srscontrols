import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string for display. Handles both ISO (YYYY-MM-DD) and
 * Indian DD.MM.YYYY formats stored in the database.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  // Already DD.MM.YYYY — return as-is
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr
  // ISO or YYYY-MM-DD
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function numberToWords(num: number): string {
  if (num === 0) return "Zero Rupees Only";
  
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  const regex = /^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/;

  const n = ("000000000" + num).substr(-9).match(regex);
  if (!n) return "";

  let str = "";
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "Crore " : "";
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "Lakh " : "";
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "Thousand " : "";
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "Hundred " : "";
  str += (Number(n[5]) != 0) ? ((str != "") ? "and " : "") + (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) : "";
  
  return str.trim() + " Rupees Only";
}
