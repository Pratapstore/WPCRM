/**
 * Utility functions for UPI intent generation, Indian currency formatting,
 * and number-to-words for GST Tax Invoices.
 */

export interface UpiIntentParams {
  upiId: string; // e.g. 'pratapstore@jio'
  payeeName: string; // e.g. 'Pratap Store'
  amount: number;
  transactionNote?: string;
  orderNumber?: string;
}

/**
 * Builds a valid NPCI compliant UPI Deep Link URI.
 * Works on Android & iOS to trigger UPI apps like Google Pay, PhonePe, Paytm, BHIM.
 */
export function buildUpiIntentUri({
  upiId,
  payeeName,
  amount,
  transactionNote,
  orderNumber,
}: UpiIntentParams): string {
  const cleanUpiId = upiId.trim() || 'pratapstore@jio';
  const cleanPayee = encodeURIComponent(payeeName.trim() || 'Pratap Store');
  const cleanNote = encodeURIComponent(
    transactionNote?.trim() || `Payment for Order ${orderNumber || 'Online'}`
  );
  const cleanAmount = Number(amount || 0).toFixed(2);

  return `upi://pay?pa=${cleanUpiId}&pn=${cleanPayee}&am=${cleanAmount}&cu=INR&tn=${cleanNote}${
    orderNumber ? `&tr=${encodeURIComponent(orderNumber)}` : ''
  }`;
}

/**
 * Formats a number as Indian Currency (e.g. ₹1,24,500)
 */
export function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Converts a number to Indian Rupee Words for formal GST invoices.
 * e.g. 1499 -> "One Thousand Four Hundred Ninety-Nine Rupees Only"
 */
export function numberToIndianRupeesWords(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  if (rounded === 0) return 'Zero Rupees Only';

  const singleDigits = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  function convertLessThanOneThousand(n: number): string {
    let result = '';
    if (n >= 100) {
      result += singleDigits[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      result += singleDigits[n] + ' ';
    }
    return result.trim();
  }

  let crore = Math.floor(rounded / 10000000);
  let remAfterCrore = rounded % 10000000;
  let lakh = Math.floor(remAfterCrore / 100000);
  let remAfterLakh = remAfterCrore % 100000;
  let thousand = Math.floor(remAfterLakh / 1000);
  let remainder = remAfterLakh % 1000;

  let words = '';
  if (crore > 0) {
    words += convertLessThanOneThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertLessThanOneThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertLessThanOneThousand(thousand) + ' Thousand ';
  }
  if (remainder > 0) {
    words += convertLessThanOneThousand(remainder) + ' ';
  }

  return `${words.trim()} Rupees Only`;
}

/**
 * Common Indian PIN codes for instant city/state auto-completion
 */
export const INDIAN_PIN_CODE_DIRECTORY: Record<string, { city: string; state: string }> = {
  // Delhi NCR
  '110001': { city: 'New Delhi (Connaught Place)', state: 'Delhi' },
  '110006': { city: 'Old Delhi (Chandni Chowk)', state: 'Delhi' },
  '110019': { city: 'New Delhi (Kalkaji)', state: 'Delhi' },
  '110024': { city: 'New Delhi (Lajpat Nagar)', state: 'Delhi' },
  '110092': { city: 'East Delhi (Laxmi Nagar)', state: 'Delhi' },
  '122001': { city: 'Gurugram', state: 'Haryana' },
  '122018': { city: 'Gurugram DLF', state: 'Haryana' },
  '201301': { city: 'Noida', state: 'Uttar Pradesh' },
  '201010': { city: 'Ghaziabad', state: 'Uttar Pradesh' },
  '121001': { city: 'Faridabad', state: 'Haryana' },

  // Maharashtra
  '400001': { city: 'Mumbai (Fort / CST)', state: 'Maharashtra' },
  '400050': { city: 'Mumbai (Bandra West)', state: 'Maharashtra' },
  '400053': { city: 'Mumbai (Andheri West)', state: 'Maharashtra' },
  '400076': { city: 'Mumbai (Powai)', state: 'Maharashtra' },
  '411001': { city: 'Pune (Camp)', state: 'Maharashtra' },
  '411014': { city: 'Pune (Viman Nagar)', state: 'Maharashtra' },
  '440001': { city: 'Nagpur', state: 'Maharashtra' },

  // Karnataka
  '560001': { city: 'Bengaluru (MG Road)', state: 'Karnataka' },
  '560034': { city: 'Bengaluru (Koramangala)', state: 'Karnataka' },
  '560038': { city: 'Bengaluru (Indiranagar)', state: 'Karnataka' },
  '560066': { city: 'Bengaluru (Whitefield)', state: 'Karnataka' },
  '560100': { city: 'Bengaluru (Electronic City)', state: 'Karnataka' },

  // Telangana & Andhra Pradesh
  '500001': { city: 'Hyderabad (Abids)', state: 'Telangana' },
  '500034': { city: 'Hyderabad (Banjara Hills)', state: 'Telangana' },
  '500081': { city: 'Hyderabad (HITEC City / Madhapur)', state: 'Telangana' },
  '530001': { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  '520001': { city: 'Vijayawada', state: 'Andhra Pradesh' },

  // Tamil Nadu
  '600001': { city: 'Chennai (George Town)', state: 'Tamil Nadu' },
  '600017': { city: 'Chennai (T Nagar)', state: 'Tamil Nadu' },
  '600096': { city: 'Chennai (OMR / Perungudi)', state: 'Tamil Nadu' },
  '641001': { city: 'Coimbatore', state: 'Tamil Nadu' },

  // West Bengal
  '700001': { city: 'Kolkata (BBD Bagh)', state: 'West Bengal' },
  '700091': { city: 'Kolkata (Salt Lake Sector V)', state: 'West Bengal' },
  '700156': { city: 'Kolkata (New Town)', state: 'West Bengal' },

  // Rajasthan
  '302001': { city: 'Jaipur (MI Road)', state: 'Rajasthan' },
  '302017': { city: 'Jaipur (Malviya Nagar)', state: 'Rajasthan' },
  '342001': { city: 'Jodhpur', state: 'Rajasthan' },
  '313001': { city: 'Udaipur', state: 'Rajasthan' },

  // Gujarat
  '380001': { city: 'Ahmedabad (Old City)', state: 'Gujarat' },
  '380015': { city: 'Ahmedabad (Satellite / SG Highway)', state: 'Gujarat' },
  '395001': { city: 'Surat', state: 'Gujarat' },
  '390001': { city: 'Vadodara', state: 'Gujarat' },

  // Uttar Pradesh & Bihar
  '226001': { city: 'Lucknow (Hazratganj)', state: 'Uttar Pradesh' },
  '226010': { city: 'Lucknow (Gomti Nagar)', state: 'Uttar Pradesh' },
  '208001': { city: 'Kanpur', state: 'Uttar Pradesh' },
  '221001': { city: 'Varanasi', state: 'Uttar Pradesh' },
  '800001': { city: 'Patna', state: 'Bihar' },

  // Punjab, MP, Kerala, etc.
  '141001': { city: 'Ludhiana', state: 'Punjab' },
  '160017': { city: 'Chandigarh', state: 'Chandigarh' },
  '452001': { city: 'Indore', state: 'Madhya Pradesh' },
  '462001': { city: 'Bhopal', state: 'Madhya Pradesh' },
  '682001': { city: 'Kochi', state: 'Kerala' },
  '695001': { city: 'Thiruvananthapuram', state: 'Kerala' },
};

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];
