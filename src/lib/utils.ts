import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const hStr = h > 0 ? h.toString().padStart(2, '0') + ':' : '';
  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');

  return `${hStr}${mStr}:${sStr}`;
}

/**
 * Formats a US phone number to E.164 format.
 * It now handles various formats including comma-separated numbers.
 * @param phoneNumber The phone number string to format.
 * @returns The formatted phone number (e.g., +1XXXXXXXXXX).
 */
export function formatUSPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    return '';
  }
  
  // If there are multiple numbers, take the first one.
  const potentialNumbers = phoneNumber.split(',');
  const firstPotentialNumber = potentialNumbers[0];

  // Remove all non-digit characters from the selected number
  let digits = firstPotentialNumber.replace(/\D/g, '');

  // If the number is 11 digits long and starts with '1' (e.g., 18002536500)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If the number is 10 digits long, assume it's a US number and add '+1'
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's already in E.164 format, return as is
  if (firstPotentialNumber.startsWith('+1') && digits.length === 11) {
    return `+1${digits}`;
  }

  // Fallback for numbers that don't fit the US pattern but might be valid internationally
  if (firstPotentialNumber.startsWith('+')) {
      return `+${digits}`;
  }
  
  // If no other condition is met, it's likely an invalid or un-formattable number
  return firstPotentialNumber; // Return the cleaned first number as a best effort
}


export const DUMMY_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
