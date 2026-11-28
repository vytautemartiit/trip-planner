# ✈️ Trip Budget Planner

**"I have €500 and 8 days — where can I go, and how many countries can I fit in?"**

Most flight search tools look for one A→B route. This app starts from your budget and trip length and shows
every trip that fits — to one city or several countries in a row.

**[🔗 Open the app](https://vytautemartiit.github.io/trip-planner/)** · [Lietuviškai ↓](#-kelionių-planuotojas)

> The backend runs on Render's free plan and falls asleep when unused, so the first search can take about a
> minute.

## Features

- 🔍 **Budget search** – trips to one city or 2+ countries that fit your budget and number of days
- 🛫 **32 departure airports** – fares from Vilnius are fixed; from other airports they are estimated from distance
- 💱 **Your currency** – EUR, USD, GBP, PLN or CZK with today's ECB exchange rates; prices and budget convert together
- 🗺️ **Trip page** – route on a map, day-by-day timeline and cost breakdown
- 🎫 **My tickets** – save trips or import your own airline ticket (PDF)
- 📅 **Trip info** – public holidays and festivals during your stay, travel advice and the documents you need
- 💬 **Travellers chat and Meet a local** – only for people with a verified trip to that country, with block and report
- 🌗 EN / LT, light and dark theme, works on phones and installs as an app (PWA)

## How the cost is calculated

```
total = flight + hotel_per_night × (days − 1) + daily_cost × days
```

For several countries, `itertools.combinations` builds every combination of cities, the days are split as evenly
as possible, and only the trips within budget are kept.

## Where the data comes from

| Data | Source | Real? |
|---|---|---|
| Flight, hotel and daily prices | `backend/data.py` (8 cities) | ❌ example prices |
| Exchange rates | [Frankfurter](https://frankfurter.dev) (ECB) | ✅ daily |
| Public holidays | [Nager.Date](https://date.nager.at) | ✅ |
| Travel advice | [GOV.UK](https://www.gov.uk/foreign-travel-advice) | ✅ |
| Concerts and shows | Ticketmaster Discovery API (needs a key) | ✅ optional |
| Photos and map | Wikimedia Commons, OpenStreetMap | ✅ |

Live flight and hotel prices are not available for free: Amadeus closed its free self-service API in July 2026,
and most other providers are paid or partner-only.

## Tech stack

- **Frontend:** React 19, Vite, Leaflet, lucide-react; hand-written CSS (no UI library); Vitest
- **Backend:** Python 3.12, FastAPI, SQLite, pypdf; pytest
- **Hosting:** GitHub Pages (frontend), Render (backend, Docker); GitHub Actions for tests and deploys

```
trip-planner/
├── frontend/   React app (src/components – UI, src/test – tests)
└── backend/    FastAPI app (main.py, calculator.py, data.py, …, test_*.py)
```

## API

Interactive docs at `/docs` (Swagger UI). Main endpoints:

| Endpoint | What it does |
|---|---|
| `GET /search?budget=&days=&currency=&origin=` | Trips to one city |
| `GET /search-multi?budget=&days=&countries=&currency=&origin=` | Trips through several countries |
| `GET /rates` | Today's exchange rates from EUR |
| `GET /destinations`, `GET /origins` | Cities and departure airports |
| `GET /travel/info` | Holidays, events and travel advice for a trip |
| `/auth/*`, `/account/tickets` | Accounts and saved tickets |
| `/trips/verify`, `/chat/*`, `/locals`, `/meet/*`, `/safety/*` | Verified trips, chat, meeting locals, blocking and reports |

## Running locally

**Backend** (http://127.0.0.1:8000):

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (http://localhost:5173/trip-planner/):

```bash
cd frontend
npm install
npm run dev
```

**Tests:**

```bash
cd backend && pytest
cd frontend && npm test && npm run lint
```

## Deploying

- **Frontend** – every push to `main` builds `frontend/` and publishes it to GitHub Pages
  (`.github/workflows/deploy.yml`). The repository variable `VITE_API_URL` holds the backend address.
- **Backend** – `backend/Dockerfile`, listening on `$PORT`. On Render's free plan the SQLite database is wiped on
  restart; mount a volume at `/data` to keep it.
  Optional environment variables: `TICKETMASTER_API_KEY` (events), `ADMIN_TOKEN` (`GET /safety/reports`).
- **Tests** run on every push and pull request (`.github/workflows/ci.yml`).

## Next steps

- Real flight and hotel prices (e.g. a small paid plan, cached once a day)
- A smarter split of days between countries (cheaper cities get more days)
- A database that survives restarts

---

# 🧳 Kelionių planuotojas

**„Turiu 500 € ir 8 dienas – kur galiu nukeliauti ir kiek šalių aplankyti?“**

Dauguma skrydžių paieškų ieško vieno maršruto A→B. Ši programa pradeda nuo biudžeto ir kelionės trukmės ir
parodo visas tinkamas keliones – į vieną miestą arba per kelias šalis iš eilės.

**[🔗 Atidaryti programą](https://vytautemartiit.github.io/trip-planner/)**

> Serveris veikia nemokamame Render plane ir nenaudojamas užmiega, todėl pirmoji paieška gali užtrukti apie minutę.

## Galimybės

- 🔍 **Paieška pagal biudžetą** – kelionės į vieną miestą arba per 2+ šalis, telpančios į biudžetą ir dienų skaičių
- 🛫 **32 išvykimo oro uostai** – kainos iš Vilniaus fiksuotos, iš kitų miestų įvertinamos pagal atstumą
- 💱 **Pasirinkta valiuta** – EUR, USD, GBP, PLN arba CZK pagal šiandienos ECB kursus; kainos ir biudžetas keičiasi kartu
- 🗺️ **Kelionės puslapis** – maršrutas žemėlapyje, dienų eiga ir išlaidų suskirstymas
- 🎫 **Mano bilietai** – išsaugotos kelionės arba įkeltas savo lėktuvo bilietas (PDF)
- 📅 **Kelionės informacija** – šventės ir festivaliai kelionės metu, kelionių patarimai ir reikalingi dokumentai
- 💬 **Keliautojų pokalbiai ir „Susitik su vietiniu“** – tik patvirtintą kelionę į tą šalį turintiems žmonėms, su blokavimu ir pranešimais
- 🌗 EN / LT, šviesi ir tamsi tema, veikia telefone ir įsidiegia kaip programa (PWA)

## Kaip skaičiuojama kaina

```
iš viso = skrydis + nakvynė × (dienos − 1) + dienos išlaidos × dienos
```

Kelioms šalims `itertools.combinations` sudaro visas miestų kombinacijas, dienos padalijamos kuo tolygiau ir
paliekamos tik į biudžetą telpančios kelionės.

## Iš kur duomenys

| Duomenys | Šaltinis | Tikri? |
|---|---|---|
| Skrydžių, viešbučių ir dienos kainos | `backend/data.py` (8 miestai) | ❌ pavyzdinės kainos |
| Valiutų kursai | [Frankfurter](https://frankfurter.dev) (ECB) | ✅ kasdien |
| Valstybinės šventės | [Nager.Date](https://date.nager.at) | ✅ |
| Kelionių patarimai | [GOV.UK](https://www.gov.uk/foreign-travel-advice) | ✅ |
| Koncertai ir renginiai | Ticketmaster Discovery API (reikia rakto) | ✅ nebūtina |
| Nuotraukos ir žemėlapis | Wikimedia Commons, OpenStreetMap | ✅ |

Tikrų skrydžių ir viešbučių kainų nemokamai gauti nepavyksta: Amadeus 2026 m. liepą uždarė nemokamą API, o
dauguma kitų tiekėjų yra mokami arba tik partneriams.

## Technologijos

- **Frontend:** React 19, Vite, Leaflet, lucide-react; savas CSS (be UI bibliotekų); Vitest
- **Backend:** Python 3.12, FastAPI, SQLite, pypdf; pytest
- **Talpinimas:** GitHub Pages (frontend), Render (backend, Docker); GitHub Actions testams ir diegimui

API, paleidimo lokaliai ir diegimo instrukcijos – [angliškoje dalyje](#api) (komandos tos pačios).

## Tolimesni žingsniai

- Tikros skrydžių ir viešbučių kainos (pvz., mažas mokamas planas, atnaujinamas kartą per dieną)
- Protingesnis dienų padalijimas tarp šalių (pigesniuose miestuose – daugiau dienų)
- Duomenų bazė, kuri nedingsta po serverio perkrovimo
