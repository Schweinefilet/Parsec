// Digit substitution for locales whose `numerals` setting (see
// locales/index.js) calls for something other than Western digits.
//
// Only the ten ASCII digits are touched. That is what keeps a catalog value's
// superscript exponent — a distinct run of Unicode code points, not ASCII
// digits — in Western form with no special-casing: nothing here ever matches
// ³⁰, so "10³⁰" comes out as "١٠³⁰" once the base is converted.
const DIGIT_SETS = {
    arab: ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'],
};

export function localizeDigits(value, numerals) {
    const digits = DIGIT_SETS[numerals];
    if (!digits || value == null) return value;
    return String(value).replace(/[0-9]/g, (d) => digits[d]);
}

/** The digit set for a numerals setting, or null when it is Western already. */
export function digitSetFor(numerals) {
    return DIGIT_SETS[numerals] ?? null;
}
