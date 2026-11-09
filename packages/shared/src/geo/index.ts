/**
 * Bangladesh administrative geography used for addresses and shipping zones.
 * Divisions and districts are the complete official lists (8 / 64).
 * Areas cover every Dhaka city thana (Inside Dhaka zone), the Dhaka district
 * upazilas, Chattogram city thanas and each remaining district's Sadar upazila.
 * Add rows to AREAS to extend coverage — the seed upserts by (districtId, name).
 */

export interface Division {
  id: number;
  name: string;
  nameBn: string;
}

export interface District {
  id: number;
  divisionId: number;
  name: string;
  nameBn: string;
}

export interface AreaSeed {
  districtId: number;
  name: string;
  nameBn: string;
  isInsideDhaka: boolean;
}

export const DIVISIONS: readonly Division[] = [
  { id: 1, name: 'Barishal', nameBn: 'বরিশাল' },
  { id: 2, name: 'Chattogram', nameBn: 'চট্টগ্রাম' },
  { id: 3, name: 'Dhaka', nameBn: 'ঢাকা' },
  { id: 4, name: 'Khulna', nameBn: 'খুলনা' },
  { id: 5, name: 'Mymensingh', nameBn: 'ময়মনসিংহ' },
  { id: 6, name: 'Rajshahi', nameBn: 'রাজশাহী' },
  { id: 7, name: 'Rangpur', nameBn: 'রংপুর' },
  { id: 8, name: 'Sylhet', nameBn: 'সিলেট' },
];

