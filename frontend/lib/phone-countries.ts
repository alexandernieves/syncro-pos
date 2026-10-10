/**
 * Dial codes for WhatsApp numbers. `mobile` validates the national number once the
 * country code and trunk prefix (the 0 people dial at home) are removed.
 */
export type PhoneCountry = {
  iso: string;
  name: string;
  code: string;
  flag: string;
  mobile: RegExp;
  example: string;
  /** Extra national prefixes to drop besides leading zeros (e.g. 8 in Russia, 1 in the NANP). */
  trunk?: string[];
  /** Prefix WhatsApp needs that people usually leave out (9 for Argentine mobiles). */
  mobilePrefix?: string;
  /** Other names the account country may be saved with. */
  aliases?: string[];
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "VE", name: "Venezuela", code: "58", flag: "🇻🇪", mobile: /^4\d{9}$/, example: "412 123 4567" },
  { iso: "CO", name: "Colombia", code: "57", flag: "🇨🇴", mobile: /^3\d{9}$/, example: "300 123 4567" },
  { iso: "PE", name: "Perú", code: "51", flag: "🇵🇪", mobile: /^9\d{8}$/, example: "912 345 678", aliases: ["peru"] },
  { iso: "EC", name: "Ecuador", code: "593", flag: "🇪🇨", mobile: /^9\d{8}$/, example: "99 123 4567" },
  { iso: "CL", name: "Chile", code: "56", flag: "🇨🇱", mobile: /^9\d{8}$/, example: "9 1234 5678" },
  { iso: "AR", name: "Argentina", code: "54", flag: "🇦🇷", mobile: /^9\d{10}$/, example: "11 2345 6789", mobilePrefix: "9" },
  { iso: "BR", name: "Brasil", code: "55", flag: "🇧🇷", mobile: /^\d{2}9\d{8}$/, example: "11 91234 5678", aliases: ["brazil"] },
  { iso: "UY", name: "Uruguay", code: "598", flag: "🇺🇾", mobile: /^9\d{7}$/, example: "94 123 456" },
  { iso: "PY", name: "Paraguay", code: "595", flag: "🇵🇾", mobile: /^9\d{8}$/, example: "981 123 456" },
  { iso: "BO", name: "Bolivia", code: "591", flag: "🇧🇴", mobile: /^[67]\d{7}$/, example: "7123 4567" },
  { iso: "MX", name: "México", code: "52", flag: "🇲🇽", mobile: /^\d{10}$/, example: "55 1234 5678", trunk: ["044", "045", "01"], aliases: ["mexico"] },
  { iso: "PA", name: "Panamá", code: "507", flag: "🇵🇦", mobile: /^6\d{7}$/, example: "6123 4567", aliases: ["panama"] },
  { iso: "CR", name: "Costa Rica", code: "506", flag: "🇨🇷", mobile: /^[5-8]\d{7}$/, example: "8312 3456" },
  { iso: "NI", name: "Nicaragua", code: "505", flag: "🇳🇮", mobile: /^[578]\d{7}$/, example: "8123 4567" },
  { iso: "HN", name: "Honduras", code: "504", flag: "🇭🇳", mobile: /^[389]\d{7}$/, example: "9123 4567" },
  { iso: "SV", name: "El Salvador", code: "503", flag: "🇸🇻", mobile: /^[67]\d{7}$/, example: "7012 3456" },
  { iso: "GT", name: "Guatemala", code: "502", flag: "🇬🇹", mobile: /^[3-5]\d{7}$/, example: "5123 4567" },
  { iso: "CU", name: "Cuba", code: "53", flag: "🇨🇺", mobile: /^5\d{7}$/, example: "5123 4567" },
  { iso: "DO", name: "República Dominicana", code: "1", flag: "🇩🇴", mobile: /^8[024]9\d{7}$/, example: "809 123 4567", trunk: ["1"], aliases: ["republica dominicana"] },
  { iso: "PR", name: "Puerto Rico", code: "1", flag: "🇵🇷", mobile: /^(787|939)\d{7}$/, example: "787 123 4567", trunk: ["1"] },
  { iso: "US", name: "Estados Unidos", code: "1", flag: "🇺🇸", mobile: /^[2-9]\d{9}$/, example: "305 123 4567", trunk: ["1"], aliases: ["usa", "eeuu", "ee. uu.", "united states"] },
  { iso: "CA", name: "Canadá", code: "1", flag: "🇨🇦", mobile: /^[2-9]\d{9}$/, example: "416 123 4567", trunk: ["1"], aliases: ["canada"] },
  { iso: "TT", name: "Trinidad y Tobago", code: "1", flag: "🇹🇹", mobile: /^868\d{7}$/, example: "868 123 4567", trunk: ["1"] },
  { iso: "AW", name: "Aruba", code: "297", flag: "🇦🇼", mobile: /^[5679]\d{6}$/, example: "560 1234" },
  { iso: "CW", name: "Curazao", code: "599", flag: "🇨🇼", mobile: /^9\d{7}$/, example: "9518 1234", aliases: ["curacao", "curaçao"] },
  { iso: "GY", name: "Guyana", code: "592", flag: "🇬🇾", mobile: /^6\d{6}$/, example: "609 1234" },
  { iso: "ES", name: "España", code: "34", flag: "🇪🇸", mobile: /^[67]\d{8}$/, example: "612 345 678", aliases: ["espana", "spain"] },
  { iso: "PT", name: "Portugal", code: "351", flag: "🇵🇹", mobile: /^9\d{8}$/, example: "912 345 678" },
  { iso: "IT", name: "Italia", code: "39", flag: "🇮🇹", mobile: /^3\d{8,9}$/, example: "312 345 6789", aliases: ["italy"] },
  { iso: "FR", name: "Francia", code: "33", flag: "🇫🇷", mobile: /^[67]\d{8}$/, example: "6 12 34 56 78", aliases: ["france"] },
  { iso: "DE", name: "Alemania", code: "49", flag: "🇩🇪", mobile: /^1[5-7]\d{8,9}$/, example: "151 2345 6789", aliases: ["germany"] },
  { iso: "GB", name: "Reino Unido", code: "44", flag: "🇬🇧", mobile: /^7\d{9}$/, example: "7400 123456", aliases: ["united kingdom", "uk"] },
  { iso: "IE", name: "Irlanda", code: "353", flag: "🇮🇪", mobile: /^8\d{8}$/, example: "85 012 3456" },
  { iso: "NL", name: "Países Bajos", code: "31", flag: "🇳🇱", mobile: /^6\d{8}$/, example: "6 12345678", aliases: ["holanda", "netherlands"] },
  { iso: "BE", name: "Bélgica", code: "32", flag: "🇧🇪", mobile: /^4\d{8}$/, example: "470 12 34 56" },
  { iso: "CH", name: "Suiza", code: "41", flag: "🇨🇭", mobile: /^7\d{8}$/, example: "78 123 45 67" },
  { iso: "RU", name: "Rusia", code: "7", flag: "🇷🇺", mobile: /^9\d{9}$/, example: "912 345 6789", trunk: ["8"] },
  { iso: "TR", name: "Turquía", code: "90", flag: "🇹🇷", mobile: /^5\d{9}$/, example: "501 234 5678" },
  { iso: "IL", name: "Israel", code: "972", flag: "🇮🇱", mobile: /^5\d{8}$/, example: "50 234 5678" },
  { iso: "AE", name: "Emiratos Árabes Unidos", code: "971", flag: "🇦🇪", mobile: /^5\d{8}$/, example: "50 123 4567" },
  { iso: "CN", name: "China", code: "86", flag: "🇨🇳", mobile: /^1\d{10}$/, example: "131 2345 6789" },
  { iso: "IN", name: "India", code: "91", flag: "🇮🇳", mobile: /^[6-9]\d{9}$/, example: "81234 56789" },
  { iso: "JP", name: "Japón", code: "81", flag: "🇯🇵", mobile: /^[789]0\d{8}$/, example: "90 1234 5678" },
  { iso: "AU", name: "Australia", code: "61", flag: "🇦🇺", mobile: /^4\d{8}$/, example: "412 345 678" },
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Country of the Syncro account (saved by name) → dial country. Defaults to Venezuela. */
export function countryFromAccount(country?: string | null): PhoneCountry {
  const key = fold(country || "");
  return (
    PHONE_COUNTRIES.find((c) => fold(c.name) === key || c.iso.toLowerCase() === key || c.aliases?.some((a) => fold(a) === key)) ??
    PHONE_COUNTRIES[0]
  );
}

