// The 88 IAU constellations, in Vietnamese.
//
// Keyed by the IAU three-letter abbreviation — the id both the star catalog
// (data/constellationLines.json, see scripts/build-sky-catalog.mjs) and
// astronomy-engine's own Astronomy.Constellation() use — not by name. A
// name is not a stable key across languages the way "Ori" is, and it is
// the same fragile "match on English display text" this file's sibling
// catalog/countries.vi.js is stuck with only because the land table it
// translates has no better key to offer.
//
// Sourced from vi.wikipedia.org's "Danh sách chòm sao", the standard
// reference list Vietnamese astronomy education and Wikipedia's own
// constellation articles use. Six of these (And, Aqr, CVn, Ori, Tau, Ser)
// were already shipped in catalog/vi.js's `phrases` dict as "which
// constellation is this object in" labels on unrelated catalog entries —
// this table's values for those six were checked against that existing
// text and match it exactly, so the same constellation reads the same way
// everywhere on the site.
//
// Note the Tra key: Stellarium's own line data spells Triangulum Australe's
// abbreviation "Tra", not the more common "TrA" — this table has to match
// whatever the data actually uses or the lookup silently misses.

export const constellations = {
    And: 'Tiên Nữ',
    Ant: 'Tức Đồng',
    Aps: 'Thiên Yến',
    Aql: 'Thiên Ưng',
    Aqr: 'Bảo Bình',
    Ara: 'Thiên Đàn',
    Ari: 'Bạch Dương',
    Aur: 'Ngự Phu',
    Boo: 'Mục Phu',
    Cae: 'Điêu Cụ',
    Cam: 'Lộc Báo',
    Cap: 'Ma Kết',
    Car: 'Thuyền Để',
    Cas: 'Tiên Hậu',
    Cen: 'Bán Nhân Mã',
    Cep: 'Tiên Vương',
    Cet: 'Kình Ngư',
    Cha: 'Yển Diên',
    Cir: 'Viên Quy',
    CMa: 'Đại Khuyển',
    CMi: 'Tiểu Khuyển',
    Cnc: 'Cự Giải',
    Col: 'Thiên Cáp',
    Com: 'Hậu Phát',
    CrA: 'Nam Miện',
    CrB: 'Bắc Miện',
    Crt: 'Cự Tước',
    Cru: 'Nam Thập Tự',
    Crv: 'Ô Nha',
    CVn: 'Lạp Khuyển',
    Cyg: 'Thiên Nga',
    Del: 'Hải Đồn',
    Dor: 'Kiếm Ngư',
    Dra: 'Thiên Long',
    Equ: 'Tiểu Mã',
    Eri: 'Ba Giang',
    For: 'Thiên Lô',
    Gem: 'Song Tử',
    Gru: 'Thiên Hạc',
    Her: 'Vũ Tiên',
    Hor: 'Thời Chung',
    Hya: 'Trường Xà',
    Hyi: 'Thủy Xà',
    Ind: 'Ấn Đệ An',
    Lac: 'Hiết Hổ',
    Leo: 'Sư Tử',
    Lep: 'Thiên Thố',
    Lib: 'Thiên Bình',
    LMi: 'Tiểu Sư',
    Lup: 'Sài Lang',
    Lyn: 'Thiên Miêu',
    Lyr: 'Thiên Cầm',
    Men: 'Sơn Án',
    Mic: 'Hiển Vi Kính',
    Mon: 'Kỳ Lân',
    Mus: 'Thương Dăng',
    Nor: 'Củ Xích',
    Oct: 'Nam Cực',
    Oph: 'Xà Phu',
    Ori: 'Lạp Hộ',
    Pav: 'Khổng Tước',
    Peg: 'Phi Mã',
    Per: 'Anh Tiên',
    Phe: 'Phượng Hoàng',
    Pic: 'Hội Giá',
    PsA: 'Nam Ngư',
    Psc: 'Song Ngư',
    Pup: 'Thuyền Vĩ',
    Pyx: 'La Bàn',
    Ret: 'Võng Cổ',
    Scl: 'Ngọc Phu',
    Sco: 'Thiên Yết',
    Sct: 'Thuẫn Bài',
    Ser: 'Cự Xà',
    Sex: 'Lục Phân Nghi',
    Sge: 'Thiên Tiễn',
    Sgr: 'Cung Thủ',
    Tau: 'Kim Ngưu',
    Tel: 'Viễn Vọng Kính',
    Tra: 'Nam Tam Giác',
    Tri: 'Tam Giác',
    Tuc: 'Đỗ Quyên',
    UMa: 'Đại Hùng',
    UMi: 'Tiểu Hùng',
    Vel: 'Thuyền Phàm',
    Vir: 'Xử Nữ',
    Vol: 'Phi Ngư',
    Vul: 'Hồ Ly',
};
