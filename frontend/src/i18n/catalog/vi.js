// The catalog in Vietnamese.
//
// The classical bodies have Vietnamese names and take them — Mặt Trời, Sao Kim,
// Sao Hỏa, Mặt Trăng — and so do the deep-sky objects a Vietnamese reader is
// most likely to know: Andromeda is Thiên hà Tiên Nữ, Orion is Lạp Hộ. Moons
// and dwarf planets named in the last two centuries (Titan, Enceladus,
// Makemake) have no Vietnamese name, so they keep the international spelling —
// which is exactly what Vietnamese-language astronomy writing does with them.
//
// Catalogue designations stay in Latin. "TRAPPIST-1e" and "NGC 5195" are
// identifiers, not words: a reader looking one up will type it exactly as it
// is written here.
//
// Numbers keep their English formatting (1,750 and 4.5, not 1.750 and 4,5).
// The stat sweep does not reformat figures, so a value written here in the
// Vietnamese convention would clash with every value on the same page that
// passes through untouched.
//
// `phrases` is swept over every stat value after the counted nouns and the
// dates have been handled — see ../localizeCatalog.js. Order does not matter
// here; the compiler sorts longest-first, so "Radial Velocity" is matched
// before "Velocity" and "S-Type" before "Type".

import { countries } from './countries.vi';

