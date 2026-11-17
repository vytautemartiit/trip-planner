import { getLang } from './i18n'

// Every destination the backend knows (backend/data.py), with an English name, airport code,
// map coordinates, quick facts and freely licensed photos from Wikimedia Commons.
// `lt` / `ltCountry` are the names exactly as the backend writes them ("Praha, Čekija").

const thumb = (path) => `https://thumb.wikimedia.org/wikipedia/commons/thumb/${path}`

// https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/FILE/960px-FILE -> Commons page for FILE
export const commonsPage = (src) => `https://commons.wikimedia.org/wiki/File:${src.split('/')[8]}`

const photo = (src, caption, author, license) => ({ src, caption, author, license })

const ISO = { Spain: 'ES', Italy: 'IT', Portugal: 'PT', Czechia: 'CZ', Hungary: 'HU', Poland: 'PL', Netherlands: 'NL', Greece: 'GR' }


export const CITIES = [
  {
    lt: 'Barselona',
    ltCountry: 'Ispanija',
    name: 'Barcelona',
    country: 'Spain',
    code: 'BCN',
    lat: 41.3874,
    lng: 2.1686,
    tagline: 'Gaudí architecture and Mediterranean beaches',
    about: 'Catalonia’s capital mixes Gothic lanes, Gaudí’s fairy-tale buildings and a city beach — with late dinners and tapas everywhere.',
    language: 'Spanish & Catalan',
    currency: 'Euro (€)',
    flight: '~3 h 35 min',
    bestTime: 'May–June, September',
    src: thumb('a/a6/Evening_light_over_Barcelona.jpg/960px-Evening_light_over_Barcelona.jpg'),
    author: 'M McBey',
    license: 'CC BY 2.0',
    gallery: [
      photo(thumb('e/ef/SF_maig_2_cropped.jpg/960px-SF_maig_2_cropped.jpg'), 'Sagrada Família', 'Canaan', 'CC BY-SA 4.0'),
      photo(thumb('3/33/Parc_guell_-_panoramio.jpg/960px-Parc_guell_-_panoramio.jpg'), 'Park Güell', 'essetefano', 'CC BY 3.0'),
      photo(thumb('b/bf/Casa_Batllo_Overview_Barcelona_Spain_cut.jpg/960px-Casa_Batllo_Overview_Barcelona_Spain_cut.jpg'), 'Casa Batlló', 'ChristianSchd', 'CC BY-SA 3.0'),
    ],
  },
  {
    lt: 'Roma',
    ltCountry: 'Italija',
    name: 'Rome',
    country: 'Italy',
    code: 'FCO',
    lat: 41.9028,
    lng: 12.4964,
    tagline: 'The Eternal City: the Colosseum, fountains and pizza',
    about: 'Nearly 3,000 years of history in one walkable centre: ancient ruins, Baroque piazzas and the Vatican, all fuelled by espresso and gelato.',
    language: 'Italian',
    currency: 'Euro (€)',
    flight: '~2 h 45 min',
    bestTime: 'April–June, September–October',
    src: thumb('7/7e/Trevi_Fountain%2C_Rome%2C_Italy_2_-_May_2007.jpg/960px-Trevi_Fountain%2C_Rome%2C_Italy_2_-_May_2007.jpg'),
    author: 'Diliff',
    license: 'CC BY 3.0',
    gallery: [
      photo(thumb('d/de/Colosseo_2020.jpg/960px-Colosseo_2020.jpg'), 'Colosseum', 'FeaturedPics', 'CC BY-SA 4.0'),
      photo(thumb('f/f5/Basilica_di_San_Pietro_in_Vaticano_September_2015-1a.jpg/960px-Basilica_di_San_Pietro_in_Vaticano_September_2015-1a.jpg'), "St. Peter's Basilica", 'Alvesgaspar', 'CC BY-SA 4.0'),
      photo(thumb('7/7b/Pantheon_%28Rome%29_-_Right_side_and_front.jpg/960px-Pantheon_%28Rome%29_-_Right_side_and_front.jpg'), 'Pantheon', 'NikonZ7II', 'CC BY-SA 4.0'),
    ],
  },
  {
    lt: 'Lisabona',
    ltCountry: 'Portugalija',
    name: 'Lisbon',
    country: 'Portugal',
    code: 'LIS',
    lat: 38.7223,
    lng: -9.1393,
    tagline: 'Seven hills, yellow trams and fado',
    about: 'A sunny hillside city on the Atlantic with tiled façades, viewpoints at every turn and pastéis de nata still warm from the oven.',
    language: 'Portuguese',
    currency: 'Euro (€)',
    flight: '~4 h 15 min',
    bestTime: 'March–May, September–October',
    src: thumb('4/41/Lisbon_%2836831596786%29_%28cropped%29.jpg/960px-Lisbon_%2836831596786%29_%28cropped%29.jpg'),
    author: 'Deensel',
    license: 'CC BY 2.0',
    gallery: [
      photo(thumb('6/65/Torre_Bel%C3%A9m_April_2009-4a.jpg/960px-Torre_Bel%C3%A9m_April_2009-4a.jpg'), 'Belém Tower', 'Alvesgaspar', 'CC BY-SA 3.0'),
      photo(thumb('0/0e/1502_legte_K%C3%B6nig_Manuel_I._den_Grundstein_f%C3%BCr_das_Hieronymus_Kloster_in_Lissabon._06.jpg/960px-1502_legte_K%C3%B6nig_Manuel_I._den_Grundstein_f%C3%BCr_das_Hieronymus_Kloster_in_Lissabon._06.jpg'), 'Jerónimos Monastery', 'Holger Uwe Schmitt', 'CC BY-SA 4.0'),
    ],
  },
  {
    lt: 'Praha',
    ltCountry: 'Čekija',
    name: 'Prague',
    country: 'Czechia',
    code: 'PRG',
    lat: 50.0755,
    lng: 14.4378,
    tagline: 'The city of a hundred spires on the Vltava',
    about: 'A fairy-tale old town that survived the wars intact: a castle on the hill, medieval bridges and some of the cheapest good beer in Europe.',
    language: 'Czech',
    currency: 'Czech koruna (Kč)',
    flight: '~1 h 45 min',
    bestTime: 'May–September, December markets',
    src: thumb('a/a7/Prague_%286365119737%29.jpg/960px-Prague_%286365119737%29.jpg'),
    author: 'Moyan Brenn',
    license: 'CC BY 2.0',
    gallery: [
      photo(thumb('2/22/Prague_07-2016_view_from_Lesser_Town_Tower_of_Charles_Bridge_img3.jpg/960px-Prague_07-2016_view_from_Lesser_Town_Tower_of_Charles_Bridge_img3.jpg'), 'Charles Bridge', 'A.Savin', 'FAL'),
      photo(thumb('5/5e/Karl%C5%AFv_most_Praha%2C_Star%C3%A9_M%C4%9Bsto_20170810_007.jpg/960px-Karl%C5%AFv_most_Praha%2C_Star%C3%A9_M%C4%9Bsto_20170810_007.jpg'), 'Prague Castle from the river', 'Tilman2007', 'CC BY-SA 4.0'),
      photo(thumb('3/37/Astronomical_Clock_%288341899828%29.jpg/960px-Astronomical_Clock_%288341899828%29.jpg'), 'Astronomical Clock', 'Steve Collis', 'CC BY 2.0'),
    ],
  },
  {
    lt: 'Budapeštas',
    ltCountry: 'Vengrija',
    name: 'Budapest',
    country: 'Hungary',
    code: 'BUD',
    lat: 47.4979,
    lng: 19.0402,
    tagline: 'Thermal baths and bridges over the Danube',
    about: 'Two cities joined by the Danube: hilly Buda with its castle and bastions, lively Pest with ruin bars and the grand Parliament.',
    language: 'Hungarian',
    currency: 'Hungarian forint (Ft)',
    flight: '~1 h 50 min',
    bestTime: 'April–June, September–October',
    src: thumb('5/53/View_from_Gell%C3%A9rt_Hill_to_the_Danube%2C_Hungary_-_Budapest_%2828493220635%29.jpg/960px-View_from_Gell%C3%A9rt_Hill_to_the_Danube%2C_Hungary_-_Budapest_%2828493220635%29.jpg'),
    author: 'Visions of Domino',
    license: 'CC BY 2.0',
    gallery: [
      photo(thumb('9/99/Hungarian_Parliament_Building_from_across_the_Danube%2C_2025-01-11.jpg/960px-Hungarian_Parliament_Building_from_across_the_Danube%2C_2025-01-11.jpg'), 'Parliament Building', 'Kilyann Le Hen', 'CC BY 4.0'),
      photo(thumb('f/fa/Budapest_Sz%C3%A9chenyi_Baths_R02.jpg/960px-Budapest_Sz%C3%A9chenyi_Baths_R02.jpg'), 'Széchenyi thermal bath', 'Marc Ryckaert (MJJR)', 'CC BY 3.0'),
      photo(thumb('6/6a/Hal%C3%A1szb%C3%A1stya_2017.jpg/960px-Hal%C3%A1szb%C3%A1stya_2017.jpg'), "Fisherman's Bastion", 'Brian Adamson', 'CC BY 2.0'),
    ],
  },
  {
    lt: 'Krokuva',
    ltCountry: 'Lenkija',
    name: 'Kraków',
    country: 'Poland',
    code: 'KRK',
    lat: 50.0647,
    lng: 19.945,
    tagline: "One of Europe's largest medieval market squares",
    about: 'Poland’s former royal capital: a huge market square, Wawel Castle above the Vistula and the atmospheric Kazimierz quarter.',
    language: 'Polish',
    currency: 'Polish złoty (zł)',
    flight: '~1 h 20 min',
    bestTime: 'May–September, December',
    src: thumb('a/a3/Krakow_Rynek_Glowny_panorama_2.jpg/960px-Krakow_Rynek_Glowny_panorama_2.jpg'),
    author: 'Andrzej Otrębski',
    license: 'CC BY-SA 4.0',
    gallery: [
      photo(thumb('8/87/Wawel_%284%29.jpg/960px-Wawel_%284%29.jpg'), 'Wawel Castle', 'Monika Towiańska', 'CC BY-SA 4.0'),
      photo(thumb('4/44/Church_of_Our_Lady_Assumed_into_Heaven%2C_5_Mariacki_square%2C_Old_Town%2C_Krak%C3%B3w%2C_Poland.jpg/960px-Church_of_Our_Lady_Assumed_into_Heaven%2C_5_Mariacki_square%2C_Old_Town%2C_Krak%C3%B3w%2C_Poland.jpg'), "St. Mary's Basilica", 'Zygmunt Put', 'CC BY-SA 4.0'),
      photo(thumb('8/80/%CE%91%CE%BB%CE%B1%CF%84%CF%89%CF%81%CF%85%CF%87%CE%B5%CE%AF%CE%B1_%CE%92%CE%B9%CE%B5%CE%BB%CE%AF%CF%84%CF%83%CE%BA%CE%B1_5021.jpg/960px-%CE%91%CE%BB%CE%B1%CF%84%CF%89%CF%81%CF%85%CF%87%CE%B5%CE%AF%CE%B1_%CE%92%CE%B9%CE%B5%CE%BB%CE%AF%CF%84%CF%83%CE%BA%CE%B1_5021.jpg'), 'Wieliczka Salt Mine', 'C messier', 'CC BY-SA 4.0'),
    ],
  },
  {
    lt: 'Amsterdamas',
    ltCountry: 'Nyderlandai',
    name: 'Amsterdam',
    country: 'Netherlands',
    code: 'AMS',
    lat: 52.3676,
    lng: 4.9041,
    tagline: 'Canals, bikes and world-class museums',
    about: 'Rings of 17th-century canals lined with narrow gabled houses, more bikes than people, and Rembrandt and Van Gogh a short walk apart.',
    language: 'Dutch (English widely spoken)',
    currency: 'Euro (€)',
    flight: '~2 h 25 min',
    bestTime: 'April–May (tulips), September',
    src: thumb('e/ea/Keizersgracht_Jul_2019.jpg/960px-Keizersgracht_Jul_2019.jpg'),
    author: 'JayAmber',
    license: 'CC BY-SA 4.0',
    gallery: [
      photo(thumb('8/80/South_facade_of_the_Rijksmuseum_Amsterdam_%28DSCF0528%29.jpg/960px-South_facade_of_the_Rijksmuseum_Amsterdam_%28DSCF0528%29.jpg'), 'Rijksmuseum', 'Trougnouf (Benoit Brummer)', 'CC BY 4.0'),
      photo(thumb('c/cd/Dam_Square_2026.jpg/960px-Dam_Square_2026.jpg'), 'Dam Square', 'Deerpeter', 'CC BY-SA 4.0'),
      photo(thumb('a/aa/Amsterdam_Magere_Brug_3.jpg/960px-Amsterdam_Magere_Brug_3.jpg'), 'Magere Brug', 'Zairon', 'CC BY-SA 4.0'),
    ],
  },
  {
    lt: 'Atėnai',
    ltCountry: 'Graikija',
    name: 'Athens',
    country: 'Greece',
    code: 'ATH',
    lat: 37.9838,
    lng: 23.7275,
    tagline: 'The Acropolis and the cradle of democracy',
    about: 'The Acropolis watches over a busy modern city of rooftop bars, tavernas and ancient ruins — with island ferries just down the road.',
    language: 'Greek',
    currency: 'Euro (€)',
    flight: '~3 h',
    bestTime: 'April–June, September–October',
    src: thumb('6/68/Athens_Acropolis_at_Daybreak.jpg/960px-Athens_Acropolis_at_Daybreak.jpg'),
    author: 'Andrew Parlette',
    license: 'CC BY 4.0',
    gallery: [
      photo(thumb('d/da/The_Parthenon_in_Athens.jpg/960px-The_Parthenon_in_Athens.jpg'), 'Parthenon', 'Steve Swayne', 'CC BY 2.0'),
      photo(thumb('a/a4/Carrer_del_barri_de_Plaka%2C_Atenes.JPG/960px-Carrer_del_barri_de_Plaka%2C_Atenes.JPG'), 'Plaka', 'Joanbanjo', 'CC BY-SA 3.0'),
      photo(thumb('9/93/L%27Olympieion_%28Ath%C3%A8nes%29_%2830776483926%29.jpg/960px-L%27Olympieion_%28Ath%C3%A8nes%29_%2830776483926%29.jpg'), 'Temple of Olympian Zeus', 'Jean-Pierre Dalbéra', 'CC BY 2.0'),
    ],
  },
].map((c) => ({ ...c, iso: ISO[c.country], page: commonsPage(c.src), destination: `${c.lt}, ${c.ltCountry}` }))

const rawCity = (name) => name.split(',')[0].trim()

// Accepts the backend's Lithuanian name ("Praha, Čekija") or an English one ("Prague").
export const findCity = (name) => {
  const city = rawCity(name)
  return CITIES.find((c) => c.lt === city || c.name === city) || null
}

export const cityName = (name) => {
  const c = findCity(name)
  if (!c) return rawCity(name)
  return getLang() === 'lt' ? c.lt : c.name
}

export const countryName = (name) => {
  const found = findCity(name)
  if (found) return getLang() === 'lt' ? found.ltCountry : found.country
  const parts = name.split(',')
  return parts.length > 1 ? parts[1].trim() : ''
}

export const cityCode = (name) => findCity(name)?.code || rawCity(name).toUpperCase().slice(0, 3)

// You can combine as many countries as there are destinations.
export const MAX_COUNTRIES = CITIES.length