export function searchPhoneCountries(query: string) {
  const q = fold(query).replace(/^\+/, "");
  if (!q) return PHONE_COUNTRIES;
  return PHONE_COUNTRIES.filter((c) => fold(c.name).includes(q) || c.code.startsWith(q) || c.iso.toLowerCase() === q || c.aliases?.some((a) => fold(a).includes(q)));
}

/**
 * Cleans what the cashier types into the national number field: drops the trunk prefix
 * (0412 → 412 in Venezuela, 8 912… → 912… in Russia) and a pasted country code.
 * Keeps the spaces the person typed so the field doesn't jump around.
 */
export function cleanNationalInput(raw: string, country: PhoneCountry): string {
  let value = raw.replace(/[^\d\s-]/g, "").replace(/^[\s-]+/, "");
  const digitsOf = (v: string) => v.replace(/\D/g, "");
  const dropDigits = (v: string, count: number) => {
    let seen = 0, i = 0;
    while (i < v.length && seen < count) { if (/\d/.test(v[i])) seen++; i++; }
    return v.slice(i).replace(/^[\s-]+/, "");
  };
  // Country code pasted in front of a full number
  const digits = digitsOf(value);
  if (digits.startsWith(country.code) && country.mobile.test(applyMobilePrefix(digits.slice(country.code.length).replace(/^0+/, ""), country))) {
    value = dropDigits(value, country.code.length);
  }
  for (const prefix of country.trunk ?? []) {
    const d = digitsOf(value);
    if (d.startsWith(prefix) && d.length > prefix.length && !country.mobile.test(d)) {
      value = dropDigits(value, prefix.length);
      break;
    }
  }
  while (/^0/.test(value)) value = value.slice(1).replace(/^[\s-]+/, "");
  return value;
}