export const vi = {
    intl: 'vi',
    // 240 of them, in their own file — see countries.vi.js. Bundled into this
    // chunk rather than the tracker's, so the lookup stays synchronous.
    countries,
    // "April 13, 2029" reads "13 tháng 4 2029".
    dayFirstDates: true,
    // No `rtl`: Vietnamese is left-to-right, so signed numbers need no bidi
    // isolation.

    categories: {
        stars:               { label: 'Sao',                        description: 'Các thiên thể sao' },
        planets:             { label: 'Hành tinh',                  description: 'Các hành tinh của Hệ Mặt Trời' },
        'dwarf-planets':     { label: 'Hành tinh lùn',              description: 'Sao Diêm Vương và những thế giới tương tự' },
        moons:               { label: 'Vệ tinh',                    description: 'Các vệ tinh tự nhiên' },
        exoplanets:          { label: 'Ngoại hành tinh',            description: 'Các hành tinh ngoài Hệ Mặt Trời' },
        'deep-sky':          { label: 'Bầu trời sâu',               description: 'Thiên hà, tinh vân và cụm sao' },
        neos:                { label: 'Thiên thể gần Trái Đất',     description: 'Các thiên thể bay gần Trái Đất' },
        asteroid:            { label: 'Tiểu hành tinh',             description: 'Vành đai chính và những tiểu hành tinh nổi bật' },
        comet:               { label: 'Sao chổi',                   description: 'Sao chổi tuần hoàn và nổi bật' },
        'space-stations':    { label: 'Trạm vũ trụ',                description: 'Tiền đồn có người ở trên quỹ đạo' },
        'space-telescopes':  { label: 'Kính thiên văn',             description: 'Các đài quan sát trên quỹ đạo' },
        'deep-space-probes': { label: 'Tàu thăm dò không gian sâu', description: 'Giữa các hành tinh và xa hơn nữa' },
        historical:          { label: 'Lịch sử',                    description: 'Những tàu vũ trụ tiên phong' },
    },

    types: {
        'G-Type Main-Sequence Star': 'Sao dãy chính loại G',
        'Terrestrial Planet': 'Hành tinh đất đá',
        'Gas Giant': 'Hành tinh khí khổng lồ',
        'Ice Giant': 'Hành tinh băng khổng lồ',
        'Dwarf Planet': 'Hành tinh lùn',
        'Natural Satellite': 'Vệ tinh tự nhiên',
        'Martian Moon': 'Vệ tinh của Sao Hỏa',
        'Galilean Moon': 'Vệ tinh Galileo',
        'Jovian Moon': 'Vệ tinh của Sao Mộc',
        'Saturnian Moon': 'Vệ tinh của Sao Thổ',
        'Uranian Moon': 'Vệ tinh của Sao Thiên Vương',
        'Neptunian Moon': 'Vệ tinh của Sao Hải Vương',
        'Super-Earth': 'Siêu Trái Đất',
        'Super-Earth Candidate': 'Ứng viên siêu Trái Đất',
        'Hot Jupiter': 'Sao Mộc nóng',
        'Terrestrial Exoplanet': 'Ngoại hành tinh đất đá',
        'Hycean World Candidate': 'Ứng viên thế giới Hycean',
        'Water World Candidate': 'Ứng viên thế giới đại dương',
        'Lava World': 'Thế giới dung nham',
        'Spiral Galaxy': 'Thiên hà xoắn ốc',
        'Interacting Galaxy': 'Thiên hà tương tác',
        'Emission Nebula': 'Tinh vân phát xạ',
        'Planetary Nebula': 'Tinh vân hành tinh',
        'Supernova Remnant': 'Tàn dư siêu tân tinh',
        'Stellar Nursery': 'Vườn ươm sao',
        'S-Type Asteroid': 'Tiểu hành tinh loại S',
        'B-Type Asteroid': 'Tiểu hành tinh loại B',
        'Binary Asteroid System': 'Hệ tiểu hành tinh đôi',
        'Amor Asteroid': 'Tiểu hành tinh nhóm Amor',
        'Apollo Asteroid': 'Tiểu hành tinh nhóm Apollo',
        'Main Belt Asteroid': 'Tiểu hành tinh vành đai chính',
        'Periodic Comet': 'Sao chổi tuần hoàn',
        'Space Station': 'Trạm vũ trụ',
        'Space Telescope': 'Kính viễn vọng không gian',
        'Deep Space Probe': 'Tàu thăm dò không gian sâu',
        'Historical Spacecraft': 'Tàu vũ trụ lịch sử',
    },

    sections: {
        Physical:  'Đặc điểm vật lý',
        Orbital:   'Đặc điểm quỹ đạo',
        General:   'Tổng quan',
        Discovery: 'Khám phá',
        Location:  'Vị trí',
        Hazard:    'Mức nguy hiểm',
        Stellar:   'Đặc điểm sao',
    },

    statLabels: {
        'Actual Diameter': 'Đường kính thực',
        'Active Volcanoes': 'Núi lửa đang hoạt động',
        Age: 'Tuổi',
        Albedo: 'Suất phản chiếu',
        Altitude: 'Độ cao',
        Antenna: 'Ăng-ten',
        Aphelion: 'Điểm viễn nhật',
        Apogee: 'Điểm viễn địa',
        'Apparent Diameter': 'Đường kính biểu kiến',
        'Arrokoth Flyby': 'Bay ngang Arrokoth',
        Atmosphere: 'Khí quyển',
        'Axial Tilt': 'Độ nghiêng trục',
        Catalogued: 'Được lập danh mục',
        'Central Object': 'Thiên thể trung tâm',
        'Central Star': 'Sao trung tâm',
        Classification: 'Phân loại',
        'Closest Approach': 'Lần tiếp cận gần nhất',
        'Cloud Temp': 'Nhiệt độ mây',
        Color: 'Màu sắc',
        Companion: 'Thiên thể đồng hành',
        Composition: 'Thành phần',
        Constellation: 'Chòm sao',
        'Continuous Crew': 'Phi hành đoàn liên tục',
        Coordinates: 'Tọa độ',
        'Core Launch': 'Phóng mô-đun lõi',
        'Core Temperature': 'Nhiệt độ lõi',
        'Crew Capacity': 'Sức chứa phi hành đoàn',
        'Cumulative Risk': 'Rủi ro tích lũy',
        'DART Impact': 'Va chạm DART',
        Decayed: 'Quỹ đạo suy tàn',
        Density: 'Mật độ',
        Deorbited: 'Đã rời quỹ đạo',
        'Design Life': 'Tuổi thọ thiết kế',
        Diameter: 'Đường kính',
        Dimensions: 'Kích thước',
        Direction: 'Chiều',
        Discovery: 'Khám phá',
        'Discovery Year': 'Năm khám phá',
        Distance: 'Khoảng cách',
        'Distance (avg)': 'Khoảng cách (trung bình)',
        'Distance from Earth': 'Khoảng cách đến Trái Đất',
        'Distance from Sun': 'Khoảng cách đến Mặt Trời',
        'ESA Hera Mission': 'Sứ mệnh Hera của ESA',
        Eccentricity: 'Độ lệch tâm',
        'Equatorial Radius': 'Bán kính xích đạo',
        'Equilibrium Temp': 'Nhiệt độ cân bằng',
        'Escape Velocity': 'Vận tốc thoát',
        'Expansion Rate': 'Tốc độ giãn nở',
        'Expected Life': 'Tuổi thọ dự kiến',
        'First Catalogued': 'Lần lập danh mục đầu tiên',
        'First Landing': 'Lần hạ cánh đầu tiên',
        'First Module': 'Mô-đun đầu tiên',
        'First Record': 'Ghi chép đầu tiên',
        Future: 'Tương lai',
        Geysers: 'Mạch phun',
        Habitability: 'Khả năng ở được',
        'Habitable Volume': 'Thể tích sinh hoạt',
        'Halo Orbit': 'Quỹ đạo halo',
        Heliopause: 'Nhật mãn',
        'Host Star': 'Sao chủ',
        'Hubble Image': 'Ảnh Hubble',
        'Ice Shell Depth': 'Độ dày lớp vỏ băng',
        'Impact Risk': 'Rủi ro va chạm',
        'In Habitable Zone': 'Trong vùng ở được',
        Inclination: 'Độ nghiêng quỹ đạo',
        'JWST Atmosphere': 'Khí quyển qua JWST',
        'JWST Image': 'Ảnh JWST',
        'JWST Observation': 'Quan sát của JWST',
        'Jupiter Flyby': 'Bay ngang Sao Mộc',
        'Known Moons': 'Vệ tinh đã biết',
        'Largest Moon': 'Vệ tinh lớn nhất',
        'Last Perihelion': 'Điểm cận nhật gần nhất',
        Launched: 'Phóng',
        Length: 'Chiều dài',
        Location: 'Vị trí',
        'Longest Stay': 'Thời gian lưu trú dài nhất',
        Luminosity: 'Độ trưng',
        'Magnetic Field': 'Từ trường',
        Mass: 'Khối lượng',
        'Max Wind Speed': 'Tốc độ gió tối đa',
        'Mean Diameter': 'Đường kính trung bình',
        'Mean Radius': 'Bán kính trung bình',
        'Merger Timeline': 'Thời điểm hợp nhất',
        'Methane Lakes': 'Hồ mêtan',
        Method: 'Phương pháp khám phá',
        'Min Temp': 'Nhiệt độ tối thiểu',
        'Min. Mass': 'Khối lượng tối thiểu',
        Mirror: 'Gương',
        'Mirror Diameter': 'Đường kính gương',
        Mission: 'Sứ mệnh',
        Modules: 'Mô-đun',
        Moon: 'Vệ tinh',
        'Moonlet Diameter': 'Đường kính vệ tinh nhỏ',
        'Moonlet Period': 'Chu kỳ vệ tinh nhỏ',
        Moons: 'Vệ tinh',
        'Named For': 'Đặt tên theo',
        'Nearest PN': 'Tinh vân hành tinh gần nhất',
        'Neptune Flyby': 'Bay ngang Sao Hải Vương',
        'Next Close App.': 'Lần tiếp cận tới',
        'Next Perihelion': 'Điểm cận nhật kế tiếp',
        Nickname: 'Biệt danh',
        'Nicolas-Claude Fabri': 'Nicolas-Claude Fabri',
        'Nobel Prize': 'Giải Nobel',
        Notable: 'Điểm nổi bật',
        'Notable Feature': 'Đặc điểm nổi bật',
        'Nucleus Size': 'Kích thước nhân',
        'OSIRIS-REx Sample': 'Mẫu vật OSIRIS-REx',
        'Oldest Record': 'Ghi chép cổ nhất',
        Operator: 'Đơn vị vận hành',
        Orbit: 'Quỹ đạo',
        'Orbital Period': 'Chu kỳ quỹ đạo',
        'Orbital Resonance': 'Cộng hưởng quỹ đạo',
        'Orbital Speed': 'Tốc độ quỹ đạo',
        Orbits: 'Số vòng quỹ đạo',
        Origin: 'Nguồn gốc',
        Outgassing: 'Thoát khí',
        'Parent Body': 'Thiên thể mẹ',
        'Parent Nebula': 'Tinh vân mẹ',
        'Peak Year': 'Năm cực đại',
        Perigee: 'Điểm cận địa',
        Perihelion: 'Điểm cận nhật',
        Period: 'Chu kỳ',
        'Period Change': 'Thay đổi chu kỳ',
        'Pillar Height': 'Chiều cao các cột',
        Planets: 'Hành tinh',
        'Planned Deorbit': 'Kế hoạch rời quỹ đạo',
        'Pluto Flyby': 'Bay ngang Sao Diêm Vương',
        Position: 'Vị trí',
        'Power Source': 'Nguồn năng lượng',
        'Primary Diameter': 'Đường kính thiên thể chính',
        'Primary Type': 'Loại thiên thể chính',
        'Proplyds Detected': 'Đĩa tiền hành tinh phát hiện được',
        'Pulsar Period': 'Chu kỳ pulsar',
        Radius: 'Bán kính',
        Region: 'Khu vực',
        Resolution: 'Độ phân giải',
        'Ring Span': 'Bề rộng vành đai',
        'Ring System': 'Hệ vành đai',
        Rings: 'Vành đai',
        'Rotation Period': 'Chu kỳ tự quay',
        'Saturn Flyby': 'Bay ngang Sao Thổ',
        'Science Ops': 'Bắt đầu hoạt động khoa học',
        'Semi-major Axis': 'Bán trục lớn',
        'Servicing Missions': 'Sứ mệnh bảo dưỡng',
        'Signal Active': 'Tín hiệu còn hoạt động',
        Size: 'Kích thước',
        'Solar Arrays': 'Dàn pin mặt trời',
        Spacecraft: 'Tàu vũ trụ',
        'Spectral Class': 'Lớp quang phổ',
        Speed: 'Tốc độ',
        'Speed at Launch': 'Tốc độ khi phóng',
        'Spiral ID': 'Phân loại xoắn ốc',
        'Star Formation': 'Sự hình thành sao',
        Stars: 'Sao',
        Structure: 'Cấu trúc',
        Sunshield: 'Tấm chắn nắng',
        'Supernova Date': 'Ngày siêu tân tinh',
        Surface: 'Bề mặt',
        'Surface Age': 'Tuổi bề mặt',
        'Surface Gravity': 'Trọng lực bề mặt',
        'Surface Temp': 'Nhiệt độ bề mặt',
        System: 'Hệ',
        'System Distance': 'Khoảng cách của hệ',
        Temperature: 'Nhiệt độ',
        'Tidal Lock': 'Khóa thủy triều',
        'Torino Scale': 'Thang Torino',
        'Total Visits': 'Tổng số lượt ghé thăm',
        'Transit Duration': 'Thời gian quá cảnh',
        Transmitters: 'Máy phát',
        Type: 'Loại',
        'Uranus Flyby': 'Bay ngang Sao Thiên Vương',
        'Visual Magnitude': 'Cấp sao biểu kiến',
        Wavelength: 'Bước sóng',
        Wavelengths: 'Các bước sóng',
        '2017 Flyby': 'Bay ngang năm 2017',
        '2022 Flyby': 'Bay ngang năm 2022',
        '2029 Flyby': 'Bay ngang năm 2029',
        'Launch Year': 'Năm phóng',
        Operational: 'Đang vận hành',
        Status: 'Trạng thái',
    },

    // Names the 3D scene uses that differ from the catalog's.
    bodies: {
        Moon: 'Mặt Trăng',
        ISS: 'Trạm Quốc tế',
        // The satellite tracker names its craft by short name, and those are
        // not the catalog's names.
        Tiangong: 'Thiên Cung',
        Chandra: 'Chandra',
        Hubble: 'Hubble',
    },

    assets: {
        'The Milky Way': 'Ngân Hà',
        "Saturn's rings": 'Vành đai Sao Thổ',
        'Earth at night': 'Trái Đất về đêm',
        "Earth's clouds": 'Mây của Trái Đất',
        Sun: 'Mặt Trời',
        Mercury: 'Sao Thủy',
        Venus: 'Sao Kim',
        Earth: 'Trái Đất',
        Mars: 'Sao Hỏa',
        Jupiter: 'Sao Mộc',
        Saturn: 'Sao Thổ',
        Uranus: 'Sao Thiên Vương',
        Neptune: 'Sao Hải Vương',
        Moon: 'Mặt Trăng',
        Iss: 'Trạm Vũ trụ Quốc tế',
        Vesta: 'Vesta',
        Bennu: 'Bennu',
        Geographos: 'Geographos',
        Mithra: 'Mithra',
        Golevka: 'Golevka',
    },

    // Vietnamese has no grammatical plural, so a counted noun is one word
    // whatever the number in front of it. selectPlural returns a plain string
    // as-is.
    counted: {
        day: 'ngày',
        year: 'năm',
        hour: 'giờ',
        minute: 'phút',
        month: 'tháng',
        week: 'tuần',
        'light-year': 'năm ánh sáng',
    },

    phrases: {
        // ── Units ──
        ly: 'năm ánh sáng',
        ms: 'mili giây',
        min: 'phút',
        h: 'giờ',
        yr: 'năm',
        arcseconds: 'giây cung',
        BC: 'TCN',
        AD: 'SCN',
        MJup: 'khối lượng Sao Mộc',
        RJup: 'bán kính Sao Mộc',

        // ── Recurring qualifiers ──
        avg: 'trung bình',
        'est.': 'ước tính',
        equator: 'xích đạo',
        photosphere: 'quang quyển',
        'cloud tops': 'đỉnh mây',
        retrograde: 'nghịch hành',
        synchronous: 'đồng bộ',
        reference: 'tham chiếu',
        operational: 'vận hành',
        'very dark': 'rất tối',
        'very bright': 'rất sáng',
        'highly eccentric': 'lệch tâm cao',
        extreme: 'cực đoan',
        puffy: 'phồng',
        'water-rich': 'giàu nước',
        'ionized gas': 'khí ion hóa',
        'no hazard': 'không nguy hiểm',
        'coldest known': 'lạnh nhất từng biết',
        'main truss': 'giàn chính',
        'first description': 'mô tả đầu tiên',
        'first spiral': 'thiên hà xoắn ốc đầu tiên',
        'fastest at launch': 'nhanh nhất khi phóng',
        'post-DART': 'sau va chạm DART',
        'deflection proven': 'đã chứng minh việc làm chệch hướng',
        'still active': 'vẫn hoạt động',
        'before reentry': 'trước khi hồi quyển',
        returned: 'đã đưa về',
        launch: 'phóng',
        radioisotope: 'đồng vị phóng xạ',
        'high-gain dish': 'chảo thu phát độ lợi cao',
        'main primary': 'gương chính',
        primary: 'gương chính',
        segments: 'phân đoạn',
        layers: 'lớp',
        'deployable wings': 'cánh triển khai',
        pressurized: 'điều áp',
        'nested pairs of grazing-incidence': 'các cặp gương lồng nhau kiểu tới sát',
        'long-duration expeditions': 'chuyến thám hiểm dài ngày',
        taikonauts: 'phi hành gia Trung Quốc',
        astronauts: 'phi hành gia',
        crew: 'phi hành đoàn',
        wide: 'rộng',
        high: 'cao',
        radius: 'bán kính',
        known: 'đã biết',
        named: 'được đặt tên',
        faint: 'mờ',
        rings: 'vành đai',
        discovered: 'được phát hiện',
        detected: 'được phát hiện',
        tentative: 'sơ bộ',
        transit: 'quá cảnh',
        'radial vel.': 'vận tốc xuyên tâm',
        'Radial Velocity': 'Vận tốc xuyên tâm',
        Transit: 'Quá cảnh',
        'Transit Photometry': 'Trắc quang quá cảnh',
        million: 'triệu',
        billion: 'tỷ',
        trillion: 'nghìn tỷ',
        to: 'đến',
        and: 'và',
        with: 'với',
        from: 'từ',
        of: 'của',
        via: 'qua',
        live: 'trực tiếp',
        below: 'bên dưới',
        sec: 'giây',
        first: 'đầu tiên',
        Since: 'Từ',
        // Planet names as a stat value — a moon's "Parent Body", say. The 3D
        // scene routes its labels through bodyName instead; this is for the
        // catalog text. "Hot Jupiter" and "Sub-Neptune" are longer and match
        // first.
        Mars: 'Sao Hỏa',
        Jupiter: 'Sao Mộc',
        Saturn: 'Sao Thổ',
        Uranus: 'Sao Thiên Vương',
        Neptune: 'Sao Hải Vương',
        Russia: 'Nga',
        'inside Venus orbit': 'bên trong quỹ đạo Sao Kim',
        'beyond Neptune': 'ngoài Sao Hải Vương',
        'Below geostationary orbit': 'Dưới quỹ đạo địa tĩnh',
        'Interstellar space': 'Không gian liên sao',
        Interstellar: 'Liên sao',
        'Kuiper Belt region': 'Vùng vành đai Kuiper',
        'Kuiper Belt': 'Vành đai Kuiper',
        'Main Asteroid Belt': 'Vành đai tiểu hành tinh chính',
        'Asteroid Belt': 'Vành đai tiểu hành tinh',
        'Captured Kuiper Belt object': 'Thiên thể vành đai Kuiper bị bắt giữ',
        'Likely captured asteroid': 'Có thể là tiểu hành tinh bị bắt giữ',
        Crossed: 'Vượt qua vào',
        Prehistoric: 'Thời tiền sử',
        'Rubble pile': 'Đống đá vụn',
        Binary: 'Đôi',
        'Active near perihelion': 'Hoạt động gần điểm cận nhật',
        Active: 'Đang hoạt động',
        Likely: 'Có khả năng',
        Yes: 'Có',
        No: 'Không',
        None: 'Không có',
        Unknown: 'Chưa rõ',
        Negligible: 'Không đáng kể',
        'High potential': 'Tiềm năng cao',
        'Possible Mars impact': 'Có thể va chạm Sao Hỏa',
        'Potentially Hazardous (PHA)': 'Có khả năng gây nguy hiểm (PHA)',
        'Apollo Asteroid': 'Tiểu hành tinh nhóm Apollo',
        'Amor Asteroid': 'Tiểu hành tinh nhóm Amor',
        'S-Type': 'Loại S',
        'B-Type': 'Loại B',
        'V-Type': 'Loại V',
        stony: 'đá',
        carbonaceous: 'chứa cacbon',
        'primitive carbonaceous': 'chứa cacbon nguyên thủy',
        basaltic: 'bazan',
        'Ice, dust, organics': 'Băng, bụi, hợp chất hữu cơ',
        'Hydrogen and helium': 'Hydro và heli',
        Dense: 'Đậm đặc',
        ices: 'băng',
        'Ancient / heavily cratered': 'Cổ xưa / dày đặc hố va chạm',
        'heavily cratered': 'dày đặc hố va chạm',
        'Most heavily cratered Galilean moon': 'Vệ tinh Galileo nhiều hố va chạm nhất',
        'Most eccentric known moon orbit': 'Quỹ đạo vệ tinh lệch tâm nhất từng biết',
        'Highest inclination major asteroid': 'Tiểu hành tinh lớn có độ nghiêng quỹ đạo cao nhất',
        'Brightest Uranian moon': 'Vệ tinh sáng nhất của Sao Thiên Vương',
        'Darkest Uranian major moon': 'Vệ tinh lớn tối nhất của Sao Thiên Vương',
        'Largest moon of Uranus': 'Vệ tinh lớn nhất của Sao Thiên Vương',
        'Outermost major Uranian moon': 'Vệ tinh lớn ngoài cùng của Sao Thiên Vương',
        'Deep red': 'Đỏ thẫm',
        'sulfur from Io': 'lưu huỳnh từ Io',
        crater: 'hố va chạm',
        'valley system': 'hệ thung lũng',
        'Evaporating Gaseous Globules': 'Các cầu khí đang bốc hơi',
        'Eagle Nebula': 'Tinh vân Đại Bàng',
        Nebula: 'Tinh vân',
        'Emission Nebula': 'Tinh vân phát xạ',
        'H II Region': 'Vùng H II',
        Pulsar: 'Pulsar',
        Spiral: 'Xoắn ốc',
        'Trapezium Cluster': 'Cụm Trapezium',
        'protoplanetary disks': 'đĩa tiền hành tinh',
        'Sun-like': 'giống Mặt Trời',
        'Earth-like': 'giống Trái Đất',
        'Lava World': 'Thế giới dung nham',
        'Super-Earth': 'Siêu Trái Đất',
        'Sub-Neptune': 'Cận Sao Hải Vương',
        'Hot Jupiter': 'Sao Mộc nóng',
        'Scattered Disc Object': 'Thiên thể đĩa phân tán',
        'White dwarf': 'Sao lùn trắng',
        Osiris: 'Osiris',
        Hycean: 'Hycean',
        confirmed: 'đã xác nhận',
        intrinsic: 'nội tại',
        candidate: 'ứng viên',
        optimistic: 'lạc quan',
        interacting: 'tương tác',
        complete: 'hoàn chỉnh',
        'inner edge': 'rìa trong',
        'before flyby': 'trước khi bay ngang',
        'X-ray': 'tia X',
        keV: 'keV',
        'Near-IR to mid-IR': 'Cận hồng ngoại đến trung hồng ngoại',
        'Volatile outgassing': 'Thoát khí dễ bay hơi',
        'MEarth Project': 'Dự án MEarth',

        // ── Constellations ──
        Andromeda: 'Tiên Nữ',
        Aquarius: 'Bảo Bình',
        'Canes Venatici': 'Lạp Khuyển',
        Orion: 'Lạp Hộ',
        Taurus: 'Kim Ngưu',
        Serpens: 'Cự Xà',
        Ophiuchus: 'Xà Phu',
        Telescopium: 'Kính Viễn Vọng',

        // ── Organisations ──
        ESA: 'Cơ quan Vũ trụ châu Âu',
        CSA: 'Cơ quan Vũ trụ Canada',
        'CNSA (China National Space Administration)': 'Cục Vũ trụ Quốc gia Trung Quốc (CNSA)',
        CNSA: 'Cục Vũ trụ Quốc gia Trung Quốc',
        'Jet Propulsion Laboratory': 'Phòng thí nghiệm Sức đẩy Phản lực',
        'Johns Hopkins APL': 'Phòng thí nghiệm Vật lý Ứng dụng Johns Hopkins',
        'Smithsonian CfA operations': 'do Trung tâm Vật lý Thiên văn Smithsonian vận hành',
        'Soviet Union': 'Liên Xô',
        'OKB-1': 'Cục Thiết kế OKB-1',

        // ── People and craft named in the data ──
        Luna: 'Mặt Trăng',
        'Chinese chronicles': 'biên niên sử Trung Quốc',
        Tianhe: 'Thiên Hòa',
        Wentian: 'Vấn Thiên',
        Mengtian: 'Mộng Thiên',
        Earth: 'Trái Đất',
        Sun: 'Mặt Trời',

        // ── Months ──
        January: 'tháng 1', February: 'tháng 2', March: 'tháng 3', April: 'tháng 4',
        May: 'tháng 5', June: 'tháng 6', July: 'tháng 7', August: 'tháng 8',
        September: 'tháng 9', October: 'tháng 10', November: 'tháng 11', December: 'tháng 12',
        Jan: 'tháng 1', Feb: 'tháng 2', Mar: 'tháng 3', Apr: 'tháng 4',
        Jun: 'tháng 6', Jul: 'tháng 7', Aug: 'tháng 8',
        Sept: 'tháng 9', Sep: 'tháng 9', Oct: 'tháng 10', Nov: 'tháng 11', Dec: 'tháng 12',
    },

    // Values the sweep cannot get right on its own, because they are sentences
    // rather than a number and a unit.
    exact: {
        'None': 'Không có',
        'None known': 'Không có thông tin',
        'None detected': 'Không phát hiện được',
        'None in foreseeable future': 'Không có trong tương lai gần',
        'Unknown': 'Chưa rõ',
        'Yes': 'Có',
        'No': 'Không',
        'Likely': 'Có khả năng',
        '0 (no hazard)': '0 (không nguy hiểm)',
        '1 in 1,750 through 2300': '1 trên 1,750 cho đến năm 2300',
        '2182 (1 in 2,700)': '2182 (1 trên 2,700)',
        'Negligible (100+ yr)': 'Không đáng kể (hơn 100 năm)',
        '1 (Luna)': '1 (Mặt Trăng)',
        '2 (Phobos, Deimos)': '2 (Phobos, Deimos)',
        '2 (Hiʻiaka, Namaka)': '2 (Hiʻiaka, Namaka)',
        '2 (discovered 2017)': '2 (phát hiện năm 2017)',
        '3 (Tianhe, Wentian, Mengtian)': '3 (Thiên Hòa, Vấn Thiên, Mộng Thiên)',
        '3 taikonauts': '3 phi hành gia Trung Quốc',
        '7 astronauts': '7 phi hành gia',
        '7 pressurized': '7 mô-đun điều áp',
        '146 known': '146 đã biết',
        '95 known': '95 đã biết',
        '28 known': '28 đã biết',
        '16 known': '16 đã biết',
        '13 known rings': '13 vành đai đã biết',
        '5 named rings': '5 vành đai được đặt tên',
        '4 faint rings': '4 vành đai mờ',
        '~160 billion': '~160 tỷ',
        '~Earth-like': '~giống Trái Đất',
        'Prehistoric': 'Thời tiền sử',
        'Interstellar space': 'Không gian liên sao',
        'Rubble pile': 'Đống đá vụn',
        'Binary': 'Đôi',
        'Active': 'Đang hoạt động',
        'Decayed': 'Quỹ đạo đã suy tàn',
        'Deorbited': 'Đã rời quỹ đạo',
        'Radial Velocity': 'Vận tốc xuyên tâm',
        'Transit': 'Quá cảnh',
        'Transit Photometry': 'Trắc quang quá cảnh',
        '1:2:4 with Europa, Ganymede': '1:2:4 với Europa, Ganymede',
        '4:2:1 with Europa, Io': '4:2:1 với Europa, Io',
        'Ice, dust, organics': 'Băng, bụi, hợp chất hữu cơ',
        'Hydrogen and helium': 'Hydro và heli',
        'Dense N₂, CH₄': 'N₂, CH₄ đậm đặc',
        'H₂, CO₂, CH₄ detected': 'Phát hiện H₂, CO₂, CH₄',
        'H₂O, CH₄, NH₃ ices': 'Băng H₂O, CH₄, NH₃',
        '95.3% CO₂': '95.3% CO₂',
        '96.5% CO₂': '96.5% CO₂',
        '2 (20 MHz and 40 MHz)': '2 (20 MHz và 40 MHz)',
        '1 × RTG': '1 × RTG',
        '3 × RTG (radioisotope)': '3 × RTG (đồng vị phóng xạ)',
        '6 deployable wings': '6 cánh triển khai',
        '2.4 m primary': 'gương chính 2.4 m',
        '6.5 m (18 segments)': '6.5 m (18 phân đoạn)',
        '21 × 14 m (5 layers)': '21 × 14 m (5 lớp)',
        '4 nested pairs of grazing-incidence': '4 cặp gương lồng nhau kiểu tới sát',
        '109 m (main truss)': '109 m (giàn chính)',
        '58 cm': '58 cm',
        '5 (SM1–SM4, 1993–2009)': '5 (SM1–SM4, 1993–2009)',
        '28 long-duration expeditions': '28 chuyến thám hiểm dài ngày',
        '437 days (Polyakov, 1995)': '437 ngày (Polyakov, 1995)',
        '10+ years (fuel for 20+)': 'hơn 10 năm (nhiên liệu đủ cho hơn 20)',
        '5 years (still active 25+ years)': '5 năm (vẫn hoạt động hơn 25 năm)',
        '1,440 before reentry': '1,440 vòng trước khi hồi quyển',
        '60 g (returned Sept 2023)': '60 g (đưa về tháng 9 năm 2023)',
        '478 kg (launch)': '478 kg (khi phóng)',
        '733 kg (launch)': '733 kg (khi phóng)',
        '687 kg/m³ (< water)': '687 kg/m³ (< nước)',
        '~800,000 km radius': 'bán kính ~800,000 km',
        '11.92 h → 11.37 h (post-DART)': '11.92 h → 11.37 h (sau va chạm DART)',
        '−33 minutes (deflection proven)': '−33 phút (đã chứng minh việc làm chệch hướng)',
        '~15 km/s (55,000 km/h)': '~15 km/s (55,000 km/h)',
        '~17 km/s (61,000 km/h)': '~17 km/s (61,000 km/h)',
        '16.26 km/s (fastest at launch)': '16.26 km/s (nhanh nhất khi phóng)',
        '57+ AU (live via JPL below)': 'hơn 57 AU (trực tiếp qua JPL bên dưới)',
        '~160 AU (live via JPL below)': '~160 AU (trực tiếp qua JPL bên dưới)',
        '~2.5° (5 full moons)': '~2.5° (rộng bằng 5 lần trăng tròn)',
        '0.5 arcseconds': '0.5 giây cung',
        '33.5 ms (30/sec)': '33.5 ms (30 vòng/giây)',
        '~160 protoplanetary disks': '~160 đĩa tiền hành tinh',
        'Active — EGGs detected': 'Đang hoạt động — phát hiện EGG',
        'Active (Trapezium Cluster)': 'Đang hoạt động (Cụm Trapezium)',
        'Eagle Nebula (M16 / NGC 6611)': 'Tinh vân Đại Bàng (M16 / NGC 6611)',
        'Eagle Nebula (M16)': 'Tinh vân Đại Bàng (M16)',
        'H II Region / Emission Nebula': 'Vùng H II / Tinh vân phát xạ',
        'Pulsar (PSR B0531+21)': 'Pulsar (PSR B0531+21)',
        'MK 2 (S/2015 (136472) 1)': 'MK 2 (S/2015 (136472) 1)',
        'Herschel crater (139 km wide)': 'Hố va chạm Herschel (rộng 139 km)',
        'Pharos crater ~230 km wide': 'Hố va chạm Pharos rộng ~230 km',
        'Ithaca Chasma valley system': 'Hệ thung lũng Ithaca Chasma',
        'Most heavily cratered Galilean moon': 'Vệ tinh Galileo nhiều hố va chạm nhất',
        'Most eccentric known moon orbit': 'Quỹ đạo vệ tinh lệch tâm nhất từng biết',
        'Highest inclination major asteroid': 'Tiểu hành tinh lớn có độ nghiêng quỹ đạo cao nhất',
        'Ancient / heavily cratered': 'Cổ xưa / dày đặc hố va chạm',
        'Deep red (sulfur from Io)': 'Đỏ thẫm (lưu huỳnh từ Io)',
        'Below geostationary orbit': 'Dưới quỹ đạo địa tĩnh',
        'Potentially Hazardous (PHA)': 'Có khả năng gây nguy hiểm (PHA)',
        'High potential': 'Tiềm năng cao',
        'Possible Mars impact': 'Có thể va chạm Sao Hỏa',
        'ESA Ramses (2029)': 'Sứ mệnh Ramses của ESA (2029)',
        'Launched Oct 2024, arrives 2026': 'Phóng tháng 10 năm 2024, đến nơi năm 2026',
        'Mayor & Queloz (2019)': 'Mayor & Queloz (2019)',
        '1999 (radial vel.) / 2000 (transit)': '1999 (vận tốc xuyên tâm) / 2000 (quá cảnh)',
        '2023 (DMS tentative)': '2023 (phát hiện sơ bộ DMS)',
        'NASA / Jet Propulsion Laboratory': 'NASA / Phòng thí nghiệm Sức đẩy Phản lực',
        'NASA / Johns Hopkins APL': 'NASA / Phòng thí nghiệm Vật lý Ứng dụng Johns Hopkins',
        'NASA (Smithsonian CfA operations)': 'NASA (do Trung tâm Vật lý Thiên văn Smithsonian vận hành)',
        'NASA / Roscosmos / ESA / JAXA / CSA': 'NASA / Roscosmos / ESA / JAXA / CSA',
        'CNSA (China National Space Administration)': 'CNSA (Cục Vũ trụ Quốc gia Trung Quốc)',
        'Near-IR to mid-IR (0.6–28 μm)': 'Cận hồng ngoại đến trung hồng ngoại (0.6–28 μm)',
        '240 BC (Chinese chronicles)': '240 TCN (biên niên sử Trung Quốc)',
        '964 AD (Abd al-Rahman)': 'Năm 964 (Abd al-Rahman al-Sufi)',
        'July 4, 1054 AD': 'Ngày 4 tháng 7 năm 1054',
        'Edmond Halley (1705 prediction)': 'Edmond Halley (dự đoán năm 1705)',
        '~Jul 28, 2061': '~28 tháng 7 năm 2061',
        'Crossed August 2012': 'Vượt qua vào tháng 8 năm 2012',
        'Crossed December 2018': 'Vượt qua vào tháng 12 năm 2018',
        '1.93M km (Jan 18, 2022)': '1.93 triệu km (18 tháng 1 năm 2022)',
        '7.06M km (Sept 1, 2017)': '7.06 triệu km (1 tháng 9 năm 2017)',
        '3,600 km (Jan 26, 2023)': '3,600 km (26 tháng 1 năm 2023)',
        '32,000 km (Apr 13, 2029)': '32,000 km (13 tháng 4 năm 2029)',
        '408 km LEO': '408 km LEO',
        '547 km LEO': '547 km LEO',
        '390 km LEO': '390 km LEO',
        '~390 km LEO': '~390 km LEO',
        '354–374 km (operational)': '354–374 km (quỹ đạo vận hành)',
        'L2 Lagrange Point': 'Điểm Lagrange L2',
        'Highly elliptical: 9,942–140,000 km': 'Quỹ đạo rất dẹt: 9,942–140,000 km',
        'Interstellar Space': 'Không gian liên sao',
        'Interstellar space, ~160+ AU from Sun': 'Không gian liên sao, ~160+ AU từ Mặt Trời',
        'Interstellar space, ~130+ AU from Sun': 'Không gian liên sao, ~130+ AU từ Mặt Trời',
        'Kuiper Belt Region': 'Vùng vành đai Kuiper',
        'Kuiper Belt, 57+ AU from Sun': 'Vành đai Kuiper, cách Mặt Trời hơn 57 AU',
        'Sun–Earth L2, 1.5 million km': 'Điểm L2 Mặt Trời–Trái Đất, 1.5 triệu km',
        '~130 AU (live via JPL below)': '~130 AU (trực tiếp qua JPL bên dưới)',
        '~780 m (main)': '~780 m (thiên thể chính)',
        '2.537 Mly': '2.537 triệu năm ánh sáng',
        '31 Mly': '31 triệu năm ánh sáng',
        'Deorbited March 23, 2001': 'Rời quỹ đạo ngày 23 tháng 3 năm 2001',
        'Decayed January 4, 1958': 'Quỹ đạo suy tàn ngày 4 tháng 1 năm 1958',
        'CNSA (China)': 'CNSA (Trung Quốc)',
        'Soviet Union / Russia': 'Liên Xô / Nga',
        'Apr 13, 2029': '13 tháng 4 năm 2029',
        'Jan 18, 2022': '18 tháng 1 năm 2022',
        'Sept 1, 2017': '1 tháng 9 năm 2017',
        'Sept 25, 2135': '25 tháng 9 năm 2135',
        'Sept 26, 2022 (DART)': '26 tháng 9 năm 2022 (DART)',
        '~Jul 2061': '~tháng 7 năm 2061',
        '3,600 km (Jan 2023)': '3,600 km (tháng 1 năm 2023)',
        'July 20, 1969 (Apollo 11)': 'Ngày 20 tháng 7 năm 1969 (Apollo 11)',
        'April 29, 2021 (Tianhe)': 'Ngày 29 tháng 4 năm 2021 (Thiên Hòa)',
        'July 12, 2022 (first images)': 'Ngày 12 tháng 7 năm 2022 (những hình ảnh đầu tiên)',
        '1845 (Rosse) — first spiral': '1845 (Rosse) — thiên hà xoắn ốc đầu tiên được nhận ra',
        '1989 (Voyager 2)': '1989 (Voyager 2)',
        'Dawn (2011–2012)': 'Tàu Dawn (2011–2012)',
        'Dawn (2015–2018)': 'Tàu Dawn (2015–2018)',
        '2005 (Brown, Trujillo, Rabinowitz)': '2005 (Brown, Trujillo, Rabinowitz)',
        '2004 (Brown / Ortiz)': '2004 (Brown / Ortiz)',
        '1 (Dysnomia)': '1 (Dysnomia)',
        'Dysnomia': 'Dysnomia',
        '~150 m (Dimorphos)': '~150 m (Dimorphos)',
        '~370 m (0.37 km)': '~370 m (0.37 km)',
        '51 Pegasi (G2IV)': '51 Pegasi (G2IV)',
        '55 Cancri A (G8V)': '55 Cancri A (G8V)',
        'Kepler-22 (G5V, Sun-like)': 'Kepler-22 (G5V, giống Mặt Trời)',
        'Proxima Centauri (M5.5Ve)': 'Proxima Centauri (M5.5Ve)',
        'GJ 1214 (M4.5V)': 'GJ 1214 (M4.5V)',
        'HD 209458 (G0V)': 'HD 209458 (G0V)',
        'Osiris': 'Osiris',
        'Lava World / Super-Earth': 'Thế giới dung nham / Siêu Trái Đất',
        'Hot Jupiter': 'Sao Mộc nóng',
        'S-Type': 'Loại S',
        'S-Type (stony)': 'Loại S (đá)',
        'B-Type (carbonaceous)': 'Loại B (chứa cacbon)',
        'B-Type (primitive carbonaceous)': 'Loại B (chứa cacbon nguyên thủy)',
        'Apollo Asteroid': 'Tiểu hành tinh nhóm Apollo',
        'Apollo Asteroid (small)': 'Tiểu hành tinh nhóm Apollo (nhỏ)',
        'Amor Asteroid': 'Tiểu hành tinh nhóm Amor',
        'Main Asteroid Belt': 'Vành đai tiểu hành tinh chính',
        'Kuiper Belt region': 'Vùng vành đai Kuiper',
        'Captured Kuiper Belt object': 'Thiên thể vành đai Kuiper bị bắt giữ',
        'Likely captured asteroid': 'Có thể là tiểu hành tinh bị bắt giữ',
        'Brightest Uranian moon': 'Vệ tinh sáng nhất của Sao Thiên Vương',
        'Darkest Uranian major moon': 'Vệ tinh lớn tối nhất của Sao Thiên Vương',
        'Largest moon of Uranus': 'Vệ tinh lớn nhất của Sao Thiên Vương',
        'Outermost major Uranian moon': 'Vệ tinh lớn ngoài cùng của Sao Thiên Vương',
        'M1 / NGC 1952': 'M1 / NGC 1952',
        'M31 / NGC 224': 'M31 / NGC 224',
        'M42 / NGC 1976': 'M42 / NGC 1976',
        'M51 / NGC 5194': 'M51 / NGC 5194',
        'NGC 5195': 'NGC 5195',
        'NGC 7293': 'NGC 7293',
        'SA(s)b Spiral': 'Xoắn ốc SA(s)b',
        'Andromeda': 'Tiên Nữ',
        'Aquarius': 'Bảo Bình',
        'Canes Venatici': 'Lạp Khuyển',
        'Orion': 'Lạp Hộ',
        '~4.5 billion years': '~4.5 tỷ năm',
        '4.6 billion years': '4.6 tỷ năm',
        '~15 million K': '~15 triệu K',
        '5,778 K (photosphere)': '5,778 K (quang quyển)',
        '10,000 K (ionized gas)': '10,000 K (khí ion hóa)',
        '~25 days (equator)': '~25 ngày (xích đạo)',
        '243.02 days (retrograde)': '243.02 ngày (nghịch hành)',
        '27.32 days (synchronous)': '27.32 ngày (đồng bộ)',
        '0.7365 days (17.7 h)': '0.7365 ngày (17.7 giờ)',
        '0.00° (reference)': '0.00° (tham chiếu)',
        '2.537 million ly': '2.537 triệu năm ánh sáng',
        '~220,000 light-years': '~220,000 năm ánh sáng',
        '~76,000 light-years': '~76,000 năm ánh sáng',
        '31 million light-years': '31 triệu năm ánh sáng',
        '~6,500 light-years': '~6,500 năm ánh sáng',
        '4–5 light-years': '4–5 năm ánh sáng',
        '~3 light-years': '~3 năm ánh sáng',
        '~24 light-years': '~24 năm ánh sáng',
        'Thin N₂, trace CH₄': 'N₂ mỏng, vết CH₄',
        'Thin O₂ and CO₂': 'O₂ và CO₂ mỏng',
        'Trace oxygen detected': 'Phát hiện vết oxy',
        'Two-tone dark/bright hemispheres': 'Hai bán cầu sáng/tối tương phản',
        'Verona Rupes — 20 km cliff': 'Verona Rupes — vách đá cao 20 km',
        'Yes (confirmed 2017)': 'Có (xác nhận năm 2017)',
        'Yes (intrinsic)': 'Có (nội tại)',
        'Yes (inner edge)': 'Có (rìa trong)',
        'Yes (optimistic)': 'Có (theo ước tính lạc quan)',
        'Yes (to Earth)': 'Có (hướng về Trái Đất)',
        'Super-Earth candidate': 'Ứng viên siêu Trái Đất',
        'Super-Earth / Sub-Neptune': 'Siêu Trái Đất / Cận Sao Hải Vương',
        'Sub-Neptune / Hycean candidate': 'Cận Sao Hải Vương / ứng viên Hycean',
        'Transit (Kepler)': 'Quá cảnh (Kepler)',
        'Transit (Spitzer)': 'Quá cảnh (Spitzer)',
        'Transit (MEarth Project)': 'Quá cảnh (Dự án MEarth)',
        'TRAPPIST-1 (M8V)': 'TRAPPIST-1 (M8V)',
        'Volatile outgassing (2024)': 'Thoát khí dễ bay hơi (2024)',
        '~1 trillion': '~1 nghìn tỷ',
        'SAbc Spiral (interacting)': 'Xoắn ốc SAbc (tương tác)',
        'White dwarf (AG7)': 'Sao lùn trắng (AG7)',
        '4 days before flyby': '4 ngày trước khi bay ngang',
        'Zarya — Nov 20, 1998': 'Zarya — 20 tháng 11 năm 1998',
        'Since Nov 2, 2000': 'Từ ngày 2 tháng 11 năm 2000',
        '~100,000 kg (complete)': '~100,000 kg (khi hoàn chỉnh)',
        'UV, visible, near-IR': 'Tử ngoại, khả kiến, cận hồng ngoại',
        'Through 2030s': 'Đến thập niên 2030',
        'Sun–Earth L2 Lagrange Point': 'Điểm Lagrange L2 Mặt Trời–Trái Đất',
        '~1.5 million km from Earth': '~1.5 triệu km từ Trái Đất',
        'X-ray (0.1–10 keV)': 'Tia X (0.1–10 keV)',
        'Toward Ophiuchus constellation': 'Hướng về chòm sao Xà Phu',
        'Toward Telescopium constellation': 'Hướng về chòm sao Kính Viễn Vọng',
        'Soviet Union (OKB-1 / Korolev)': 'Liên Xô (OKB-1 / Korolev)',
        'V-Type (basaltic)': 'Loại V (bazan)',
    },

    objects: {
        sun: {
            name: 'Mặt Trời',
            description: 'Mặt Trời là ngôi sao ở trung tâm Hệ Mặt Trời và là nguồn của gần như'
                + ' toàn bộ năng lượng chi phối sự sống và thời tiết trên Trái Đất. Lực hấp dẫn'
                + ' của nó giữ các hành tinh trên quỹ đạo, còn phản ứng nhiệt hạch trong lõi cung'
                + ' cấp ánh sáng và nhiệt cho mọi thế giới trong hệ.',
        },
        mercury: {
            name: 'Sao Thủy',
            description: 'Hành tinh nhỏ nhất Hệ Mặt Trời và gần Mặt Trời nhất. Sao Thủy không có'
                + ' khí quyển để giữ nhiệt, nên nhiệt độ bề mặt dao động cực lớn, từ −180 °C về'
                + ' đêm đến 430 °C vào ban ngày.',
        },
        venus: {
            name: 'Sao Kim',
            description: 'Thường được gọi là hành tinh song sinh của Trái Đất vì có kích thước và'
                + ' khối lượng gần bằng, nhưng Sao Kim có khí quyển carbon dioxide dày đặc tạo ra'
                + ' hiệu ứng nhà kính mất kiểm soát, khiến nó là hành tinh nóng nhất ở 465 °C —'
                + ' nóng hơn cả Sao Thủy.',
        },
        earth: {
            name: 'Trái Đất',
            description: 'Hành tinh của chúng ta, và là thiên thể duy nhất trong vũ trụ được biết'
                + ' chắc chắn có sự sống. Đại dương nước lỏng, từ trường bảo vệ và bầu khí quyển'
                + ' nitơ–oxy của Trái Đất tạo nên một môi trường sống chưa từng thấy ở nơi nào'
                + ' khác.',
        },
        mars: {
            name: 'Sao Hỏa',
            description: 'Hành tinh Đỏ, được đặt tên theo màu bề mặt gỉ sét do oxit sắt. Sao Hỏa'
                + ' mang Olympus Mons — ngọn núi lửa cao nhất Hệ Mặt Trời — và Valles Marineris,'
                + ' một hệ hẻm núi làm cho Grand Canyon trở nên nhỏ bé.',
        },
        jupiter: {
            name: 'Sao Mộc',
            description: 'Hành tinh lớn nhất, có khối lượng hơn gấp đôi tất cả các hành tinh khác'
                + ' cộng lại. Vết Đỏ Lớn là một cơn bão đã kéo dài hàng thế kỷ và lớn hơn Trái'
                + ' Đất, còn từ trường khổng lồ của Sao Mộc tạo ra những cực quang ngoạn mục.',
        },
        saturn: {
            name: 'Sao Thổ',
            description: 'Hệ vành đai nổi tiếng của Sao Thổ trải rộng 282.000 km nhưng chỉ dày'
                + ' 10–100 m, gồm băng và đá. Sao Thổ là hành tinh có mật độ thấp nhất, đến mức'
                + ' nó sẽ nổi trên nước nếu có một đại dương đủ lớn.',
        },
        uranus: {
            name: 'Sao Thiên Vương',
            description: 'Sao Thiên Vương quay nghiêng gần như nằm ngang, với độ nghiêng trục'
                + ' 97,8°, có lẽ do một va chạm khổng lồ thời cổ đại. Màu lục lam của nó đến từ'
                + ' việc mêtan hấp thụ ánh sáng đỏ. Khí quyển của nó lạnh nhất trong các hành'
                + ' tinh, ở −224 °C.',
        },
        neptune: {
            name: 'Sao Hải Vương',
            description: 'Hành tinh nhiều gió nhất, với những cơn gió vượt tốc độ âm thanh đạt'
                + ' 2.100 km/h. Nó được tiên đoán bằng toán học trước khi được quan sát. Vệ tinh'
                + ' lớn Triton của nó quay ngược chiều tự quay của chính Sao Hải Vương.',
        },
        pluto: {
            name: 'Sao Diêm Vương',
            description: 'Sao Diêm Vương là hành tinh lùn nổi tiếng nhất Hệ Mặt Trời, quay ở xa'
                + ' phía ngoài Sao Hải Vương trong vành đai Kuiper. Quỹ đạo rất lệch tâm và nghiêng'
                + ' của nó đưa nó đi từ 29,7 đến 49,3 đơn vị thiên văn tính từ Mặt Trời, và bề mặt'
                + ' chủ yếu là băng nitơ, mêtan và carbon monoxide.',
        },
        ceres: {
            name: 'Ceres',
            description: 'Ceres là thiên thể lớn nhất vành đai tiểu hành tinh và là hành tinh lùn'
                + ' duy nhất ở Hệ Mặt Trời phía trong. Được phát hiện năm 1801 và ban đầu xếp là'
                + ' hành tinh, rồi được phân loại lại thành hành tinh lùn năm 2006. Tàu Dawn của'
                + ' NASA đã phát hiện các vệt sáng natri carbonat trong hố Occator, gợi ý hoạt'
                + ' động địa chất gần đây.',
        },
        eris: {
            name: 'Eris',
            description: 'Eris là hành tinh lùn có khối lượng lớn nhất được biết — đặc hơn Sao Diêm'
                + ' Vương một chút. Việc phát hiện ra nó năm 2005 đã châm ngòi cuộc tranh luận của'
                + ' Hiệp hội Thiên văn Quốc tế dẫn tới việc phân loại lại Sao Diêm Vương. Eris là'
                + ' một thiên thể đĩa phân tán với quỹ đạo rất lệch tâm, và bề mặt phủ băng mêtan'
                + ' khiến nó là một trong những thiên thể sáng nhất Hệ Mặt Trời.',
        },
        haumea: {
            name: 'Haumea',
            description: 'Haumea là một trong những thiên thể lớn quay nhanh nhất Hệ Mặt Trời, hoàn'
                + ' thành một vòng tự quay trong chưa đầy bốn giờ. Sự tự quay nhanh này khiến nó có'
                + ' hình elip kéo dài đặc trưng. Nó có hai vệ tinh — Hiʻiaka và Namaka — và là'
                + ' thiên thể vành đai Kuiper đầu tiên được phát hiện có hệ vành đai.',
        },
        makemake: {
            name: 'Makemake',
            description: 'Makemake là thiên thể sáng thứ hai của vành đai Kuiper sau Sao Diêm Vương,'
                + ' và là hành tinh lùn lớn thứ ba được biết. Được đặt tên theo vị thần sáng tạo'
                + ' của người Rapa Nui, nó không có khí quyển quan sát được, bề mặt cực lạnh phủ'
                + ' băng êtan và mêtan, và có một vệ tinh nhỏ được Hubble phát hiện năm 2016.',
        },
        luna: {
            name: 'Mặt Trăng',
            description: 'Vệ tinh tự nhiên duy nhất của Trái Đất, và là vệ tinh lớn thứ năm Hệ Mặt'
                + ' Trời. Lực hấp dẫn của Mặt Trăng chi phối thủy triều và giữ ổn định độ nghiêng'
                + ' trục Trái Đất. Đây là thiên thể duy nhất ngoài Trái Đất mà con người từng đặt'
                + ' chân lên.',
        },
        phobos: {
            name: 'Phobos',
            description: 'Phobos là vệ tinh lớn hơn và gần Sao Hỏa hơn trong hai vệ tinh của hành'
                + ' tinh này, quay gần đến mức nó mọc và lặn hai lần mỗi ngày Sao Hỏa. Quỹ đạo của'
                + ' nó đang thu nhỏ dần, và có lẽ nó sẽ vỡ ra hoặc đâm vào Sao Hỏa trong vài chục'
                + ' triệu năm nữa.',
        },
        deimos: {
            name: 'Deimos',
            description: 'Deimos là vệ tinh nhỏ hơn của Sao Hỏa, với bề mặt tối và không đều, gợi'
                + ' ý nó là một tiểu hành tinh bị bắt giữ. Nó quay xa Sao Hỏa hơn Phobos và đang'
                + ' trôi ra ngoài rất chậm.',
        },
        io: {
            name: 'Io',
            description: 'Io là thiên thể có hoạt động núi lửa mạnh nhất Hệ Mặt Trời, được thúc'
                + ' đẩy bởi lực uốn thủy triều dữ dội từ Sao Mộc và cộng hưởng quỹ đạo với Europa'
                + ' và Ganymede.',
        },
        europa: {
            name: 'Europa',
            description: 'Europa nhiều khả năng che giấu một đại dương nước mặn toàn cầu bên dưới'
                + ' lớp vỏ băng, khiến nó là một trong những mục tiêu tốt nhất để tìm kiếm sự sống'
                + ' trong Hệ Mặt Trời.',
        },
        ganymede: {
            name: 'Ganymede',
            description: 'Ganymede là vệ tinh lớn nhất Hệ Mặt Trời, và là vệ tinh duy nhất được'
                + ' biết tự tạo ra từ trường riêng.',
        },
        callisto: {
            name: 'Callisto',
            description: 'Callisto là vệ tinh ngoài cùng trong bốn vệ tinh Galileo của Sao Mộc,'
                + ' với bề mặt dày đặc hố va chạm và rất cổ về mặt địa chất.',
        },
        titan: {
            name: 'Titan',
            description: 'Titan là vệ tinh lớn nhất của Sao Thổ, và là vệ tinh duy nhất Hệ Mặt Trời'
                + ' có khí quyển dày đặc cùng chất lỏng ổn định trên bề mặt.',
        },
        enceladus: {
            name: 'Enceladus',
            description: 'Enceladus là một vệ tinh băng phun ra những cột mạch từ cực nam, nuôi'
                + ' vành đai E của Sao Thổ và gợi ý về một đại dương dưới bề mặt.',
        },
        triton: {
            name: 'Triton',
            description: 'Triton là vệ tinh lớn nhất của Sao Hải Vương, và là vệ tinh lớn duy nhất'
                + ' Hệ Mặt Trời có quỹ đạo nghịch hành, gợi ý nó bị bắt giữ từ vành đai Kuiper.',
        },
        amalthea: {
            name: 'Amalthea',
            description: 'Amalthea là vệ tinh lớn thứ năm của Sao Mộc, và là vệ tinh cuối cùng được'
                + ' phát hiện bằng quan sát trực tiếp qua kính. Màu đỏ sẫm của nó đến từ hợp chất'
                + ' lưu huỳnh phóng ra từ Io. Nó quay gần Sao Mộc đến mức nằm bên trong hệ vành'
                + ' đai của hành tinh.',
        },
        mimas: {
            name: 'Mimas',
            description: 'Mimas là vệ tinh chính nhỏ nhất và gần Sao Thổ nhất, nổi tiếng với hố va'
                + ' chạm khổng lồ Herschel — bằng một phần ba đường kính của nó — khiến nó trông'
                + ' giống Ngôi sao Chết. Dù bề mặt băng giá, lực uốn thủy triều gợi ý có thể có'
                + ' một lớp nước lỏng dưới bề mặt.',
        },
        tethys: {
            name: 'Tethys',
            description: 'Tethys là một trong những vệ tinh băng lớn của Sao Thổ, nổi bật với hai'
                + ' đặc điểm địa chất: hố va chạm khổng lồ Odysseus, và hẻm Ithaca Chasma, một hệ'
                + ' thung lũng kéo dài ba phần tư chu vi vệ tinh.',
        },
        dione: {
            name: 'Dione',
            description: 'Dione là một vệ tinh băng đặc của Sao Thổ, với bán cầu dẫn đầu dày đặc hố'
                + ' va chạm, còn bán cầu phía sau bị cắt ngang bởi những vách băng sáng gọi là địa'
                + ' hình sợi. Cassini đã phát hiện một khí quyển oxy mỏng và hoạt động địa nhiệt'
                + ' thủy có thể có.',
        },
        rhea: {
            name: 'Rhea',
            description: 'Rhea là vệ tinh lớn thứ hai của Sao Thổ và là vệ tinh lớn thứ chín Hệ Mặt'
                + ' Trời. Bề mặt dày đặc hố va chạm cho thấy nó đã bất động về địa chất trong hầu'
                + ' hết lịch sử. Cassini đã phát hiện quanh nó một khí quyển mỏng gồm oxy và carbon'
                + ' dioxide.',
        },
        iapetus: {
            name: 'Iapetus',
            description: 'Iapetus là một trong những vệ tinh gây tò mò nhất Hệ Mặt Trời, với một'
                + ' bán cầu đen như than và bán cầu kia sáng như tuyết. Vẻ ngoài hai màu này đã'
                + ' khiến các nhà thiên văn bối rối hàng thế kỷ, và nguyên nhân là bụi tối tích tụ'
                + ' trên mặt dẫn đầu.',
        },
        miranda: {
            name: 'Miranda',
            description: 'Miranda là vệ tinh chính nhỏ nhất và gần Sao Thiên Vương nhất trong năm'
                + ' vệ tinh chính, nhưng lại có địa hình đa dạng và kịch tính bậc nhất trong các'
                + ' vệ tinh Hệ Mặt Trời. Vách Verona Rupes, cao hơn 20 km, là vách đá cao nhất'
                + ' được biết trong Hệ Mặt Trời.',
        },
        ariel: {
            name: 'Ariel',
            description: 'Ariel là vệ tinh chính sáng nhất của Sao Thiên Vương, với bề mặt trẻ về'
                + ' địa chất phủ đầy thung lũng, sống núi và vách đứt gãy, gợi ý một thời kỳ đun'
                + ' nóng thủy triều trước đây. Hệ thung lũng hẻm của nó khiến nó là vệ tinh hoạt'
                + ' động địa chất mạnh nhất của Sao Thiên Vương.',
        },
        umbriel: {
            name: 'Umbriel',
            description: 'Umbriel là vệ tinh chính tối nhất của Sao Thiên Vương, với bề mặt cổ đều'
                + ' đặn và dày đặc hố va chạm, gợi ý ít hoạt động địa chất kể từ khi hình thành.'
                + ' Một vòng sáng bí ẩn bên trong hố Wunda tại xích đạo của nó vẫn chưa được giải'
                + ' thích.',
        },
        titania: {
            name: 'Titania',
            description: 'Titania là vệ tinh lớn nhất của Sao Thiên Vương và là vệ tinh lớn thứ tám'
                + ' Hệ Mặt Trời. Bề mặt của nó cho thấy hỗn hợp giữa hố va chạm cổ và các đặc điểm'
                + ' kiến tạo mới hơn, gồm những hẻm đứt gãy khổng lồ, gợi ý sự đun nóng bên trong'
                + ' trong quá khứ.',
        },
        oberon: {
            name: 'Oberon',
            description: 'Oberon là vệ tinh chính ngoài cùng và lớn thứ hai của Sao Thiên Vương. Bề'
                + ' mặt dày đặc hố va chạm của nó thuộc loại cổ nhất trong hệ Sao Thiên Vương, và'
                + ' vài hố có vết tối dưới đáy, có thể là vật chất hữu cơ từ các đợt phun trào dưới'
                + ' bề mặt.',
        },
        proteus: {
            name: 'Proteus',
            description: 'Proteus là vệ tinh lớn thứ hai của Sao Hải Vương và là vệ tinh trong lớn'
                + ' nhất, nhưng vẫn chưa được biết đến cho tới khi Voyager 2 bay ngang năm 1989, vì'
                + ' nó quay quá gần ánh chói của Sao Hải Vương. Bề mặt tối, không đều của nó dày'
                + ' đặc hố va chạm, và có một hố, Pharos, gần bằng chính vệ tinh về bề rộng.',
        },
        nereid: {
            name: 'Nereid',
            description: 'Nereid có một trong những quỹ đạo vệ tinh lệch tâm nhất Hệ Mặt Trời, dao'
                + ' động từ 1,4 đến 9,7 triệu km tính từ Sao Hải Vương. Quỹ đạo cực đoan này gợi ý'
                + ' nó có thể là một thiên thể bị bắt giữ từ vành đai Kuiper, hoặc bị nhiễu loạn'
                + ' hấp dẫn khi Triton bị bắt giữ.',
        },
        'proxima-centauri-b': {
            name: 'Proxima Centauri b',
            description: 'Ngoại hành tinh gần Trái Đất nhất được biết, quay trong vùng ở được quanh'
                + ' Proxima Centauri — ngôi sao gần Mặt Trời nhất. Khả năng ở được của nó chưa'
                + ' chắc chắn do những đợt bùng phát dữ dội từ ngôi sao lùn đỏ chủ.',
        },
        'kepler-22b': {
            name: 'Kepler-22b',
            description: 'Ngoại hành tinh đầu tiên được xác nhận nằm trong vùng ở được của một ngôi'
                + ' sao giống Mặt Trời. Với bán kính gấp 2,4 lần Trái Đất và nhiệt độ cân bằng'
                + ' −11 °C, Kepler-22b có thể có nước lỏng nếu có khí quyển.',
        },
        '51-peg-b': {
            name: '51 Pegasi b',
            description: 'Ngoại hành tinh đầu tiên được xác nhận quanh một ngôi sao giống Mặt Trời,'
                + ' phát hiện năm 1995 — một cột mốc của thiên văn học. Nó là một "Sao Mộc nóng"'
                + ' quay gần sao chủ gấp trăm lần khoảng cách Sao Mộc–Mặt Trời, nên nhiệt độ bề'
                + ' mặt đạt khoảng 1.200 °C.',
        },
        'trappist-1e': {
            name: 'TRAPPIST-1e',
            description: 'Một trong bảy hành tinh cỡ Trái Đất quay quanh sao lùn siêu lạnh'
                + ' TRAPPIST-1, và được coi là hành tinh có khả năng ở được cao nhất trong số đó.'
                + ' TRAPPIST-1e nhận năng lượng sao gần bằng Trái Đất và có thể có nước lỏng.',
        },
        'k2-18b': {
            name: 'K2-18b',
            description: 'Một hành tinh cận Sao Hải Vương trong vùng ở được, với khí quyển giàu'
                + ' hydro. Kính viễn vọng không gian James Webb đã phát hiện carbon dioxide và'
                + ' mêtan ở đó — cùng một tín hiệu sơ bộ của dimethyl sulfide, một phân tử do sự'
                + ' sống tạo ra trên Trái Đất.',
        },
        'hd-209458b': {
            name: 'HD 209458 b',
            description: 'Có biệt danh "Osiris", đây là ngoại hành tinh đầu tiên được quan sát bằng'
                + ' phương pháp quá cảnh (năm 2000) và là hành tinh đầu tiên được biết có khí quyển.'
                + ' Hubble đã phát hiện hydro, oxy và carbon bốc hơi khỏi lớp khí quyển đang phồng'
                + ' ra của nó.',
        },
        'gj-1214b': {
            name: 'GJ 1214 b',
            description: 'Siêu Trái Đất đầu tiên có khí quyển được xác nhận và được nghiên cứu chi'
                + ' tiết. Các mô hình cho thấy GJ 1214 b là một "thế giới đại dương" — có lẽ một'
                + ' nửa khối lượng là nước — bọc trong lớp khí quyển hơi dày đặc, một loại hành'
                + ' tinh không có tương đương trong Hệ Mặt Trời.',
        },
        '55-cnc-e': {
            name: '55 Cancri e',
            description: 'Một siêu Trái Đất quay gần sao chủ đến mức hoàn thành một vòng trong chưa'
                + ' đầy 18 giờ. Nhiệt độ bề mặt vượt 2.700 °C — đủ để nấu chảy đá. James Webb đã'
                + ' phát hiện một khí quyển có thể có nguồn gốc núi lửa ở đó.',
        },
        andromeda: {
            name: 'Thiên hà Tiên Nữ',
            description: 'Thiên hà lớn láng giềng gần nhất của chúng ta, và là thiên thể xa nhất'
                + ' nhìn được bằng mắt thường. Thiên hà Tiên Nữ (M31) đang lao về phía Ngân Hà, và'
                + ' dự kiến sẽ hợp nhất với nó sau khoảng 4,5 tỷ năm nữa.',
        },
        'orion-nebula': {
            name: 'Tinh vân Lạp Hộ',
            description: 'Một trong những thiên thể được nghiên cứu nhiều nhất trong thiên văn học,'
                + ' và là một trong những tinh vân sáng nhất nhìn được bằng mắt thường. Đây là một'
                + ' vườn ươm sao, nơi các ngôi sao và hệ hành tinh mới hình thành từ những đám mây'
                + ' khí bụi đang sụp đổ.',
        },
        'crab-nebula': {
            name: 'Tinh vân Con Cua',
            description: 'Tàn dư đang giãn nở của một siêu tân tinh được các nhà thiên văn Trung'
                + ' Quốc quan sát năm 1054. Ở trung tâm là một sao neutron quay nhanh (pulsar)'
                + ' quay ba mươi vòng mỗi giây, phát ra những chùm bức xạ.',
        },
        'pillars-of-creation': {
            name: 'Cột Sáng Tạo',
            description: 'Những cột khí bụi giống vòi voi bên trong Tinh vân Đại Bàng, nơi các ngôi'
                + ' sao mới đang hình thành. Đây là một trong những bức ảnh nổi tiếng nhất của'
                + ' Hubble (1995). Ảnh của James Webb năm 2022 đã hé lộ những ngôi sao trẻ ẩn bên'
                + ' trong chưa từng thấy trước đó.',
        },
        'whirlpool-galaxy': {
            name: 'Thiên hà Xoáy Nước',
            description: 'M51 là một thiên hà xoắn ốc thiết kế hoàn hảo đang tương tác với thiên hà'
                + ' đồng hành nhỏ hơn NGC 5195. Tương tác này thúc đẩy mạnh sự hình thành sao trong'
                + ' các cánh tay xoắn ốc. Đây là thiên hà đầu tiên được nhận ra là thiên hà xoắn'
                + ' ốc.',
        },
        'helix-nebula': {
            name: 'Tinh vân Xoắn Ốc',
            description: 'Tinh vân hành tinh lớn nhất trên bầu trời tính theo kích thước biểu kiến,'
                + ' có biệt danh "Con mắt của Chúa". Đây là tàn dư các lớp ngoài mà một ngôi sao'
                + ' giống Mặt Trời thổi ra khi hấp hối, bao quanh một sao lùn trắng ở trung tâm.',
        },
        apophis: {
            name: '99942 Apophis',
            description: 'Apophis sẽ thực hiện một trong những lần bay ngang gần nhất của tiểu hành'
                + ' tinh trong lịch sử ghi chép vào ngày 13 tháng 4 năm 2029 — đi qua cách Trái'
                + ' Đất 32.000 km, gần hơn cả các vệ tinh địa tĩnh. Dữ liệu radar đã loại trừ mọi'
                + ' khả năng va chạm trong ít nhất một trăm năm.',
        },
        bennu: {
            name: '101955 Bennu',
            description: 'Một tiểu hành tinh kiểu đống đá vụn, với một trong những xác suất va chạm'
                + ' cao nhất trong các thiên thể gần Trái Đất được biết. Sứ mệnh OSIRIS-REx của'
                + ' NASA đã thu một mẫu vật nặng 60 gram năm 2020, đưa về Trái Đất năm 2023, và'
                + ' hiện đang được phân tích thành phần.',
        },
        didymos: {
            name: '65803 Didymos',
            description: 'Một hệ tiểu hành tinh đôi — một thiên thể chính lớn và một vệ tinh nhỏ tên'
                + ' Dimorphos. Tàu DART của NASA đã cố ý đâm vào Dimorphos năm 2022, làm thay đổi'
                + ' chu kỳ quỹ đạo của nó 33 phút, chứng minh khả năng phòng thủ hành tinh.',
        },
        florence: {
            name: '3122 Florence',
            description: 'Một trong những tiểu hành tinh có khả năng gây nguy hiểm lớn nhất được'
                + ' biết. Trong lần bay ngang năm 2017 ở khoảng cách 7,1 triệu km (gấp 18,5 lần'
                + ' khoảng cách đến Mặt Trăng), radar đã phát hiện nó có hai vệ tinh nhỏ — trở'
                + ' thành hệ tiểu hành tinh ba đầu tiên được phát hiện trong một lần bay ngang.',
        },
        '1994-pc1': {
            name: '7482 (1994 PC1)',
            description: 'Một tiểu hành tinh nhóm Apollo có khả năng gây nguy hiểm, đã có lần tiếp'
                + ' cận Trái Đất gần nhất trong hai trăm năm vào ngày 18 tháng 1 năm 2022 — đi qua'
                + ' cách 1,93 triệu km (gấp năm lần khoảng cách đến Mặt Trăng). Nó nhìn được qua'
                + ' kính thiên văn nghiệp dư trong lần bay ngang đó.',
        },
        '2023-bu': {
            name: '2023 BU',
            description: 'Một tiểu hành tinh nhỏ đã bay qua chỉ cách bề mặt Trái Đất 3.600 km vào'
                + ' ngày 26 tháng 1 năm 2023 — tức là bên trong quỹ đạo các vệ tinh địa tĩnh, và'
                + ' là một trong những lần bay ngang gần nhất từng được ghi nhận. Nó đi qua an'
                + ' toàn, không xảy ra sự cố.',
        },
        vesta: {
            name: 'Vesta',
            description: 'Vesta là thiên thể có khối lượng lớn thứ hai trong vành đai tiểu hành tinh'
                + ' chính, và là một trong số ít tiểu hành tinh từng đạt cân bằng thủy tĩnh trong'
                + ' quá khứ. Tàu Dawn của NASA đã bay quanh nó từ 2011 đến 2012, phát hiện hai bồn'
                + ' va chạm khổng lồ ở cực nam — Rheasilvia (rộng 505 km) và Veneneia — và một lớp'
                + ' bên trong phân dị phức tạp về địa chất.',
        },
        pallas: {
            name: 'Pallas',
            description: 'Pallas là tiểu hành tinh lớn thứ ba của vành đai chính, nổi bật với độ'
                + ' nghiêng quỹ đạo cao bất thường, khoảng 35° — thuộc hàng cao nhất trong các tiểu'
                + ' hành tinh lớn của vành đai. Thành phần bề mặt chứa cacbon nguyên thủy của nó'
                + ' gợi ý nó là tàn dư từ Hệ Mặt Trời sơ khai. Ảnh chụp gần đây của Kính Thiên văn'
                + ' Rất Lớn (VLT) cho thấy một bề mặt lồi lõm dữ dội.',
        },
        halley: {
            name: 'Sao chổi Halley',
            description: 'Sao chổi tuần hoàn nổi tiếng nhất, với những lần xuất hiện được ghi chép'
                + ' từ năm 240 TCN. Nhân của Halley là một thiên thể tối, hình dạng không đều,'
                + ' kích thước khoảng 15 × 8 km — và là một trong những thiên thể tối nhất được'
                + ' biết trong Hệ Mặt Trời. Lần xuất hiện năm 1986 của nó được cả một hạm đội tàu'
                + ' quốc tế nghiên cứu, trong đó có tàu Giotto của ESA, tàu đầu tiên chụp ảnh'
                + ' nhân sao chổi.',
        },
        iss: {
            name: 'Trạm Vũ trụ Quốc tế',
            shortName: 'Trạm Quốc tế',
            description: 'Trạm Vũ trụ Quốc tế là cấu trúc lớn nhất từng được lắp ráp trong không'
                + ' gian, và là nơi con người hiện diện liên tục trên quỹ đạo từ tháng 11 năm'
                + ' 2000. Nó được xây và vận hành bởi liên minh năm cơ quan vũ trụ, vừa là phòng'
                + ' thí nghiệm nghiên cứu trong môi trường không trọng lực, vừa là đài quan sát và'
                + ' bệ thử công nghệ thám hiểm không gian sâu. Trạm hoàn thành khoảng 16 vòng'
                + ' quanh Trái Đất mỗi ngày.',
        },
        tiangong: {
            name: 'Trạm vũ trụ Thiên Cung',
            description: 'Trạm vũ trụ thường trực của Trung Quốc, được lắp ráp trên quỹ đạo Trái'
                + ' Đất thấp bắt đầu từ mô-đun lõi Thiên Hòa vào tháng 4 năm 2021. Thiên Cung là'
                + ' trạm vũ trụ thứ ba có phi hành đoàn dài ngày sau Mir và Trạm Quốc tế, và được'
                + ' thiết kế cho tuổi thọ vận hành mười lăm năm. Hiện nó gồm ba mô-đun và có các'
                + ' phi hành đoàn ba người Trung Quốc luân phiên.',
        },
        mir: {
            name: 'Trạm vũ trụ Mir',
            description: 'Mir là trạm vũ trụ mô-đun đầu tiên của thế giới, được lắp ráp trên quỹ'
                + ' đạo trong suốt một thập niên bắt đầu từ năm 1986. Nó là nơi diễn ra chuyến bay'
                + ' liên tục kỷ lục 437 ngày của phi hành gia Valeri Polyakov, và là nơi thử'
                + ' nghiệm các chuyến bay có người dài ngày. Sau khi Liên Xô tan rã, Mir đón những'
                + ' sứ mệnh chung Nga–Mỹ đầu tiên trong chương trình Tàu con thoi–Mir, trước khi'
                + ' rời quỹ đạo năm 2001.',
        },
        hubble: {
            name: 'Kính viễn vọng không gian Hubble',
            description: 'Kính viễn vọng không gian Hubble đã thay đổi sâu sắc hiểu biết của chúng'
                + ' ta về vũ trụ kể từ khi phóng năm 1990. Được các phi hành đoàn tàu con thoi bảo'
                + ' dưỡng năm lần, Hubble đã đo tốc độ giãn nở của vũ trụ, xác nhận sự tồn tại của'
                + ' các hố đen siêu khối lượng trong phần lớn các thiên hà lớn, hé lộ những cảnh'
                + ' tượng sâu về hàng nghìn thiên hà trên những mảnh trời nhỏ, và tạo ra một số bức'
                + ' ảnh khoa học nổi tiếng nhất lịch sử.',
        },
        jwst: {
            name: 'Kính viễn vọng không gian James Webb',
            description: 'Kính viễn vọng không gian mạnh nhất mà loài người từng chế tạo, quan sát'
                + ' vũ trụ bằng tia hồng ngoại từ điểm Lagrange L2 giữa Mặt Trời và Trái Đất. Tấm'
                + ' gương beryli mạ vàng đường kính 6,5 mét gồm mười tám phân đoạn, cùng tấm chắn'
                + ' nắng siêu lạnh, cho phép nó nhìn thấy những thiên hà đầu tiên hình thành sau Vụ'
                + ' Nổ Lớn, chụp khí quyển các ngoại hành tinh, và phát hiện những vườn ươm sao bị'
                + ' che khuất khỏi kính thiên văn quang học.',
        },
        chandra: {
            name: 'Đài quan sát tia X Chandra',
            description: 'Chandra là đài quan sát tia X hàng đầu của NASA, nghiên cứu một số hiện'
                + ' tượng dữ dội và giàu năng lượng nhất vũ trụ: hố đen, sao neutron, siêu tân tinh'
                + ' và cụm thiên hà. Quỹ đạo rất dẹt của nó đưa nó đi được một phần ba quãng đường'
                + ' tới Mặt Trăng, giữ nó ở phía trên các vành đai bức xạ quanh Trái Đất trong tới'
                + ' 55 giờ mỗi vòng. Chandra đã phát hiện các luồng tia X từ chuẩn tinh, đo phân bố'
                + ' vật chất tối trong các cụm, và chụp ảnh tàn dư các vụ nổ sao.',
        },
        voyager1: {
            name: 'Voyager 1',
            description: 'Voyager 1 là vật thể nhân tạo xa Trái Đất nhất, và là tàu đầu tiên tiến'
                + ' vào không gian liên sao, vượt qua nhật mãn vào tháng 8 năm 2012. Được phóng để'
                + ' nghiên cứu các hành tinh ngoài, nó gửi về những hình ảnh ấn tượng về vệ tinh'
                + ' núi lửa Io của Sao Mộc và vệ tinh Titan của Sao Thổ. Đĩa Vàng của nó — một đĩa'
                + ' đồng mạ vàng mang âm thanh và hình ảnh của Trái Đất — là lời chào của loài'
                + ' người tới bất kỳ nền văn minh nào có thể tìm thấy nó.',
        },
        voyager2: {
            name: 'Voyager 2',
            description: 'Voyager 2 vẫn là tàu duy nhất từng ghé thăm cả bốn hành tinh ngoài — Sao'
                + ' Mộc, Sao Thổ, Sao Thiên Vương và Sao Hải Vương. Lần bay ngang Sao Hải Vương năm'
                + ' 1989 của nó đã hé lộ Vết Tối Lớn và vệ tinh Triton hoạt động mạch phun. Vào'
                + ' tháng 12 năm 2018, nó trở thành vật thể nhân tạo thứ hai tiến vào không gian'
                + ' liên sao, và vẫn là tàu thăm dò duy nhất đo trực tiếp plasma liên sao ở nửa'
                + ' phía nam của nhật quyển.',
        },
        'new-horizons': {
            name: 'New Horizons',
            description: 'New Horizons đã thực hiện lần bay ngang gần Sao Diêm Vương đầu tiên vào'
                + ' ngày 14 tháng 7 năm 2015, hé lộ những dãy núi băng nitơ, một bồn địa hình trái'
                + ' tim gồm băng dễ bay hơi, và một thế giới hoạt động mạnh hơn tưởng tượng. Sau'
                + ' đó, vào ngày 1 tháng 1 năm 2019, nó bay ngang Arrokoth (2014 MU69) — thiên thể'
                + ' xa nhất và nguyên thủy nhất từng được thám hiểm — hé lộ một thiên thể đôi tiếp'
                + ' xúc hình thành từ hai thùy nhẹ nhàng kết hợp vào buổi bình minh của Hệ Mặt'
                + ' Trời.',
        },
        sputnik1: {
            name: 'Sputnik 1',
            description: 'Sputnik 1 là vệ tinh nhân tạo đầu tiên của thế giới, được Liên Xô phóng'
                + ' vào ngày 4 tháng 10 năm 1957, mở ra Kỷ nguyên Không gian và cuộc chạy đua'
                + ' không gian. Nó là một quả cầu nhôm đánh bóng đường kính 58 xăng-ti-mét, kéo'
                + ' theo bốn ăng-ten vô tuyến, và phát đi một tiếng bíp vô tuyến đơn giản mà những'
                + ' người nghiệp dư khắp thế giới bắt được. Nó bay quanh Trái Đất 21 ngày trước'
                + ' khi hết pin, rồi hồi quyển sau ba tháng.',
        },
    },
};
