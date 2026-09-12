// The 88 IAU constellations, in Arabic.
//
// Keyed by the IAU three-letter abbreviation — the id both the star catalog
// (data/constellationLines.json, see scripts/build-sky-catalog.mjs) and
// astronomy-engine's own Astronomy.Constellation() use — not by name. A
// name is not a stable key across languages the way "Ori" is, and it is
// the same fragile "match on English display text" this file's sibling
// catalog/countries.ar.js is stuck with only because the land table it
// translates has no better key to offer.
//
// Sourced from ar.wikipedia.org's "قائمة الكوكبات", with two deliberate
// overrides: Ori keeps the shadd already shipped in catalog/ar.js's
// `phrases` dict ('الجبّار', not Wikipedia's 'الجبار') and CVn keeps this
// app's existing 'الكلاب الصائدة' ("the hunting dogs") over Wikipedia's
// 'السلوقيان' ("the salukis") — both are attested Arabic names for the
// constellation, this app just already committed to one of them, in the
// same `phrases` dict, as a label on unrelated deep-sky catalog entries.
// And, Aqr, Tau and Ser needed no override — this table's values for those
// already matched the shipped text exactly.
//
// Note the Tra key: Stellarium's own line data spells Triangulum Australe's
// abbreviation "Tra", not the more common "TrA" — this table has to match
// whatever the data actually uses or the lookup silently misses.

export const constellations = {
    And: 'المرأة المسلسلة',
    Ant: 'مفرغة الهواء',
    Aps: 'طائر الفردوس',
    Aql: 'العقاب',
    Aqr: 'الدلو',
    Ara: 'المجمرة',
    Ari: 'الحمل',
    Aur: 'ممسك الأعنة',
    Boo: 'العواء',
    Cae: 'آلة النقاش',
    Cam: 'الزرافة',
    Cap: 'الجدي',
    Car: 'القاعدة',
    Cas: 'ذات الكرسي',
    Cen: 'قنطورس',
    Cep: 'الملتهب',
    Cet: 'قيطس',
    Cha: 'الحرباء',
    Cir: 'البيكار',
    CMa: 'الكلب الأكبر',
    CMi: 'الكلب الأصغر',
    Cnc: 'السرطان',
    Col: 'الحمامة',
    Com: 'الهلبة',
    CrA: 'الإكليل الجنوبي',
    CrB: 'الإكليل الشمالي',
    Crt: 'الباطية',
    Cru: 'صليب الجنوب',
    Crv: 'الغراب',
    CVn: 'الكلاب الصائدة',
    Cyg: 'الدجاجة',
    Del: 'الدلفين',
    Dor: 'أبو سيف',
    Dra: 'التنين',
    Equ: 'قطعة الفرس',
    Eri: 'النهر',
    For: 'الكور',
    Gem: 'التوأمان',
    Gru: 'الكركي',
    Her: 'الجاثي',
    Hor: 'الساعة',
    Hya: 'الشجاع',
    Hyi: 'حية الماء',
    Ind: 'الهندي',
    Lac: 'العظاءة',
    Leo: 'الأسد',
    Lep: 'الأرنب',
    Lib: 'الميزان',
    LMi: 'الأسد الأصغر',
    Lup: 'السبع',
    Lyn: 'الوشق',
    Lyr: 'القيثارة',
    Men: 'الجبل',
    Mic: 'المجهر',
    Mon: 'وحيد القرن',
    Mus: 'الذبابة',
    Nor: 'مربع النجار',
    Oct: 'الثمن',
    Oph: 'الحواء',
    Ori: 'الجبّار',
    Pav: 'الطاووس',
    Peg: 'الفرس الأعظم',
    Per: 'حامل رأس الغول',
    Phe: 'العنقاء',
    Pic: 'آلة الرسام',
    PsA: 'الحوت الجنوبي',
    Psc: 'الحوت',
    Pup: 'الكوثل',
    Pyx: 'بيت الإبرة',
    Ret: 'الشبكة',
    Scl: 'معمل النحات',
    Sco: 'العقرب',
    Sct: 'الترس',
    Ser: 'الحية',
    Sex: 'السدس',
    Sge: 'السهم',
    Sgr: 'الرامي',
    Tau: 'الثور',
    Tel: 'المرقب',
    Tra: 'المثلث الجنوبي',
    Tri: 'المثلث',
    Tuc: 'الطوقان',
    UMa: 'الدب الأكبر',
    UMi: 'الدب الأصغر',
    Vel: 'الشراع',
    Vir: 'العذراء',
    Vol: 'السمكة الطائرة',
    Vul: 'الثعلب',
};