function applyMobilePrefix(national: string, country: PhoneCountry) {
  if (country.mobilePrefix && !country.mobile.test(national) && country.mobile.test(country.mobilePrefix + national)) {
    return country.mobilePrefix + national;
  }
  return national;
}

/** Full WhatsApp number (+5841…) or null when it isn't a valid mobile for that country. */
export function toWhatsAppNumber(national: string, country: PhoneCountry): string | null {
  const digits = applyMobilePrefix(cleanNationalInput(national, country).replace(/\D/g, ""), country);
  return country.mobile.test(digits) ? `+${country.code}${digits}` : null;
}

/** Text typed starting with + or 00: finds the country by its code and returns the rest. */
export function splitInternational(raw: string, preferred: PhoneCountry): { country: PhoneCountry; national: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) return null;
  const digits = trimmed.replace(/\D/g, "").replace(/^00/, "");
  const matches = PHONE_COUNTRIES.filter((c) => digits.startsWith(c.code)).sort((a, b) => b.code.length - a.code.length);
  if (!matches.length) return null;
  const code = matches[0].code;
  const national = digits.slice(code.length);
  const sameCode = matches.filter((c) => c.code === code);
  // +1 is shared: keep the selected country if it uses it, otherwise pick the one whose numbers match
  const country =
    (sameCode.includes(preferred) && preferred) ||
    sameCode.find((c) => c.mobile.test(applyMobilePrefix(national, c))) ||
    sameCode[0];
  return { country, national };
}

export function formatWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const country = PHONE_COUNTRIES.filter((c) => digits.startsWith(c.code)).sort((a, b) => b.code.length - a.code.length)[0];
  if (!country) return phone;
  const national = digits.slice(country.code.length);
  const groups = national.length === 10 ? [3, 3, 4] : national.length === 9 ? [3, 3, 3] : national.length === 8 ? [4, 4] : national.length === 11 ? [3, 4, 4] : [national.length];
  let i = 0;
  const parts = groups.map((g) => national.slice(i, (i += g)));
  return `+${country.code} ${parts.filter(Boolean).join(" ")}`;
}