export const DISTRICTS: readonly District[] = [
  // Barishal
  { id: 1, divisionId: 1, name: 'Barguna', nameBn: 'বরগুনা' },
  { id: 2, divisionId: 1, name: 'Barishal', nameBn: 'বরিশাল' },
  { id: 3, divisionId: 1, name: 'Bhola', nameBn: 'ভোলা' },
  { id: 4, divisionId: 1, name: 'Jhalokati', nameBn: 'ঝালকাঠি' },
  { id: 5, divisionId: 1, name: 'Patuakhali', nameBn: 'পটুয়াখালী' },
  { id: 6, divisionId: 1, name: 'Pirojpur', nameBn: 'পিরোজপুর' },
  // Chattogram
  { id: 7, divisionId: 2, name: 'Bandarban', nameBn: 'বান্দরবান' },
  { id: 8, divisionId: 2, name: 'Brahmanbaria', nameBn: 'ব্রাহ্মণবাড়িয়া' },
  { id: 9, divisionId: 2, name: 'Chandpur', nameBn: 'চাঁদপুর' },
  { id: 10, divisionId: 2, name: 'Chattogram', nameBn: 'চট্টগ্রাম' },
  { id: 11, divisionId: 2, name: 'Cumilla', nameBn: 'কুমিল্লা' },
  { id: 12, divisionId: 2, name: "Cox's Bazar", nameBn: 'কক্সবাজার' },
  { id: 13, divisionId: 2, name: 'Feni', nameBn: 'ফেনী' },
  { id: 14, divisionId: 2, name: 'Khagrachhari', nameBn: 'খাগড়াছড়ি' },
  { id: 15, divisionId: 2, name: 'Lakshmipur', nameBn: 'লক্ষ্মীপুর' },
  { id: 16, divisionId: 2, name: 'Noakhali', nameBn: 'নোয়াখালী' },
  { id: 17, divisionId: 2, name: 'Rangamati', nameBn: 'রাঙ্গামাটি' },
  // Dhaka
  { id: 18, divisionId: 3, name: 'Dhaka', nameBn: 'ঢাকা' },
  { id: 19, divisionId: 3, name: 'Faridpur', nameBn: 'ফরিদপুর' },
  { id: 20, divisionId: 3, name: 'Gazipur', nameBn: 'গাজীপুর' },
  { id: 21, divisionId: 3, name: 'Gopalganj', nameBn: 'গোপালগঞ্জ' },
  { id: 22, divisionId: 3, name: 'Kishoreganj', nameBn: 'কিশোরগঞ্জ' },
  { id: 23, divisionId: 3, name: 'Madaripur', nameBn: 'মাদারীপুর' },
  { id: 24, divisionId: 3, name: 'Manikganj', nameBn: 'মানিকগঞ্জ' },
  { id: 25, divisionId: 3, name: 'Munshiganj', nameBn: 'মুন্সীগঞ্জ' },
  { id: 26, divisionId: 3, name: 'Narayanganj', nameBn: 'নারায়ণগঞ্জ' },
  { id: 27, divisionId: 3, name: 'Narsingdi', nameBn: 'নরসিংদী' },
  { id: 28, divisionId: 3, name: 'Rajbari', nameBn: 'রাজবাড়ী' },
  { id: 29, divisionId: 3, name: 'Shariatpur', nameBn: 'শরীয়তপুর' },
  { id: 30, divisionId: 3, name: 'Tangail', nameBn: 'টাঙ্গাইল' },
  // Khulna
  { id: 31, divisionId: 4, name: 'Bagerhat', nameBn: 'বাগেরহাট' },
  { id: 32, divisionId: 4, name: 'Chuadanga', nameBn: 'চুয়াডাঙ্গা' },
  { id: 33, divisionId: 4, name: 'Jashore', nameBn: 'যশোর' },
  { id: 34, divisionId: 4, name: 'Jhenaidah', nameBn: 'ঝিনাইদহ' },
  { id: 35, divisionId: 4, name: 'Khulna', nameBn: 'খুলনা' },
  { id: 36, divisionId: 4, name: 'Kushtia', nameBn: 'কুষ্টিয়া' },
  { id: 37, divisionId: 4, name: 'Magura', nameBn: 'মাগুরা' },
  { id: 38, divisionId: 4, name: 'Meherpur', nameBn: 'মেহেরপুর' },
  { id: 39, divisionId: 4, name: 'Narail', nameBn: 'নড়াইল' },
  { id: 40, divisionId: 4, name: 'Satkhira', nameBn: 'সাতক্ষীরা' },
  // Mymensingh
  { id: 41, divisionId: 5, name: 'Jamalpur', nameBn: 'জামালপুর' },
  { id: 42, divisionId: 5, name: 'Mymensingh', nameBn: 'ময়মনসিংহ' },
  { id: 43, divisionId: 5, name: 'Netrokona', nameBn: 'নেত্রকোণা' },
  { id: 44, divisionId: 5, name: 'Sherpur', nameBn: 'শেরপুর' },
  // Rajshahi
  { id: 45, divisionId: 6, name: 'Bogura', nameBn: 'বগুড়া' },
  { id: 46, divisionId: 6, name: 'Chapainawabganj', nameBn: 'চাঁপাইনবাবগঞ্জ' },
  { id: 47, divisionId: 6, name: 'Joypurhat', nameBn: 'জয়পুরহাট' },
  { id: 48, divisionId: 6, name: 'Naogaon', nameBn: 'নওগাঁ' },
  { id: 49, divisionId: 6, name: 'Natore', nameBn: 'নাটোর' },
  { id: 50, divisionId: 6, name: 'Pabna', nameBn: 'পাবনা' },
  { id: 51, divisionId: 6, name: 'Rajshahi', nameBn: 'রাজশাহী' },
  { id: 52, divisionId: 6, name: 'Sirajganj', nameBn: 'সিরাজগঞ্জ' },
  // Rangpur
  { id: 53, divisionId: 7, name: 'Dinajpur', nameBn: 'দিনাজপুর' },
  { id: 54, divisionId: 7, name: 'Gaibandha', nameBn: 'গাইবান্ধা' },
  { id: 55, divisionId: 7, name: 'Kurigram', nameBn: 'কুড়িগ্রাম' },
  { id: 56, divisionId: 7, name: 'Lalmonirhat', nameBn: 'লালমনিরহাট' },
  { id: 57, divisionId: 7, name: 'Nilphamari', nameBn: 'নীলফামারী' },
  { id: 58, divisionId: 7, name: 'Panchagarh', nameBn: 'পঞ্চগড়' },
  { id: 59, divisionId: 7, name: 'Rangpur', nameBn: 'রংপুর' },
  { id: 60, divisionId: 7, name: 'Thakurgaon', nameBn: 'ঠাকুরগাঁও' },
  // Sylhet
  { id: 61, divisionId: 8, name: 'Habiganj', nameBn: 'হবিগঞ্জ' },
  { id: 62, divisionId: 8, name: 'Moulvibazar', nameBn: 'মৌলভীবাজার' },
  { id: 63, divisionId: 8, name: 'Sunamganj', nameBn: 'সুনামগঞ্জ' },
  { id: 64, divisionId: 8, name: 'Sylhet', nameBn: 'সিলেট' },
];

export const DHAKA_DISTRICT_ID = 18;
export const CHATTOGRAM_DISTRICT_ID = 10;

