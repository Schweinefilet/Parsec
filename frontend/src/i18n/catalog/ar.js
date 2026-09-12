// The catalog in Arabic.
//
// Names follow what Arabic astronomy already calls these things rather than
// transliterating the English. The classical planets have had Arabic names for
// a thousand years — عطارد, الزهرة, المريخ, المشتري, زحل — and so do the
// deep-sky objects an Arabic reader is most likely to know: Andromeda is
// المرأة المسلسلة, Orion is الجبار. Bodies named in the last two centuries
// (Triton, Enceladus, Makemake) have no Arabic name to find, so they are
// transliterated, which is what Arabic-language astronomy writing does with
// them too.
//
// Catalogue designations stay in Latin. "TRAPPIST-1e" and "NGC 5195" are
// identifiers, not words: an Arabic reader looking one up will type it exactly
// as it is written here, and rendering it in Arabic script would break the
// only thing it is for.
//
// `phrases` is swept over every stat value after the counted nouns and the
// dates have been handled — see ../localizeCatalog.js. Order does not matter
// here; the compiler sorts longest-first, so "Radial Velocity" is matched
// before "Velocity" and "S-Type" before "Type".

import { countries } from './countries.ar';
import { constellations } from './constellations.ar';

export const ar = {
    intl: 'ar',
    // 240 of them, in their own file — see countries.ar.js. Bundled into this
    // chunk rather than the tracker's, so the lookup stays synchronous.
    countries,
    // The 88 IAU constellations, in their own file — see constellations.ar.js.
    constellations,
    // "April 13, 2029" reads "13 أبريل 2029".
    dayFirstDates: true,
    // Signed numbers need protecting from the bidi algorithm — see
    // isolateSigned in ../localizeCatalog.js.
    rtl: true,

    categories: {
        stars:               { label: 'النجوم',            description: 'أجرام نجمية' },
        planets:             { label: 'الكواكب',           description: 'كواكب النظام الشمسي' },
        'dwarf-planets':     { label: 'الكواكب القزمة',    description: 'بلوتو وما يشبهه من العوالم' },
        moons:               { label: 'الأقمار',           description: 'التوابع الطبيعية' },
        exoplanets:          { label: 'الكواكب الخارجية',  description: 'كواكب خارج نظامنا الشمسي' },
        'deep-sky':          { label: 'السماء العميقة',    description: 'مجرّات وسُدُم وعناقيد' },
        neos:                { label: 'أجرام قريبة',       description: 'أجرام قريبة من الأرض' },
        asteroid:            { label: 'الكويكبات',         description: 'الحزام الرئيسي وكويكبات بارزة' },
        comet:               { label: 'المذنّبات',          description: 'مذنّبات دورية وبارزة' },
        'space-stations':    { label: 'المحطات الفضائية',  description: 'مواقع مأهولة في المدار' },
        'space-telescopes':  { label: 'التلسكوبات',        description: 'مراصد مدارية' },
        'deep-space-probes': { label: 'الفضاء السحيق',     description: 'بين الكواكب وما وراءها' },
        historical:          { label: 'تاريخية',           description: 'مركبات رائدة' },
    },

    types: {
        'G-Type Main-Sequence Star': 'نجم من النسق الأساسي من النوع G',
        'Terrestrial Planet': 'كوكب صخري',
        'Gas Giant': 'عملاق غازي',
        'Ice Giant': 'عملاق جليدي',
        'Dwarf Planet': 'كوكب قزم',
        'Natural Satellite': 'قمر طبيعي',
        'Martian Moon': 'قمر مرّيخي',
        'Galilean Moon': 'قمر جاليلي',
        'Jovian Moon': 'قمر مشتريّ',
        'Saturnian Moon': 'قمر زُحَلي',
        'Uranian Moon': 'قمر أوراني',
        'Neptunian Moon': 'قمر نبتوني',
        'Super-Earth': 'أرض عظمى',
        'Super-Earth Candidate': 'مرشَّح لأرض عظمى',
        'Hot Jupiter': 'مشتري حار',
        'Terrestrial Exoplanet': 'كوكب خارجي صخري',
        'Hycean World Candidate': 'مرشَّح لعالم هايشيني',
        'Water World Candidate': 'مرشَّح لعالم مائي',
        'Lava World': 'عالم من الحمم',
        'Spiral Galaxy': 'مجرّة حلزونية',
        'Interacting Galaxy': 'مجرّة متفاعلة',
        'Emission Nebula': 'سديم انبعاثي',
        'Planetary Nebula': 'سديم كوكبي',
        'Supernova Remnant': 'بقايا مستعر أعظم',
        'Stellar Nursery': 'حضانة نجمية',
        'S-Type Asteroid': 'كويكب من النوع S',
        'B-Type Asteroid': 'كويكب من النوع B',
        'Binary Asteroid System': 'نظام كويكبي ثنائي',
        'Amor Asteroid': 'كويكب من مجموعة أمور',
        'Apollo Asteroid': 'كويكب من مجموعة أبولّو',
        'Main Belt Asteroid': 'كويكب من الحزام الرئيسي',
        'Periodic Comet': 'مذنّب دوري',
        'Space Station': 'محطة فضائية',
        'Space Telescope': 'تلسكوب فضائي',
        'Deep Space Probe': 'مسبار فضاء سحيق',
        'Historical Spacecraft': 'مركبة فضائية تاريخية',
    },

    sections: {
        Physical:  'الخصائص الفيزيائية',
        Orbital:   'الخصائص المدارية',
        General:   'عام',
        Discovery: 'الاكتشاف',
        Location:  'الموقع',
        Hazard:    'الخطورة',
        Stellar:   'الخصائص النجمية',
    },

    statLabels: {
        'Actual Diameter': 'القطر الحقيقي',
        'Active Volcanoes': 'براكين نشطة',
        Age: 'العمر',
        Albedo: 'البياض',
        Altitude: 'الارتفاع',
        Antenna: 'الهوائي',
        Aphelion: 'الأوج الشمسي',
        Apogee: 'الأوج',
        'Apparent Diameter': 'القطر الظاهري',
        'Arrokoth Flyby': 'التحليق قرب أروكوث',
        Atmosphere: 'الغلاف الجوي',
        'Axial Tilt': 'ميل المحور',
        Catalogued: 'أُدرج في الفهارس',
        'Central Object': 'الجرم المركزي',
        'Central Star': 'النجم المركزي',
        Classification: 'التصنيف',
        'Closest Approach': 'أقرب اقتراب',
        'Cloud Temp': 'حرارة السحب',
        Color: 'اللون',
        Companion: 'الرفيق',
        Composition: 'التركيب',
        Constellation: 'الكوكبة',
        'Continuous Crew': 'طاقم متواصل',
        Coordinates: 'الإحداثيات',
        'Core Launch': 'إطلاق الوحدة الأساسية',
        'Core Temperature': 'حرارة النواة',
        'Crew Capacity': 'سعة الطاقم',
        'Cumulative Risk': 'الخطر التراكمي',
        'DART Impact': 'اصطدام DART',
        Decayed: 'تلاشى مداره',
        Density: 'الكثافة',
        Deorbited: 'أُخرج من المدار',
        'Design Life': 'العمر التصميمي',
        Diameter: 'القطر',
        Dimensions: 'الأبعاد',
        Direction: 'الاتجاه',
        Discovery: 'الاكتشاف',
        'Discovery Year': 'سنة الاكتشاف',
        Distance: 'المسافة',
        'Distance (avg)': 'المسافة (متوسط)',
        'Distance from Earth': 'المسافة عن الأرض',
        'Distance from Sun': 'المسافة عن الشمس',
        'ESA Hera Mission': 'مهمة هيرا الأوروبية',
        Eccentricity: 'الانحراف المداري',
        'Equatorial Radius': 'نصف القطر الاستوائي',
        'Equilibrium Temp': 'حرارة التوازن',
        'Escape Velocity': 'سرعة الإفلات',
        'Expansion Rate': 'معدل التمدّد',
        'Expected Life': 'العمر المتوقع',
        'First Catalogued': 'أول إدراج في الفهارس',
        'First Landing': 'أول هبوط',
        'First Module': 'الوحدة الأولى',
        'First Record': 'أول رصد مسجَّل',
        Future: 'المستقبل',
        Geysers: 'النافورات',
        Habitability: 'الصلاحية للحياة',
        'Habitable Volume': 'الحجم الصالح للسكن',
        'Halo Orbit': 'المدار الهالي',
        Heliopause: 'حدّ الغلاف الشمسي',
        'Host Star': 'النجم المضيف',
        'Hubble Image': 'صورة هابل',
        'Ice Shell Depth': 'سُمك القشرة الجليدية',
        'Impact Risk': 'خطر الاصطدام',
        'In Habitable Zone': 'في النطاق الصالح للحياة',
        Inclination: 'الميل المداري',
        'JWST Atmosphere': 'الغلاف الجوي برصد جيمس ويب',
        'JWST Image': 'صورة جيمس ويب',
        'JWST Observation': 'رصد جيمس ويب',
        'Jupiter Flyby': 'التحليق قرب المشتري',
        'Known Moons': 'الأقمار المعروفة',
        'Largest Moon': 'أكبر الأقمار',
        'Last Perihelion': 'آخر حضيض شمسي',
        Launched: 'أُطلق',
        Length: 'الطول',
        Location: 'الموقع',
        'Longest Stay': 'أطول إقامة',
        Luminosity: 'اللمعان',
        'Magnetic Field': 'المجال المغناطيسي',
        Mass: 'الكتلة',
        'Max Wind Speed': 'أقصى سرعة رياح',
        'Mean Diameter': 'القطر المتوسط',
        'Mean Radius': 'نصف القطر المتوسط',
        'Merger Timeline': 'موعد الاندماج',
        'Methane Lakes': 'بحيرات الميثان',
        Method: 'طريقة الاكتشاف',
        'Min Temp': 'أدنى حرارة',
        'Min. Mass': 'الحد الأدنى للكتلة',
        Mirror: 'المرآة',
        'Mirror Diameter': 'قطر المرآة',
        Mission: 'المهمة',
        Modules: 'الوحدات',
        Moon: 'القمر',
        'Moonlet Diameter': 'قطر القُمَير',
        'Moonlet Period': 'دور القُمَير',
        Moons: 'الأقمار',
        'Named For': 'سُمّي على',
        'Nearest PN': 'أقرب سديم كوكبي',
        'Neptune Flyby': 'التحليق قرب نبتون',
        'Next Close App.': 'الاقتراب القادم',
        'Next Perihelion': 'الحضيض الشمسي القادم',
        Nickname: 'اللقب',
        'Nicolas-Claude Fabri': 'نيكولا-كلود فابري',
        'Nobel Prize': 'جائزة نوبل',
        Notable: 'ما يميّزه',
        'Notable Feature': 'أبرز معالمه',
        'Nucleus Size': 'حجم النواة',
        'OSIRIS-REx Sample': 'عيّنة أوزيريس-ركس',
        'Oldest Record': 'أقدم رصد مسجَّل',
        Operator: 'الجهة المشغّلة',
        Orbit: 'المدار',
        'Orbital Period': 'الدور المداري',
        'Orbital Resonance': 'الرنين المداري',
        'Orbital Speed': 'السرعة المدارية',
        Orbits: 'الدورات',
        Origin: 'الأصل',
        Outgassing: 'انبعاث الغازات',
        'Parent Body': 'الجرم الأم',
        'Parent Nebula': 'السديم الأم',
        'Peak Year': 'سنة الذروة',
        Perigee: 'الحضيض',
        Perihelion: 'الحضيض الشمسي',
        Period: 'الدور',
        'Period Change': 'تغيّر الدور',
        'Pillar Height': 'ارتفاع الأعمدة',
        Planets: 'الكواكب',
        'Planned Deorbit': 'الإخراج المخطَّط من المدار',
        'Pluto Flyby': 'التحليق قرب بلوتو',
        Position: 'الموضع',
        'Power Source': 'مصدر الطاقة',
        'Primary Diameter': 'قطر الجرم الرئيسي',
        'Primary Type': 'نوع الجرم الرئيسي',
        'Proplyds Detected': 'الأقراص الكوكبية المرصودة',
        'Pulsar Period': 'دور النابض',
        Radius: 'نصف القطر',
        Region: 'المنطقة',
        Resolution: 'قدرة التمييز',
        'Ring Span': 'اتساع الحلقات',
        'Ring System': 'نظام الحلقات',
        Rings: 'الحلقات',
        'Rotation Period': 'دور الدوران',
        'Saturn Flyby': 'التحليق قرب زُحل',
        'Science Ops': 'بدء العمل العلمي',
        'Semi-major Axis': 'نصف المحور الأكبر',
        'Servicing Missions': 'مهمات الصيانة',
        'Signal Active': 'الإشارة نشطة',
        Size: 'الحجم',
        'Solar Arrays': 'الألواح الشمسية',
        Spacecraft: 'المركبة',
        'Spectral Class': 'الصنف الطيفي',
        Speed: 'السرعة',
        'Speed at Launch': 'السرعة عند الإطلاق',
        'Spiral ID': 'تصنيف الحلزون',
        'Star Formation': 'تكوّن النجوم',
        Stars: 'النجوم',
        Structure: 'البنية',
        Sunshield: 'الدرع الشمسي',
        'Supernova Date': 'تاريخ المستعر الأعظم',
        Surface: 'السطح',
        'Surface Age': 'عمر السطح',
        'Surface Gravity': 'جاذبية السطح',
        'Surface Temp': 'حرارة السطح',
        System: 'النظام',
        'System Distance': 'مسافة النظام',
        Temperature: 'الحرارة',
        'Tidal Lock': 'التقييد المدّي',
        'Torino Scale': 'مقياس تورينو',
        'Total Visits': 'إجمالي الزيارات',
        'Transit Duration': 'مدة العبور',
        Transmitters: 'أجهزة الإرسال',
        Type: 'النوع',
        'Uranus Flyby': 'التحليق قرب أورانوس',
        'Visual Magnitude': 'القدر الظاهري',
        Wavelength: 'الطول الموجي',
        Wavelengths: 'الأطوال الموجية',
        '2017 Flyby': 'تحليق 2017',
        '2022 Flyby': 'تحليق 2022',
        '2029 Flyby': 'تحليق 2029',
        'Launch Year': 'سنة الإطلاق',
        Operational: 'قيد التشغيل',
        Status: 'الحالة',
    },

    // Names the 3D scene uses that differ from the catalog's.
    bodies: {
        Moon: 'القمر',
        ISS: 'المحطة الدولية',
        // The satellite tracker names its craft by short name, and those are
        // not the catalog's names.
        Tiangong: 'تيانغونغ',
        Chandra: 'تشاندرا',
        Hubble: 'هابل',
    },

    assets: {
        'The Milky Way': 'درب التبانة',
        "Saturn's rings": 'حلقات زُحل',
        'Earth at night': 'الأرض ليلًا',
        "Earth's clouds": 'سُحُب الأرض',
        Sun: 'الشمس',
        Mercury: 'عُطارد',
        Venus: 'الزُّهرة',
        Earth: 'الأرض',
        Mars: 'المرّيخ',
        Jupiter: 'المشتري',
        Saturn: 'زُحل',
        Uranus: 'أورانوس',
        Neptune: 'نبتون',
        Moon: 'القمر',
        Iss: 'المحطة الدولية',
        Vesta: 'فيستا',
        Bennu: 'بينو',
        Geographos: 'جيوغرافوس',
        Mithra: 'ميثرا',
        Golevka: 'غوليفكا',
    },

    counted: {
        day:   { zero: 'يوم', one: 'يوم', two: 'يومان', few: 'أيام', many: 'يومًا', other: 'يوم' },
        year:  { zero: 'سنة', one: 'سنة', two: 'سنتان', few: 'سنوات', many: 'سنة', other: 'سنة' },
        hour:  { zero: 'ساعة', one: 'ساعة', two: 'ساعتان', few: 'ساعات', many: 'ساعة', other: 'ساعة' },
        minute: { zero: 'دقيقة', one: 'دقيقة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة', other: 'دقيقة' },
        month: { zero: 'شهر', one: 'شهر', two: 'شهران', few: 'أشهر', many: 'شهرًا', other: 'شهر' },
        week:  { zero: 'أسبوع', one: 'أسبوع', two: 'أسبوعان', few: 'أسابيع', many: 'أسبوعًا', other: 'أسبوع' },
        'light-year': {
            zero: 'سنة ضوئية', one: 'سنة ضوئية', two: 'سنتان ضوئيتان',
            few: 'سنوات ضوئية', many: 'سنة ضوئية', other: 'سنة ضوئية',
        },
    },

    phrases: {
        // ── Units ──
        '°C': '°م',
        'km/h': 'كم/س',
        'km/s': 'كم/ث',
        'm/s²': 'م/ث²',
        'g/cm³': 'غ/سم³',
        'kg/m³': 'كغ/م³',
        km: 'كم',
        kg: 'كغ',
        cm: 'سم',
        m: 'م',
        AU: 'و.ف',
        ly: 'س.ض',
        K: 'كلفن',
        ms: 'ملّي ثانية',
        min: 'د',
        h: 'س',
        yr: 'سنة',
        g: 'غ',
        bar: 'بار',
        MHz: 'ميغاهرتز',
        MJup: 'كتلة مشتري',
        RJup: 'نصف قطر مشتري',
        'arcseconds': 'ثانية قوسية',
        'μm': 'ميكرومتر',
        'BC': 'ق.م',
        'AD': 'م',

        // ── Recurring qualifiers ──
        avg: 'متوسط',
        'est.': 'تقديري',
        equator: 'خط الاستواء',
        photosphere: 'الغلاف الضوئي',
        'cloud tops': 'قمم السحب',
        retrograde: 'تراجعي',
        synchronous: 'متزامن',
        reference: 'مرجعي',
        operational: 'تشغيلي',
        'very dark': 'داكن جدًا',
        'very bright': 'ناصع جدًا',
        'highly eccentric': 'شديد الانحراف',
        extreme: 'متطرف',
        puffy: 'منتفخ',
        'water-rich': 'غني بالماء',
        'ionized gas': 'غاز متأيّن',
        'no hazard': 'لا خطر',
        'coldest known': 'أبرد ما عُرف',
        'main truss': 'الهيكل الرئيسي',
        'first description': 'أول وصف',
        'first spiral': 'أول حلزون',
        'fastest at launch': 'الأسرع عند الإطلاق',
        'post-DART': 'بعد اصطدام DART',
        'deflection proven': 'ثبت الانحراف',
        'still active': 'ما يزال نشطًا',
        'before reentry': 'قبل العودة إلى الغلاف الجوي',
        'returned': 'أُعيدت',
        'launch': 'الإطلاق',
        'radioisotope': 'نظائر مشعّة',
        'high-gain dish': 'طبق عالي الكسب',
        'main primary': 'المرآة الأساسية',
        'primary': 'أساسية',
        'segments': 'قطاعات',
        'layers': 'طبقات',
        'deployable wings': 'أجنحة قابلة للنشر',
        'pressurized': 'مضغوطة',
        'nested pairs of grazing-incidence': 'أزواج متداخلة من المرايا ذات السقوط الماسّ',
        'long-duration expeditions': 'بعثة طويلة الأمد',
        'taikonauts': 'روّاد صينيين',
        'astronauts': 'روّاد فضاء',
        'crew': 'طاقم',
        'wide': 'عرضًا',
        'high': 'ارتفاعًا',
        'radius': 'نصف قطر',
        'known': 'معروف',
        'named': 'مُسمّاة',
        'faint': 'خافتة',
        'rings': 'حلقات',
        'discovered': 'اكتُشف',
        'detected': 'رُصد',
        'tentative': 'مبدئي',
        'transit': 'العبور',
        'radial vel.': 'السرعة الشعاعية',
        'Radial Velocity': 'السرعة الشعاعية',
        'Transit': 'العبور',
        'Transit Photometry': 'قياس ضوء العبور',
        'million': 'مليون',
        'billion': 'مليار',
        'to': 'إلى',
        'and': 'و',
        'with': 'مع',
        'from': 'من',
        'of': 'من',
        'in': 'في',
        'via': 'عبر',
        'live': 'مباشرةً',
        'below': 'أدناه',
        'per': 'في',
        'sec': 'ثانية',
        'first': 'أول',
        'the first': 'الأول',
        'inside Venus orbit': 'داخل مدار الزهرة',
        'beyond Neptune': 'خلف نبتون',
        'Below geostationary orbit': 'دون المدار الثابت بالنسبة للأرض',
        'Interstellar space': 'الفضاء بين النجمي',
        'Kuiper Belt region': 'منطقة حزام كايبر',
        'Kuiper Belt': 'حزام كايبر',
        'Main Asteroid Belt': 'حزام الكويكبات الرئيسي',
        'Asteroid Belt': 'حزام الكويكبات',
        'Captured Kuiper Belt object': 'جرم ملتقَط من حزام كايبر',
        'Likely captured asteroid': 'كويكب ملتقَط على الأرجح',
        'Crossed': 'عبره في',
        'Prehistoric': 'ما قبل التاريخ',
        'Rubble pile': 'كومة أنقاض',
        'Binary': 'ثنائي',
        'Active near perihelion': 'نشط قرب الحضيض الشمسي',
        'Active': 'نشِط',
        'Likely': 'مرجَّح',
        'Yes': 'نعم',
        'No': 'لا',
        'None': 'لا يوجد',
        'Unknown': 'غير معروف',
        'Negligible': 'مهمَل',
        'High potential': 'احتمال مرتفع',
        'Possible Mars impact': 'اصطدام محتمل بالمرّيخ',
        'Potentially Hazardous (PHA)': 'يُحتمل أن يكون خطِرًا (PHA)',
        'Apollo Asteroid': 'كويكب من مجموعة أبولّو',
        'Amor Asteroid': 'كويكب من مجموعة أمور',
        'S-Type': 'من النوع S',
        'B-Type': 'من النوع B',
        'stony': 'صخري',
        'carbonaceous': 'كربوني',
        'primitive carbonaceous': 'كربوني بدائي',
        'Ice, dust, organics': 'جليد وغبار ومركّبات عضوية',
        'Hydrogen and helium': 'هيدروجين وهيليوم',
        'Dense': 'كثيف',
        'ices': 'جليد',
        'Ancient / heavily cratered': 'قديم وكثيف الفوّهات',
        'heavily cratered': 'كثيف الفوّهات',
        'Most heavily cratered Galilean moon': 'أكثر الأقمار الجاليلية فوّهات',
        'Most eccentric known moon orbit': 'أكثر مدارات الأقمار المعروفة انحرافًا',
        'Highest inclination major asteroid': 'أعلى الكويكبات الكبيرة ميلًا مداريًا',
        'Brightest Uranian moon': 'ألمع أقمار أورانوس',
        'Darkest Uranian major moon': 'أعتم أقمار أورانوس الكبرى',
        'Largest moon of Uranus': 'أكبر أقمار أورانوس',
        'Outermost major Uranian moon': 'أبعد أقمار أورانوس الكبرى',
        'Deep red': 'أحمر داكن',
        'sulfur from Io': 'كبريت من آيو',
        'crater': 'فوّهة',
        'valley system': 'شبكة أودية',
        'Evaporating Gaseous Globules': 'كريّات غازية متبخّرة',
        'Eagle Nebula': 'سديم النسر',
        'Nebula': 'سديم',
        'Emission Nebula': 'سديم انبعاثي',
        'H II Region': 'منطقة هيدروجين مؤيَّن',
        'Pulsar': 'نابض',
        'Spiral': 'حلزوني',
        'Trapezium Cluster': 'عنقود شبه المنحرف',
        'protoplanetary disks': 'قرصًا كوكبيًا أوليًا',
        'Sun-like': 'شبيه بالشمس',
        'Earth-like': 'شبيه بالأرض',
        'Lava World': 'عالم من الحمم',
        'Super-Earth': 'أرض عظمى',
        'Hot Jupiter': 'مشتري حار',
        'Osiris': 'أوزيريس',
        'Near-IR to mid-IR': 'الأشعة تحت الحمراء القريبة إلى المتوسطة',
        'Interstellar': 'بين نجمي',

        // ── Constellations ──
        Andromeda: 'المرأة المسلسلة',
        Aquarius: 'الدلو',
        'Canes Venatici': 'الكلاب الصائدة',
        Orion: 'الجبّار',
        Taurus: 'الثور',
        Serpens: 'الحيّة',

        // ── Organisations ──
        NASA: 'ناسا',
        ESA: 'وكالة الفضاء الأوروبية',
        CSA: 'وكالة الفضاء الكندية',
        JAXA: 'جاكسا',
        Roscosmos: 'روسكوزموس',
        'CNSA (China National Space Administration)': 'إدارة الفضاء الوطنية الصينية (CNSA)',
        CNSA: 'إدارة الفضاء الوطنية الصينية',
        'Jet Propulsion Laboratory': 'مختبر الدفع النفّاث',
        'Johns Hopkins APL': 'مختبر الفيزياء التطبيقية بجامعة جونز هوبكنز',
        'Smithsonian CfA operations': 'بتشغيل مركز سميثسونيان للفيزياء الفلكية',
        'Soviet Union': 'الاتحاد السوفيتي',
        'OKB-1': 'المكتب التصميمي OKB-1',

        // ── People and craft named in the data ──
        Galileo: 'غاليليو',
        Huygens: 'هويغنز',
        Cassini: 'كاسيني',
        'William Herschel': 'ويليام هيرشل',
        Herschel: 'هيرشل',
        Messier: 'مسييه',
        'William Lassell': 'ويليام لاسيل',
        Lassell: 'لاسيل',
        'Asaph Hall': 'أساف هول',
        'E.E. Barnard': 'إ. إ. بارنارد',
        'Clyde Tombaugh': 'كلايد تومبو',
        'Gerard Kuiper': 'جيرارد كايبر',
        'Giuseppe Piazzi': 'جوزيبي بياتزي',
        'Heinrich Olbers': 'هاينريش أولبرز',
        Harding: 'هاردينغ',
        Bevis: 'بيفيس',
        Rosse: 'روس',
        Brown: 'براون',
        Trujillo: 'تروخيّو',
        Rabinowitz: 'رابينوفيتز',
        Ortiz: 'أورتيز',
        'Mayor & Queloz': 'مايور وكيلوز',
        'Edmond Halley': 'إدموند هالي',
        'Abd al-Rahman': 'عبد الرحمن الصوفي',
        Polyakov: 'بولياكوف',
        'Chinese chronicles': 'الحوليات الصينية',
        'Voyager 2': 'فوياجر 2',
        'Voyager 1': 'فوياجر 1',
        Dawn: 'مسبار دون',
        'Apollo 11': 'أبولّو 11',
        'ESA Ramses': 'رمسيس الأوروبي',
        'Launched Oct 2024, arrives 2026': 'أُطلق في أكتوبر 2024، ويصل في 2026',
        Dysnomia: 'ديسنوميا',
        Hiʻiaka: 'هيئياكا',
        Namaka: 'ناماكا',
        Dimorphos: 'ديمورفوس',
        Phobos: 'فوبوس',
        Deimos: 'ديموس',
        Europa: 'أوروبا',
        Ganymede: 'غانيميد',
        Io: 'آيو',
        Luna: 'القمر',
        Tianhe: 'تيانخه',
        Wentian: 'ونتيان',
        Mengtian: 'منغتيان',
        Pharos: 'فاروس',

        'Scattered Disc Object': 'جرم من القرص المبعثر',
        'Sub-Neptune': 'دون نبتوني',
        'White dwarf': 'قزم أبيض',
        'V-Type': 'من النوع V',
        basaltic: 'بازلتي',
        confirmed: 'مؤكَّد',
        intrinsic: 'ذاتي',
        candidate: 'مرشَّح',
        Hycean: 'هايشيني',
        optimistic: 'بتقدير متفائل',
        interacting: 'متفاعل',
        complete: 'مكتملة',
        trillion: 'تريليون',
        Since: 'منذ',
        Earth: 'الأرض',
        Sun: 'الشمس',
        'inner edge': 'الحافة الداخلية',
        'before flyby': 'قبل التحليق',
        'X-ray': 'الأشعة السينية',
        keV: 'كيلو إلكترون فولت',
        Kepler: 'كبلر',
        Spitzer: 'سبيتزر',
        'MEarth Project': 'مشروع MEarth',
        Zarya: 'زاريا',
        Korolev: 'كوروليف',
        Ophiuchus: 'الحوّاء',
        Telescopium: 'المقراب',
        'Volatile outgassing': 'انبعاث غازات متطايرة',

        // ── Months ──
        January: 'يناير', February: 'فبراير', March: 'مارس', April: 'أبريل',
        May: 'مايو', June: 'يونيو', July: 'يوليو', August: 'أغسطس',
        September: 'سبتمبر', October: 'أكتوبر', November: 'نوفمبر', December: 'ديسمبر',
        Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل',
        Jun: 'يونيو', Jul: 'يوليو', Aug: 'أغسطس',
        Sept: 'سبتمبر', Sep: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر',
    },

    // Values the sweep cannot get right on its own, because they are sentences
    // rather than a number and a unit.
    exact: {
        'None': 'لا يوجد',
        'None known': 'لا يُعرف شيء',
        'None detected': 'لم يُرصد شيء',
        'None in foreseeable future': 'لا شيء في المستقبل المنظور',
        'Unknown': 'غير معروف',
        'Yes': 'نعم',
        'No': 'لا',
        'Likely': 'مرجَّح',
        '0 (no hazard)': '0 (لا خطر)',
        '1 in 1,750 through 2300': 'واحد من 1,750 حتى عام 2300',
        '2182 (1 in 2,700)': '2182 (واحد من 2,700)',
        'Negligible (100+ yr)': 'مهمَل (لأكثر من 100 سنة)',
        '1 (Luna)': 'واحد (القمر)',
        '2 (Phobos, Deimos)': 'اثنان (فوبوس وديموس)',
        '2 (Hiʻiaka, Namaka)': 'اثنان (هيئياكا وناماكا)',
        '2 (discovered 2017)': 'اثنان (اكتُشفا في 2017)',
        '3 (Tianhe, Wentian, Mengtian)': 'ثلاث (تيانخه وونتيان ومنغتيان)',
        '3 taikonauts': 'ثلاثة روّاد صينيين',
        '7 astronauts': 'سبعة روّاد فضاء',
        '7 pressurized': 'سبع وحدات مضغوطة',
        '146 known': '146 معروفًا',
        '95 known': '95 معروفًا',
        '28 known': '28 معروفًا',
        '16 known': '16 معروفًا',
        '13 known rings': '13 حلقة معروفة',
        '5 named rings': 'خمس حلقات مُسمّاة',
        '4 faint rings': 'أربع حلقات خافتة',
        '~160 billion': 'نحو 160 مليار',
        '~Earth-like': 'شبيه بالأرض تقريبًا',
        'Prehistoric': 'ما قبل التاريخ',
        'Interstellar space': 'الفضاء بين النجمي',
        'Rubble pile': 'كومة أنقاض',
        'Binary': 'ثنائي',
        'Active': 'نشِط',
        'Decayed': 'تلاشى مداره',
        'Deorbited': 'أُخرج من المدار',
        'Radial Velocity': 'السرعة الشعاعية',
        'Transit': 'العبور',
        'Transit Photometry': 'قياس ضوء العبور',
        '1:2:4 with Europa, Ganymede': '1:2:4 مع أوروبا وغانيميد',
        '4:2:1 with Europa, Io': '4:2:1 مع أوروبا وآيو',
        'Ice, dust, organics': 'جليد وغبار ومركّبات عضوية',
        'Hydrogen and helium': 'هيدروجين وهيليوم',
        'Dense N₂, CH₄': 'كثيف من النيتروجين N₂ والميثان CH₄',
        'H₂, CO₂, CH₄ detected': 'رُصد الهيدروجين H₂ وثاني أكسيد الكربون CO₂ والميثان CH₄',
        'H₂O, CH₄, NH₃ ices': 'جليد الماء H₂O والميثان CH₄ والنشادر NH₃',
        '95.3% CO₂': '95.3٪ ثاني أكسيد الكربون',
        '96.5% CO₂': '96.5٪ ثاني أكسيد الكربون',
        '2 (20 MHz and 40 MHz)': 'اثنان (20 و40 ميغاهرتز)',
        '1 × RTG': 'مولّد نظائري حراري واحد',
        '3 × RTG (radioisotope)': 'ثلاثة مولّدات نظائرية حرارية',
        '6 deployable wings': 'ستة أجنحة قابلة للنشر',
        '2.4 m primary': 'مرآة أساسية قطرها 2.4 م',
        '6.5 m (18 segments)': '6.5 م (18 قطاعًا)',
        '21 × 14 m (5 layers)': '21 × 14 م (خمس طبقات)',
        '4 nested pairs of grazing-incidence': 'أربعة أزواج متداخلة من المرايا ذات السقوط الماسّ',
        '109 m (main truss)': '109 م (الهيكل الرئيسي)',
        '58 cm': '58 سم',
        '5 (SM1–SM4, 1993–2009)': 'خمس (SM1–SM4، بين 1993 و2009)',
        '28 long-duration expeditions': '28 بعثة طويلة الأمد',
        '437 days (Polyakov, 1995)': '437 يومًا (بولياكوف، 1995)',
        '10+ years (fuel for 20+)': 'أكثر من 10 سنوات (والوقود يكفي لأكثر من 20)',
        '5 years (still active 25+ years)': 'خمس سنوات (وما يزال نشطًا بعد أكثر من 25)',
        '1,440 before reentry': '1,440 دورة قبل العودة إلى الغلاف الجوي',
        '60 g (returned Sept 2023)': '60 غ (أُعيدت في سبتمبر 2023)',
        '478 kg (launch)': '478 كغ (عند الإطلاق)',
        '733 kg (launch)': '733 كغ (عند الإطلاق)',
        '687 kg/m³ (< water)': '687 كغ/م³ (أقل من الماء)',
        '~800,000 km radius': 'نصف قطر يبلغ نحو 800,000 كم',
        '11.92 h → 11.37 h (post-DART)': '11.92 س ← 11.37 س (بعد اصطدام DART)',
        '−33 minutes (deflection proven)': '−33 دقيقة (ثبت الانحراف)',
        '~15 km/s (55,000 km/h)': 'نحو 15 كم/ث (55,000 كم/س)',
        '~17 km/s (61,000 km/h)': 'نحو 17 كم/ث (61,000 كم/س)',
        '16.26 km/s (fastest at launch)': '16.26 كم/ث (الأسرع عند الإطلاق)',
        '57+ AU (live via JPL below)': 'أكثر من 57 و.ف (مباشرةً من JPL أدناه)',
        '~160 AU (live via JPL below)': 'نحو 160 و.ف (مباشرةً من JPL أدناه)',
        '~2.5° (5 full moons)': 'نحو 2.5° (بعرض خمسة أقمار بدرية)',
        '0.5 arcseconds': '0.5 ثانية قوسية',
        '33.5 ms (30/sec)': '33.5 ملّي ثانية (30 دورة في الثانية)',
        '~160 protoplanetary disks': 'نحو 160 قرصًا كوكبيًا أوليًا',
        'Active — EGGs detected': 'نشِط — رُصدت كريّات غازية متبخّرة',
        'Active (Trapezium Cluster)': 'نشِط (عنقود شبه المنحرف)',
        'Eagle Nebula (M16 / NGC 6611)': 'سديم النسر (M16 / NGC 6611)',
        'Eagle Nebula (M16)': 'سديم النسر (M16)',
        'H II Region / Emission Nebula': 'منطقة هيدروجين مؤيَّن / سديم انبعاثي',
        'Pulsar (PSR B0531+21)': 'نابض (PSR B0531+21)',
        'MK 2 (S/2015 (136472) 1)': 'MK 2 (وتعيينه S/2015 (136472) 1)',
        'Herschel crater (139 km wide)': 'فوّهة هيرشل (عرضها 139 كم)',
        'Pharos crater ~230 km wide': 'فوّهة فاروس، عرضها نحو 230 كم',
        'Ithaca Chasma valley system': 'شبكة أودية إيثاكا كازما',
        'Most heavily cratered Galilean moon': 'أكثر الأقمار الجاليلية فوّهات',
        'Most eccentric known moon orbit': 'أكثر مدارات الأقمار المعروفة انحرافًا',
        'Highest inclination major asteroid': 'أعلى الكويكبات الكبيرة ميلًا مداريًا',
        'Ancient / heavily cratered': 'قديم وكثيف الفوّهات',
        'Deep red (sulfur from Io)': 'أحمر داكن (كبريت من آيو)',
        'Below geostationary orbit': 'دون المدار الثابت بالنسبة للأرض',
        'Potentially Hazardous (PHA)': 'يُحتمل أن يكون خطِرًا (PHA)',
        'High potential': 'احتمال مرتفع',
        'Possible Mars impact': 'اصطدام محتمل بالمرّيخ',
        'ESA Ramses (2029)': 'مهمة رمسيس الأوروبية (2029)',
        'Launched Oct 2024, arrives 2026': 'أُطلق في أكتوبر 2024، ويصل في 2026',
        'Mayor & Queloz (2019)': 'مايور وكيلوز (2019)',
        '1999 (radial vel.) / 2000 (transit)': '1999 (بالسرعة الشعاعية) / 2000 (بالعبور)',
        '2023 (DMS tentative)': '2023 (رصد مبدئي لكبريتيد ثنائي الميثيل)',
        'NASA / Jet Propulsion Laboratory': 'ناسا / مختبر الدفع النفّاث',
        'NASA / Johns Hopkins APL': 'ناسا / مختبر الفيزياء التطبيقية بجامعة جونز هوبكنز',
        'NASA (Smithsonian CfA operations)': 'ناسا (بتشغيل مركز سميثسونيان للفيزياء الفلكية)',
        'NASA / Roscosmos / ESA / JAXA / CSA':
            'ناسا / روسكوزموس / وكالة الفضاء الأوروبية / جاكسا / وكالة الفضاء الكندية',
        'CNSA (China National Space Administration)': 'إدارة الفضاء الوطنية الصينية (CNSA)',
        'Near-IR to mid-IR (0.6–28 μm)':
            'الأشعة تحت الحمراء القريبة إلى المتوسطة (0.6–28 ميكرومتر)',
        '240 BC (Chinese chronicles)': '240 ق.م (الحوليات الصينية)',
        '964 AD (Abd al-Rahman)': '964 م (عبد الرحمن الصوفي)',
        'July 4, 1054 AD': '4 يوليو 1054 م',
        'Edmond Halley (1705 prediction)': 'إدموند هالي (تنبّأ به عام 1705)',
        '~Jul 28, 2061': 'نحو 28 يوليو 2061',
        'Crossed August 2012': 'عبره في أغسطس 2012',
        'Crossed December 2018': 'عبره في ديسمبر 2018',
        '1.93M km (Jan 18, 2022)': '1.93 مليون كم (18 يناير 2022)',
        '7.06M km (Sept 1, 2017)': '7.06 مليون كم (1 سبتمبر 2017)',
        '3,600 km (Jan 26, 2023)': '3,600 كم (26 يناير 2023)',
        '32,000 km (Apr 13, 2029)': '32,000 كم (13 أبريل 2029)',
        '408 km LEO': '408 كم في المدار الأرضي المنخفض',
        '547 km LEO': '547 كم في المدار الأرضي المنخفض',
        '~390 km LEO': 'نحو 390 كم في المدار الأرضي المنخفض',
        '354–374 km (operational)': '354–374 كم (المدار التشغيلي)',
        'July 20, 1969 (Apollo 11)': '20 يوليو 1969 (أبولّو 11)',
        'April 29, 2021 (Tianhe)': '29 أبريل 2021 (تيانخه)',
        'July 12, 2022 (first images)': '12 يوليو 2022 (أول الصور)',
        '1845 (Rosse) — first spiral': '1845 (روس) — أول حلزون يُتعرَّف عليه',
        '1989 (Voyager 2)': '1989 (فوياجر 2)',
        'Dawn (2011–2012)': 'مسبار دون (2011–2012)',
        'Dawn (2015–2018)': 'مسبار دون (2015–2018)',
        '2005 (Brown, Trujillo, Rabinowitz)': '2005 (براون وتروخيّو ورابينوفيتز)',
        '2004 (Brown / Ortiz)': '2004 (براون / أورتيز)',
        '1 (Dysnomia)': 'واحد (ديسنوميا)',
        'Dysnomia': 'ديسنوميا',
        '~150 m (Dimorphos)': 'نحو 150 م (ديمورفوس)',
        '~370 m (0.37 km)': 'نحو 370 م (0.37 كم)',
        '51 Pegasi (G2IV)': '51 الفرس الأعظم (G2IV)',
        '55 Cancri A (G8V)': '55 السرطان A (G8V)',
        'Kepler-22 (G5V, Sun-like)': 'كبلر-22 (G5V، شبيه بالشمس)',
        'Proxima Centauri (M5.5Ve)': 'بروكسيما قنطورس (M5.5Ve)',
        'GJ 1214 (M4.5V)': 'GJ 1214 (M4.5V)',
        'HD 209458 (G0V)': 'HD 209458 (G0V)',
        'Osiris': 'أوزيريس',
        'Lava World / Super-Earth': 'عالم من الحمم / أرض عظمى',
        'Hot Jupiter': 'مشتري حار',
        'S-Type': 'من النوع S',
        'S-Type (stony)': 'من النوع S (صخري)',
        'B-Type (carbonaceous)': 'من النوع B (كربوني)',
        'B-Type (primitive carbonaceous)': 'من النوع B (كربوني بدائي)',
        'Apollo Asteroid': 'كويكب من مجموعة أبولّو',
        'Apollo Asteroid (small)': 'كويكب صغير من مجموعة أبولّو',
        'Amor Asteroid': 'كويكب من مجموعة أمور',
        'Main Asteroid Belt': 'حزام الكويكبات الرئيسي',
        'Kuiper Belt region': 'منطقة حزام كايبر',
        'Captured Kuiper Belt object': 'جرم ملتقَط من حزام كايبر',
        'Likely captured asteroid': 'كويكب ملتقَط على الأرجح',
        'Brightest Uranian moon': 'ألمع أقمار أورانوس',
        'Darkest Uranian major moon': 'أعتم أقمار أورانوس الكبرى',
        'Largest moon of Uranus': 'أكبر أقمار أورانوس',
        'Outermost major Uranian moon': 'أبعد أقمار أورانوس الكبرى',
        'M1 / NGC 1952': 'M1 / NGC 1952',
        'M31 / NGC 224': 'M31 / NGC 224',
        'M42 / NGC 1976': 'M42 / NGC 1976',
        'M51 / NGC 5194': 'M51 / NGC 5194',
        'NGC 5195': 'NGC 5195',
        'NGC 7293': 'NGC 7293',
        'SA(s)b Spiral': 'حلزوني من الصنف SA(s)b',
        'Andromeda': 'المرأة المسلسلة',
        'Aquarius': 'الدلو',
        'Canes Venatici': 'الكلاب الصائدة',
        'Orion': 'الجبّار',
        '~4.5 billion years': 'نحو 4.5 مليار سنة',
        '4.6 billion years': '4.6 مليار سنة',
        '~15 million K': 'نحو 15 مليون كلفن',
        '5,778 K (photosphere)': '5,778 كلفن (الغلاف الضوئي)',
        '10,000 K (ionized gas)': '10,000 كلفن (غاز متأيّن)',
        '~25 days (equator)': 'نحو 25 يومًا (عند خط الاستواء)',
        '243.02 days (retrograde)': '243.02 يومًا (تراجعي)',
        '27.32 days (synchronous)': '27.32 يومًا (متزامن)',
        '0.7365 days (17.7 h)': '0.7365 يومًا (17.7 ساعة)',
        '0.00° (reference)': '0.00° (مرجعي)',
        '2.537 million ly': '2.537 مليون سنة ضوئية',
        '~220,000 light-years': 'نحو 220,000 سنة ضوئية',
        '~76,000 light-years': 'نحو 76,000 سنة ضوئية',
        '31 million light-years': '31 مليون سنة ضوئية',
        '~6,500 light-years': 'نحو 6,500 سنة ضوئية',
        '4–5 light-years': '4–5 سنوات ضوئية',
        '~3 light-years': 'نحو 3 سنوات ضوئية',
        '~24 light-years': 'نحو 24 سنة ضوئية',
        'Thin N₂, trace CH₄': 'رقيق من النيتروجين N₂ مع أثر من الميثان CH₄',
        'Thin O₂ and CO₂': 'رقيق من الأكسجين O₂ وثاني أكسيد الكربون CO₂',
        'Trace oxygen detected': 'رُصدت آثار من الأكسجين',
        'Two-tone dark/bright hemispheres': 'نصفا كرة ثنائيا اللون: أحدهما داكن والآخر ناصع',
        'Verona Rupes — 20 km cliff': 'جرف فيرونا روبيس — ارتفاعه 20 كم',
        'Yes (confirmed 2017)': 'نعم (تأكّد عام 2017)',
        'Yes (intrinsic)': 'نعم (ذاتي)',
        'Yes (inner edge)': 'نعم (عند الحافة الداخلية)',
        'Yes (optimistic)': 'نعم (بتقدير متفائل)',
        'Yes (to Earth)': 'نعم (تجاه الأرض)',
        'Super-Earth candidate': 'مرشَّح لأرض عظمى',
        'Super-Earth / Sub-Neptune': 'أرض عظمى / دون نبتوني',
        'Sub-Neptune / Hycean candidate': 'دون نبتوني / مرشَّح لعالم هايشيني',
        'Transit (Kepler)': 'العبور (كبلر)',
        'Transit (Spitzer)': 'العبور (سبيتزر)',
        'Transit (MEarth Project)': 'العبور (مشروع MEarth)',
        'TRAPPIST-1 (M8V)': 'TRAPPIST-1 (M8V)',
        'Volatile outgassing (2024)': 'انبعاث غازات متطايرة (2024)',
        '~1 trillion': 'نحو تريليون نجم',
        'SAbc Spiral (interacting)': 'حلزوني من الصنف SAbc (متفاعل)',
        'White dwarf (AG7)': 'قزم أبيض (AG7)',
        '4 days before flyby': 'أربعة أيام قبل التحليق',
        'Zarya — Nov 20, 1998': 'زاريا — 20 نوفمبر 1998',
        'Since Nov 2, 2000': 'منذ 2 نوفمبر 2000',
        '~100,000 kg (complete)': 'نحو 100,000 كغ (مكتملة)',
        'UV, visible, near-IR': 'فوق بنفسجية ومرئية وتحت حمراء قريبة',
        'Through 2030s': 'حتى ثلاثينيات هذا القرن',
        'Sun–Earth L2 Lagrange Point': 'نقطة لاغرانج الثانية L2 بين الشمس والأرض',
        '~1.5 million km from Earth': 'نحو 1.5 مليون كم عن الأرض',
        'X-ray (0.1–10 keV)': 'الأشعة السينية (0.1–10 كيلو إلكترون فولت)',
        'Toward Ophiuchus constellation': 'باتجاه كوكبة الحوّاء',
        'Toward Telescopium constellation': 'باتجاه كوكبة المقراب',
        'Soviet Union (OKB-1 / Korolev)': 'الاتحاد السوفيتي (المكتب التصميمي OKB-1 / كوروليف)',
        'V-Type (basaltic)': 'من النوع V (بازلتي)',
    },

    objects: {
        sun: {
            name: 'الشمس',
            description: 'الشمس هي النجم الذي يتوسّط النظام الشمسي، ومصدر كل الطاقة تقريبًا التي'
                + ' تحرّك الحياة والطقس على الأرض. جاذبيتها تُبقي الكواكب في مداراتها، بينما يمدّ'
                + ' الاندماج النووي في قلبها الضوء والحرارة إلى كل عالم في هذا النظام.',
        },
        mercury: {
            name: 'عُطارد',
            description: 'أصغر كواكب النظام الشمسي وأقربها إلى الشمس. لا غلاف جوي لعُطارد يحتفظ'
                + ' بالحرارة، فتتأرجح حرارة سطحه تأرجحًا هائلًا بين −180 °م ليلًا و430 °م نهارًا.',
        },
        venus: {
            name: 'الزُّهرة',
            description: 'تُسمّى غالبًا توأم الأرض لتقارب الحجم والكتلة، غير أن للزُّهرة غلافًا جويًا'
                + ' كثيفًا من ثاني أكسيد الكربون يولّد احتباسًا حراريًا جامحًا يجعلها أشد الكواكب'
                + ' حرارة عند 465 °م — أشدّ حتى من عُطارد.',
        },
        earth: {
            name: 'الأرض',
            description: 'كوكبنا، والجرم الوحيد المعروف في الكون الذي ثبت أنه يحتضن الحياة. محيطات'
                + ' الأرض من الماء السائل، ومجالها المغناطيسي الواقي، وغلافها الجوي من النيتروجين'
                + ' والأكسجين، تصنع بيئة صالحة للحياة لا نظير لها.',
        },
        mars: {
            name: 'المرّيخ',
            description: 'الكوكب الأحمر، سُمّي بذلك لسطحه الصدئ بأكاسيد الحديد، ويحمل أوليمبوس مونس —'
                + ' أعلى بركان في النظام الشمسي — ووادي مارينيريس، شبكة أخاديد تقزّم الأخدود العظيم.',
        },
        jupiter: {
            name: 'المشتري',
            description: 'أكبر الكواكب، وكتلته تفوق ضِعف كتل الكواكب الأخرى مجتمعة. البقعة الحمراء'
                + ' العظيمة عاصفة عمرها قرون وأكبر من الأرض، ومجاله المغناطيسي الجبّار يولّد شفقًا'
                + ' قطبيًا مذهلًا.',
        },
        saturn: {
            name: 'زُحل',
            description: 'نظام حلقات زُحل الشهير يمتدّ 282,000 كم ولا يتجاوز سُمكه 10–100 م، وهو من'
                + ' الجليد والصخر. وزُحل أقلّ الكواكب كثافة، حتى إنه سيطفو على الماء لو وُجد محيط'
                + ' يسعه.',
        },
        uranus: {
            name: 'أورانوس',
            description: 'يدور أورانوس على جنبه بميل محوري يبلغ 97.8°، على الأرجح بفعل اصطدام هائل'
                + ' قديم. ولونه الأزرق المخضرّ يأتي من امتصاص الميثان للضوء الأحمر. وغلافه الجوي'
                + ' هو أبرد غلاف كوكبي عند −224 °م.',
        },
        neptune: {
            name: 'نبتون',
            description: 'أعصف الكواكب رياحًا، وتبلغ رياحه الأسرع من الصوت 2,100 كم/س. وقد تنبّأ به'
                + ' الحساب الرياضي قبل أن يُرصد. ويدور قمره الكبير تريتون في اتجاه معاكس لدوران'
                + ' نبتون نفسه.',
        },
        pluto: {
            name: 'بلوتو',
            description: 'بلوتو أشهر الكواكب القزمة في النظام الشمسي، ويدور بعيدًا خلف نبتون في حزام'
                + ' كايبر. ومداره الشديد الانحراف والميل يحمله بين 29.7 و49.3 وحدة فلكية عن الشمس،'
                + ' ويغلب على سطحه جليد النيتروجين والميثان وأول أكسيد الكربون.',
        },
        ceres: {
            name: 'سيريس',
            description: 'سيريس أكبر أجرام حزام الكويكبات والكوكب القزم الوحيد في النظام الشمسي'
                + ' الداخلي. اكتُشف عام 1801 وصُنّف أول الأمر كوكبًا، ثم أُعيد تصنيفه كوكبًا قزمًا'
                + ' عام 2006. وقد كشف مسبار دون التابع لناسا عن ترسّبات ناصعة من كربونات الصوديوم'
                + ' في فوّهة أوكاتور، تلمّح إلى نشاط جيولوجي حديث.',
        },
        eris: {
            name: 'إيريس',
            description: 'إيريس أضخم الكواكب القزمة المعروفة كتلةً — وأكثف قليلًا من بلوتو. وقد فجّر'
                + ' اكتشافه عام 2005 نقاش الاتحاد الفلكي الدولي الذي أعاد تصنيف بلوتو. وإيريس جرم'
                + ' من القرص المبعثر بمدار شديد الانحراف يحمله بعيدًا خلف حزام كايبر، ويغطّي سطحه'
                + ' جليد الميثان، فيجعله من ألمع أجرام النظام الشمسي.',
        },
        haumea: {
            name: 'هاوميا',
            description: 'هاوميا من أسرع الأجرام الكبيرة دورانًا في النظام الشمسي، إذ يُتمّ دورة'
                + ' كاملة في أقل من أربع ساعات بقليل. وهذا الدوران السريع يمنحه شكلًا إهليلجيًا'
                + ' ممدودًا مميّزًا. وله قمران — هيئياكا وناماكا — وكان أول جرم في حزام كايبر'
                + ' يُكتشف أن له نظام حلقات.',
        },
        makemake: {
            name: 'ماكيماكي',
            description: 'ماكيماكي ثاني ألمع أجرام حزام كايبر بعد بلوتو، وثالث أكبر الكواكب القزمة'
                + ' المعروفة. سُمّي على إله الخلق عند شعب رابا نوي، ولا غلاف جوي يمكن رصده حوله،'
                + ' وسطحه شديد البرودة تغطّيه أجلدة الإيثان والميثان، وله قمر صغير واحد معروف'
                + ' اكتشفه هابل عام 2016.',
        },
        luna: {
            name: 'القمر',
            description: 'التابع الطبيعي الوحيد للأرض، وخامس أكبر الأقمار في النظام الشمسي. جاذبية'
                + ' القمر هي التي تحرّك مدّنا وجزرنا وتثبّت ميل محور الأرض. وهو الجرم الوحيد خارج'
                + ' الأرض الذي مشى عليه البشر.',
        },
        phobos: {
            name: 'فوبوس',
            description: 'فوبوس أكبر قمري المرّيخ وأقربهما إليه، ويدور قريبًا منه إلى حدّ أنه يشرق'
                + ' ويغرب مرتين في اليوم المرّيخي. ومداره يتضاءل ببطء، وسيتفكّك على الأرجح أو يرتطم'
                + ' بالمرّيخ خلال عشرات الملايين من السنين.',
        },
        deimos: {
            name: 'ديموس',
            description: 'ديموس أصغر قمري المرّيخ، وسطحه داكن غير منتظم، ما يرجّح أنه كويكب ملتقَط.'
                + ' ويدور أبعد عن المرّيخ من فوبوس، وينجرف إلى الخارج ببطء شديد.',
        },
        io: {
            name: 'آيو',
            description: 'آيو أشدّ الأجرام نشاطًا بركانيًا في النظام الشمسي، يدفعه إلى ذلك ثنيٌ مدّيّ'
                + ' عنيف من المشتري ورنينٌ مداري مع أوروبا وغانيميد.',
        },
        europa: {
            name: 'أوروبا',
            description: 'يُرجَّح أن تخفي أوروبا محيطًا عالميًا من الماء المالح تحت قشرتها الجليدية،'
                + ' ما يجعلها من أفضل أهداف البحث عن الحياة في النظام الشمسي.',
        },
        ganymede: {
            name: 'غانيميد',
            description: 'غانيميد أكبر قمر في النظام الشمسي، والقمر الوحيد المعروف بأنه يولّد مجالًا'
                + ' مغناطيسيًا خاصًا به.',
        },
        callisto: {
            name: 'كاليستو',
            description: 'كاليستو أبعد أقمار المشتري الجاليلية الأربعة، وسطحه مثقل بالفوّهات وقديم'
                + ' جيولوجيًا.',
        },
        titan: {
            name: 'تيتان',
            description: 'تيتان أكبر أقمار زُحل، والقمر الوحيد في النظام الشمسي ذو غلاف جوي كثيف'
                + ' وسوائل مستقرة على سطحه.',
        },
        enceladus: {
            name: 'إنسيلادوس',
            description: 'إنسيلادوس قمر جليدي تنبثق من قطبه الجنوبي نافورات نشطة تغذّي حلقة E عند'
                + ' زُحل وتلمّح إلى محيط تحت سطحه.',
        },
        triton: {
            name: 'تريتون',
            description: 'تريتون أكبر أقمار نبتون، والقمر الكبير الوحيد في النظام الشمسي ذو مدار'
                + ' تراجعي، ما يرجّح أنه التُقط من حزام كايبر.',
        },
        amalthea: {
            name: 'أمالثيا',
            description: 'أمالثيا خامس أكبر أقمار المشتري، وآخر قمر اكتُشف بالرصد البصري المباشر.'
                + ' ولونه الأحمر الغامق يأتي من مركّبات الكبريت المقذوفة من آيو. ويدور قريبًا من'
                + ' المشتري إلى حدّ أنه يقع داخل نظام حلقاته.',
        },
        mimas: {
            name: 'ميماس',
            description: 'ميماس أصغر أقمار زُحل الرئيسية وأقربها إليه، واشتهر بفوّهته الهائلة'
                + ' هيرشل — التي تبلغ ثلث قطره — والتي تمنحه شبهًا لافتًا بنجمة الموت. ورغم سطحه'
                + ' الجليدي، يلمّح الثني المدّيّ إلى احتمال وجود طبقة ماء سائل تحت السطح.',
        },
        tethys: {
            name: 'تيثيس',
            description: 'تيثيس من أقمار زُحل الجليدية الكبرى، ويغلب عليه معلمان جيولوجيان بارزان:'
                + ' فوّهة أوديسيوس الاصطدامية الهائلة، وأخدود إيثاكا كازما، وهو شبكة أودية تمتدّ'
                + ' ثلاثة أرباع محيط القمر.',
        },
        dione: {
            name: 'ديوني',
            description: 'ديوني قمر زُحلي جليدي كثيف، نصف كرته الأمامي مثقل بالفوّهات، ويقطع جانبه'
                + ' الخلفي جروف جليدية ناصعة تُعرف بالتضاريس الخيطية. وقد رصد كاسيني غلافًا جويًا'
                + ' رقيقًا من الأكسجين ونشاطًا حراريًا مائيًا محتملًا.',
        },
        rhea: {
            name: 'ريا',
            description: 'ريا ثاني أكبر أقمار زُحل، وتاسع أكبر أجرام النظام الشمسي من الأقمار. وسطحه'
                + ' المثقل بالفوّهات يوحي بأنه ظلّ خاملًا جيولوجيًا معظم تاريخه. وقد رصد كاسيني حوله'
                + ' غلافًا جويًا رقيقًا من الأكسجين وثاني أكسيد الكربون.',
        },
        iapetus: {
            name: 'يابيتوس',
            description: 'يابيتوس من أكثر أقمار النظام الشمسي إثارة للنظر، إذ إن أحد نصفيه أسود'
                + ' كالفحم والآخر ناصع كالثلج. وقد حيّر هذا المظهر ثنائي اللون الفلكيين قرونًا،'
                + ' وسببه تراكم غبار داكن على وجهه الأمامي.',
        },
        miranda: {
            name: 'ميراندا',
            description: 'ميراندا أصغر أقمار أورانوس الخمسة الرئيسية وأقربها إليه، ومع ذلك تعرض أشدّ'
                + ' التضاريس تنوّعًا ودراماتيكية بين أقمار النظام الشمسي. وجرف فيرونا روبيس، الذي'
                + ' يزيد ارتفاعه على 20 كم، هو الأعلى المعروف في النظام الشمسي.',
        },
        ariel: {
            name: 'أرييل',
            description: 'أرييل ألمع أقمار أورانوس الرئيسية، وسطحه فتيّ جيولوجيًا تغطّيه الأودية'
                + ' والحيود وجروف الصدوع، ما يوحي بتسخين مدّيّ سابق. وشبكة أوديته الأخدودية تجعله'
                + ' أنشط أقمار أورانوس جيولوجيًا.',
        },
        umbriel: {
            name: 'أمبرييل',
            description: 'أمبرييل أعتم أقمار أورانوس الرئيسية، وسطحه قديم على نحو متجانس ومثقل'
                + ' بالفوّهات، ما يوحي بقلّة النشاط الجيولوجي منذ تكوّنه. ولا يزال حلقة ناصعة'
                + ' غامضة داخل فوّهة وندا عند خط استوائه بلا تفسير.',
        },
        titania: {
            name: 'تيتانيا',
            description: 'تيتانيا أكبر أقمار أورانوس وثامن أكبر أقمار النظام الشمسي. ويُظهر سطحه'
                + ' مزيجًا من فوّهات قديمة ومعالم تكتونية أحدث، منها أخاديد صدعية عملاقة، تلمّح إلى'
                + ' تسخين داخلي في الماضي.',
        },
        oberon: {
            name: 'أوبيرون',
            description: 'أوبيرون أبعد أقمار أورانوس الرئيسية وثانيها حجمًا. وسطحه المثقل بالفوّهات'
                + ' من أقدم الأسطح في نظام أورانوس، ولعدة فوّهات فيه ترسّبات داكنة في قيعانها قد'
                + ' تكون مادة عضوية من ثورات تحت سطحية.',
        },
        proteus: {
            name: 'بروتيوس',
            description: 'بروتيوس ثاني أكبر أقمار نبتون وأكبر أقماره الداخلية، ومع ذلك ظلّ مجهولًا'
                + ' حتى تحليق فوياجر 2 عام 1989، لأنه يدور قريبًا جدًا من وهج نبتون. وسطحه الداكن'
                + ' غير المنتظم مثقل بالفوّهات، وفيه فوّهة واحدة، فاروس، تكاد تعادل القمر نفسه'
                + ' اتساعًا.',
        },
        nereid: {
            name: 'نيريد',
            description: 'لنيريد واحد من أشدّ مدارات الأقمار انحرافًا في النظام الشمسي، إذ يتأرجح بين'
                + ' 1.4 و9.7 مليون كم عن نبتون. ويوحي هذا المدار المتطرف بأنه قد يكون جرمًا ملتقَطًا'
                + ' من حزام كايبر، أو أنه اضطرب جاذبيًا حين التُقط تريتون.',
        },
        'proxima-centauri-b': {
            name: 'بروكسيما قنطورس b',
            description: 'أقرب كوكب خارجي معروف إلى الأرض، يدور في النطاق الصالح للحياة حول بروكسيما'
                + ' قنطورس — أقرب نجم إلى الشمس. وصلاحيته للحياة غير مؤكدة بسبب التوهّجات النجمية'
                + ' العنيفة من نجمه القزم الأحمر.',
        },
        'kepler-22b': {
            name: 'كبلر-22b',
            description: 'أول كوكب خارجي يتأكد وقوعه في النطاق الصالح للحياة حول نجم شبيه بالشمس.'
                + ' وبنصف قطر يبلغ 2.4 ضعف نصف قطر الأرض وحرارة توازن قدرها −11 °م، قد يحمل'
                + ' كبلر-22b ماءً سائلًا إن كان له غلاف جوي.',
        },
        '51-peg-b': {
            name: '51 الفرس الأعظم b',
            description: 'أول كوكب خارجي يتأكد وجوده حول نجم شبيه بالشمس، اكتُشف عام 1995 — وكان'
                + ' علامة فارقة في علم الفلك. وهو «مشتري حار» يدور أقرب إلى نجمه بمئة ضعف مما يدور'
                + ' المشتري حول الشمس، فتبلغ حرارة سطحه نحو 1,200 °م.',
        },
        'trappist-1e': {
            name: 'TRAPPIST-1e',
            description: 'أحد سبعة كواكب بحجم الأرض تدور حول النجم القزم فائق البرودة TRAPPIST-1،'
                + ' ويُعدّ أكثرها احتمالًا للصلاحية للحياة. ويتلقّى TRAPPIST-1e طاقة نجمية قريبة مما'
                + ' تتلقّاه الأرض، وقد يحمل ماءً سائلًا.',
        },
        'k2-18b': {
            name: 'K2-18b',
            description: 'كوكب دون نبتوني في النطاق الصالح للحياة، غلافه الجوي غني بالهيدروجين. وقد'
                + ' رصد تلسكوب جيمس ويب الفضائي فيه ثاني أكسيد الكربون والميثان — ورصدًا مبدئيًا'
                + ' لكبريتيد ثنائي الميثيل، وهو جزيء تنتجه الحياة على الأرض.',
        },
        'hd-209458b': {
            name: 'HD 209458 b',
            description: 'لُقّب بـ«أوزيريس»، وكان أول كوكب خارجي يُرصد بطريقة العبور (عام 2000) وأول'
                + ' كوكب يُعرف أن له غلافًا جويًا. وقد رصد هابل هيدروجينًا وأكسجينًا وكربونًا تتبخّر'
                + ' من غلافه الممتدّ.',
        },
        'gj-1214b': {
            name: 'GJ 1214 b',
            description: 'أول أرض عظمى ذات غلاف جوي مؤكَّد تُدرَس بالتفصيل. وتشير النماذج إلى أن'
                + ' GJ 1214 b «عالم مائي» — ربما نصف كتلته ماء — يلفّه غلاف بخاري كثيف، وهو صنف من'
                + ' الكواكب لا نظير له في نظامنا الشمسي.',
        },
        '55-cnc-e': {
            name: '55 السرطان e',
            description: 'أرض عظمى قريبة من نجمها إلى حدّ أنها تُتمّ دورة كاملة في أقل من 18 ساعة.'
                + ' وتتجاوز حرارة سطحها 2,700 °م — وهو ما يكفي لصهر الصخر. وقد رصد جيمس ويب فيها'
                + ' غلافًا جويًا بركانيًا محتملًا.',
        },
        andromeda: {
            name: 'مجرة المرأة المسلسلة',
            description: 'أقرب جاراتنا المجرّية الكبيرة، وأبعد جرم يُرى بالعين المجردة. ومجرة المرأة'
                + ' المسلسلة (M31) في طريقها للاصطدام بدرب التبانة، ويُتوقع أن تندمج معها بعد نحو'
                + ' 4.5 مليار سنة.',
        },
        'orion-nebula': {
            name: 'سديم الجبّار',
            description: 'من أكثر الأجرام دراسةً في علم الفلك، ومن ألمع السُّدُم التي تُرى بالعين'
                + ' المجردة. وهو حضانة نجمية تتكوّن فيها نجوم وأنظمة كوكبية جديدة من سُحُب غاز وغبار'
                + ' منهارة.',
        },
        'crab-nebula': {
            name: 'سديم السرطان',
            description: 'البقايا المتمدّدة لمستعر أعظم رصده الفلكيون الصينيون عام 1054 م. وفي مركزه'
                + ' نجم نيوتروني سريع الدوران (نابض) يدور ثلاثين مرة في الثانية، باثًّا حزمًا من'
                + ' الإشعاع.',
        },
        'pillars-of-creation': {
            name: 'أعمدة الخلق',
            description: 'أعمدة من الغاز والغبار تشبه خراطيم الفيلة داخل سديم النسر، تتكوّن فيها نجوم'
                + ' جديدة. وهي من أشهر صور هابل (1995). وقد كشفت صورة جيمس ويب عام 2022 نجومًا فتيّة'
                + ' مغروسة فيها لم تُرَ من قبل.',
        },
        'whirlpool-galaxy': {
            name: 'مجرة الدوّامة',
            description: 'M51 مجرة حلزونية بديعة التصميم تتفاعل مع رفيقتها الأصغر NGC 5195. ويدفع هذا'
                + ' التفاعل تكوّن النجوم بشدّة في الأذرع الحلزونية. وهي أول مجرة يُتعرَّف عليها'
                + ' كمجرة حلزونية.',
        },
        'helix-nebula': {
            name: 'السديم الحلزوني',
            description: 'أكبر سديم كوكبي في السماء بالحجم الظاهري، ويُلقَّب بـ«عين الله». وهو بقايا'
                + ' الطبقات الخارجية لنجم شبيه بالشمس قذفها وهو يحتضر، وتحيط بقزم أبيض في مركزه.',
        },
        apophis: {
            name: '99942 أبوفيس',
            description: 'سيقوم أبوفيس بواحد من أقرب تحليقات الكويكبات في التاريخ المسجَّل يوم 13'
                + ' أبريل 2029 — إذ يمرّ على بعد 32,000 كم من الأرض، أقرب من الأقمار الثابتة بالنسبة'
                + ' للأرض. وتستبعد بيانات الرادار أي اصطدام لمئة عام على الأقل.',
        },
        bennu: {
            name: '101955 بينو',
            description: 'كويكب من نوع كومة الأنقاض، واحتمال اصطدامه من أعلى الاحتمالات بين الأجرام'
                + ' القريبة من الأرض المعروفة. وقد جمعت مهمة أوزيريس-ركس التابعة لناسا عيّنة وزنها'
                + ' 60 غرامًا عام 2020، أُعيدت إلى الأرض عام 2023، وتُدرَس تركيبها الآن.',
        },
        didymos: {
            name: '65803 ديديموس',
            description: 'نظام كويكبي ثنائي — جرم رئيسي كبير وقُمَير صغير اسمه ديمورفوس. وقد ارتطمت'
                + ' مركبة DART التابعة لناسا بديمورفوس عمدًا عام 2022، فغيّرت دوره المداري 33 دقيقة،'
                + ' مبرهنةً على إمكان الدفاع الكوكبي.',
        },
        florence: {
            name: '3122 فلورنس',
            description: 'من أكبر الكويكبات المعروفة التي يُحتمل أن تكون خطِرة. وخلال تحليقه عام 2017'
                + ' على بعد 7.1 مليون كم (18.5 ضعف بُعد القمر)، كشف الرادار أن له قُمَيرين — فكان'
                + ' أول نظام كويكبي ثلاثي يُكتشف أثناء تحليق.',
        },
        '1994-pc1': {
            name: '7482 (1994 PC1)',
            description: 'كويكب من مجموعة أبولّو يُحتمل أن يكون خطِرًا، وقد بلغ أقرب اقتراب له من'
                + ' الأرض منذ مئتي عام يوم 18 يناير 2022 — إذ مرّ على بعد 1.93 مليون كم (خمسة أضعاف'
                + ' بُعد القمر). وكان يُرى بالتلسكوبات الهاوية أثناء التحليق.',
        },
        '2023-bu': {
            name: '2023 BU',
            description: 'كويكب صغير مرّ على ارتفاع 3,600 كم فقط فوق سطح الأرض يوم 26 يناير 2023 —'
                + ' أي داخل مدار الأقمار الثابتة بالنسبة للأرض، وكان من أقرب التحليقات المسجَّلة'
                + ' على الإطلاق. ومرّ بسلام دون حادث.',
        },
        vesta: {
            name: 'فيستا',
            description: 'فيستا ثاني أضخم أجرام حزام الكويكبات الرئيسي كتلةً، وأحد الكويكبات القليلة'
                + ' التي بلغت التوازن الهيدروستاتيكي في الماضي. وقد دار حولها مسبار دون التابع لناسا'
                + ' بين 2011 و2012، فكشف عن حوضي ارتطام هائلين عند قطبها الجنوبي — ريّاسيلفيا'
                + ' (عرضها 505 كم) وفينينيا — وعن باطن متمايز معقّد جيولوجيًا.',
        },
        pallas: {
            name: 'بالاس',
            description: 'بالاس ثالث أكبر كويكبات الحزام الرئيسي، ويلفت النظر بميله المداري المرتفع'
                + ' على غير المعتاد، نحو 35° — من الأعلى بين كويكبات الحزام الكبيرة. ويوحي تركيب'
                + ' سطحه الكربوني البدائي بأنه من بقايا النظام الشمسي المبكّر. ويبدو مثقلًا'
                + ' بالفوّهات، وقد صوّره حديثًا التلسكوب الكبير جدًا (VLT) فكشف سطحًا شديد التهشّم.',
        },
        halley: {
            name: 'مذنّب هالي',
            description: 'أشهر المذنّبات الدورية، وله ظهورات مسجَّلة تمتدّ إلى عام 240 ق.م. ونواة هالي'
                + ' جرم داكن غير منتظم الشكل أبعاده نحو 15 × 8 كم — ومن أعتم الأجرام المعروفة في'
                + ' النظام الشمسي. وقد درس ظهوره عام 1986 أسطول دولي من المركبات، منها جيوتو التابعة'
                + ' لوكالة الفضاء الأوروبية، التي صوّرت النواة لأول مرة.',
        },
        iss: {
            name: 'محطة الفضاء الدولية',
            shortName: 'المحطة الدولية',
            description: 'محطة الفضاء الدولية أكبر بنية جُمّعت في الفضاء على الإطلاق، ووجود بشري'
                + ' متواصل في المدار منذ نوفمبر 2000. بنتها وتشغّلها شراكة من خمس وكالات فضاء، وهي'
                + ' مختبر أبحاث في انعدام الجاذبية ومرصد ومنصة اختبار لتقنيات استكشاف الفضاء'
                + ' السحيق. وتُتمّ المحطة نحو 16 دورة حول الأرض كل يوم.',
        },
        tiangong: {
            name: 'محطة تيانغونغ الفضائية',
            description: 'محطة الصين الفضائية الدائمة، جُمّعت في المدار الأرضي المنخفض بدءًا بوحدة'
                + ' تيانخه الأساسية في أبريل 2021. وتيانغونغ ثالث محطة فضائية تستضيف طاقمًا طويل'
                + ' الأمد بعد مير والمحطة الدولية، وصُمّمت لعمر تشغيلي مدته خمس عشرة سنة. وتتكوّن'
                + ' حاليًا من ثلاث وحدات، ويعمل فيها أطقم متعاقبة من ثلاثة روّاد صينيين.',
        },
        mir: {
            name: 'مير',
            description: 'كانت مير أول محطة فضائية معيارية في العالم، جُمّعت في المدار على مدى عقد'
                + ' بدأ عام 1986. واستضافت رحلة رائد الفضاء فاليري بولياكوف القياسية المتواصلة'
                + ' البالغة 437 يومًا، وكانت ميدان التجربة للرحلات البشرية الطويلة. وبعد تفكّك'
                + ' الاتحاد السوفيتي، استضافت مير أولى المهمات الروسية الأمريكية المشتركة ضمن برنامج'
                + ' مكوك-مير، قبل أن تُخرج من المدار عام 2001.',
        },
        hubble: {
            name: 'تلسكوب هابل الفضائي',
            description: 'غيّر تلسكوب هابل الفضائي فهمنا للكون تغييرًا جذريًا منذ إطلاقه عام 1990.'
                + ' وقد صانته أطقم مكوك الفضاء خمس مرات، فحدّد هابل معدل تمدّد الكون، وأكّد وجود ثقوب'
                + ' سوداء فائقة الكتلة في معظم المجرّات الكبيرة، وكشف مشاهد عميقة لآلاف المجرّات في'
                + ' رقع صغيرة من السماء، وأنتج بعضًا من أشهر الصور العلمية في التاريخ.',
        },
        jwst: {
            name: 'تلسكوب جيمس ويب الفضائي',
            description: 'أقوى تلسكوب فضائي صنعته البشرية، يرصد الكون بالأشعة تحت الحمراء من نقطة'
                + ' لاغرانج الثانية بين الشمس والأرض. ومرآته البريليومية المطلية بالذهب، البالغ'
                + ' قطرها 6.5 أمتار والمكوَّنة من ثمانية عشر قطاعًا، ودرعه الشمسي فائق البرودة،'
                + ' تمكّنه من رؤية أولى المجرّات التي تكوّنت بعد الانفجار العظيم، وتصوير أغلفة'
                + ' الكواكب الخارجية، وكشف حضانات نجمية محجوبة عن التلسكوبات البصرية.',
        },
        chandra: {
            name: 'مرصد تشاندرا للأشعة السينية',
            description: 'تشاندرا هو المرصد الفضائي الرائد لناسا في الأشعة السينية، ويدرس بعضًا من'
                + ' أعنف ظواهر الكون طاقةً: الثقوب السوداء والنجوم النيوترونية والمستعرات العظمى'
                + ' وعناقيد المجرّات. ومداره الشديد الاستطالة يحمله ثلث المسافة إلى القمر، فيبقى فوق'
                + ' أحزمة الإشعاع حول الأرض حتى 55 ساعة في الدورة الواحدة. وقد كشف تشاندرا نفّاثات'
                + ' سينية من الكوازارات، وقاس توزّع المادة المظلمة في العناقيد، وصوّر بقايا'
                + ' الانفجارات النجمية.',
        },
        voyager1: {
            name: 'فوياجر 1',
            description: 'فوياجر 1 أبعد جسم صنعه الإنسان عن الأرض، وأول مركبة تدخل الفضاء بين النجمي،'
                + ' إذ عبرت حدّ الغلاف الشمسي في أغسطس 2012. أُطلقت لدراسة الكواكب الخارجية، فأعادت'
                + ' صورًا مبهرة لقمر المشتري البركاني آيو ولقمر زُحل تيتان. وأسطوانتها الذهبية —'
                + ' قرص نحاسي مطلي بالذهب يحمل أصوات الأرض وصورها — هي تحية البشرية لأي حضارة قد'
                + ' تعثر عليها.',
        },
        voyager2: {
            name: 'فوياجر 2',
            description: 'تبقى فوياجر 2 المركبة الوحيدة التي زارت الكواكب الخارجية الأربعة جميعًا —'
                + ' المشتري وزُحل وأورانوس ونبتون. وقد كشف تحليقها قرب نبتون عام 1989 عن البقعة'
                + ' المظلمة العظيمة وعن القمر تريتون النشط بالنافورات. وفي ديسمبر 2018 صارت ثاني جسم'
                + ' صنعه الإنسان يدخل الفضاء بين النجمي، وتبقى المسبار الوحيد الذي قاس البلازما بين'
                + ' النجمية قياسًا مباشرًا في النصف الجنوبي من الغلاف الشمسي.',
        },
        'new-horizons': {
            name: 'نيو هورايزنز',
            description: 'نفّذت نيو هورايزنز أول تحليق قريب من بلوتو يوم 14 يوليو 2015، فكشفت جبالًا'
                + ' من جليد النيتروجين، وحوضًا على شكل قلب من الأجلدة المتطايرة، وعالمًا أنشط مما'
                + ' كان يُظن. ثم حلّقت قرب أروكوث (2014 MU69) يوم 1 يناير 2019 — أبعد جرم في النظام'
                + ' الشمسي وأكثره بدائية بين ما استُكشف — فكشفت جرمًا ثنائيًا متلامسًا تكوّن من'
                + ' فصّين اندمجا برفق في فجر النظام الشمسي.',
        },
        sputnik1: {
            name: 'سبوتنيك 1',
            description: 'كان سبوتنيك 1 أول قمر صناعي في العالم، أطلقه الاتحاد السوفيتي يوم 4 أكتوبر'
                + ' 1957، فأشعل عصر الفضاء وسباق الفضاء. وهو كرة من الألومنيوم المصقول قطرها 58'
                + ' سنتيمترًا، تجرّ أربعة هوائيات لاسلكية، وقد بثّ صفيرًا لاسلكيًا بسيطًا التقطه'
                + ' الهواة في أنحاء العالم. ودار حول الأرض 21 يومًا قبل أن تنفد بطارياته، ثم عاد إلى'
                + ' الغلاف الجوي بعد ثلاثة أشهر.',
        },
    },
};
