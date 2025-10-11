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
 * @param phoneNumber The phone number to format.
 * @returns The formatted phone number (e.g., +1XXXXXXXXXX).
 */
export function formatUSPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    return '';
  }
  // Remove all non-digit characters
  let digits = phoneNumber.replace(/\D/g, '');

  // If the number already has the country code '1' and is 11 digits long
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If the number is 10 digits long, assume it's a US number and add '+1'
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's already in E.164, return as is
  if (phoneNumber.startsWith('+1') && digits.length === 11) {
    return phoneNumber;
  }

  // Otherwise, return the original (or cleaned) number, as it might be an international number or invalid
  // If the original had a '+', keep it.
  if (phoneNumber.startsWith('+') && !phoneNumber.startsWith('+1')) {
    return `+${digits}`;
  }

  // Fallback for numbers that don't fit the US pattern
  return phoneNumber;
}


export const DUMMY_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';