const DHAKA_CITY_AREAS: ReadonlyArray<readonly [string, string]> = [
  ['Adabor', 'আদাবর'],
  ['Badda', 'বাড্ডা'],
  ['Banani', 'বনানী'],
  ['Bangshal', 'বংশাল'],
  ['Bashundhara R/A', 'বসুন্ধরা আ/এ'],
  ['Bhashantek', 'ভাষানটেক'],
  ['Cantonment', 'ক্যান্টনমেন্ট'],
  ['Chawkbazar', 'চকবাজার'],
  ['Dakshinkhan', 'দক্ষিণখান'],
  ['Darus Salam', 'দারুস সালাম'],
  ['Demra', 'ডেমরা'],
  ['Dhanmondi', 'ধানমন্ডি'],
  ['Gendaria', 'গেন্ডারিয়া'],
  ['Gulshan', 'গুলশান'],
  ['Hatirjheel', 'হাতিরঝিল'],
  ['Hazaribagh', 'হাজারীবাগ'],
  ['Jatrabari', 'যাত্রাবাড়ী'],
  ['Kadamtali', 'কদমতলী'],
  ['Kafrul', 'কাফরুল'],
  ['Kalabagan', 'কলাবাগান'],
  ['Kamrangirchar', 'কামরাঙ্গীরচর'],
  ['Khilgaon', 'খিলগাঁও'],
  ['Khilkhet', 'খিলক্ষেত'],
  ['Kotwali', 'কোতোয়ালী'],
  ['Lalbagh', 'লালবাগ'],
  ['Mirpur', 'মিরপুর'],
  ['Mohammadpur', 'মোহাম্মদপুর'],
  ['Motijheel', 'মতিঝিল'],
  ['Mugda', 'মুগদা'],
  ['New Market', 'নিউ মার্কেট'],
  ['Pallabi', 'পল্লবী'],
  ['Paltan', 'পল্টন'],
  ['Ramna', 'রমনা'],
  ['Rampura', 'রামপুরা'],
  ['Rupnagar', 'রূপনগর'],
  ['Sabujbagh', 'সবুজবাগ'],
  ['Shah Ali', 'শাহ আলী'],
  ['Shahbagh', 'শাহবাগ'],
  ['Shahjahanpur', 'শাহজাহানপুর'],
  ['Sher-e-Bangla Nagar', 'শেরেবাংলা নগর'],
  ['Shyampur', 'শ্যামপুর'],
  ['Sutrapur', 'সূত্রাপুর'],
  ['Tejgaon', 'তেজগাঁও'],
  ['Tejgaon Industrial Area', 'তেজগাঁও শিল্পাঞ্চল'],
  ['Turag', 'তুরাগ'],
  ['Uttara', 'উত্তরা'],
  ['Uttarkhan', 'উত্তরখান'],
  ['Vatara', 'ভাটারা'],
  ['Wari', 'ওয়ারী'],
];

const DHAKA_DISTRICT_UPAZILAS: ReadonlyArray<readonly [string, string]> = [
  ['Savar', 'সাভার'],
  ['Dhamrai', 'ধামরাই'],
  ['Keraniganj', 'কেরানীগঞ্জ'],
  ['Nawabganj', 'নবাবগঞ্জ'],
  ['Dohar', 'দোহার'],
];

const CHATTOGRAM_CITY_AREAS: ReadonlyArray<readonly [string, string]> = [
  ['Agrabad', 'আগ্রাবাদ'],
  ['Bakalia', 'বাকলিয়া'],
  ['Bayazid', 'বায়েজিদ'],
  ['Chandgaon', 'চান্দগাঁও'],
  ['Double Mooring', 'ডবলমুরিং'],
  ['Halishahar', 'হালিশহর'],
  ['Khulshi', 'খুলশী'],
  ['Kotwali', 'কোতোয়ালী'],
  ['Pahartali', 'পাহাড়তলী'],
  ['Panchlaish', 'পাঁচলাইশ'],
  ['Patenga', 'পতেঙ্গা'],
  ['Hathazari', 'হাটহাজারী'],
  ['Patiya', 'পটিয়া'],
  ['Sitakunda', 'সীতাকুণ্ড'],
];

export const AREAS: readonly AreaSeed[] = [
  ...DHAKA_CITY_AREAS.map(([name, nameBn]) => ({
    districtId: DHAKA_DISTRICT_ID,
    name,
    nameBn,
    isInsideDhaka: true,
  })),
  ...DHAKA_DISTRICT_UPAZILAS.map(([name, nameBn]) => ({
    districtId: DHAKA_DISTRICT_ID,
    name,
    nameBn,
    isInsideDhaka: false,
  })),
  ...CHATTOGRAM_CITY_AREAS.map(([name, nameBn]) => ({
    districtId: CHATTOGRAM_DISTRICT_ID,
    name,
    nameBn,
    isInsideDhaka: false,
  })),
  ...DISTRICTS.filter((d) => d.id !== DHAKA_DISTRICT_ID && d.id !== CHATTOGRAM_DISTRICT_ID).map((d) => ({
    districtId: d.id,
    name: `${d.name} Sadar`,
    nameBn: `${d.nameBn} সদর`,
    isInsideDhaka: false,
  })),
];

export const districtsOf = (divisionId: number): District[] =>
  DISTRICTS.filter((d) => d.divisionId === divisionId);
