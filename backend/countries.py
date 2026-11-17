"""
Where travellers can be from, which languages they can speak, and the entry rules that apply to
them for the planner's destinations. Every destination is in the Schengen area, so one set of
rules covers all of them.

Groups:
  eu            – EU / EEA / Swiss citizens: free movement, a national ID card is enough
  visa_free     – no visa for up to 90 days in any 180 (Schengen "Annex II" countries)
  visa_required – a Schengen visa is needed

This is general guidance, not legal advice; the response always links to the official sources.
"""

EU = {
    "AT": "Austria", "BE": "Belgium", "BG": "Bulgaria", "HR": "Croatia", "CY": "Cyprus", "CZ": "Czechia",
    "DK": "Denmark", "EE": "Estonia", "FI": "Finland", "FR": "France", "DE": "Germany", "GR": "Greece",
    "HU": "Hungary", "IE": "Ireland", "IT": "Italy", "LV": "Latvia", "LT": "Lithuania", "LU": "Luxembourg",
    "MT": "Malta", "NL": "Netherlands", "PL": "Poland", "PT": "Portugal", "RO": "Romania", "SK": "Slovakia",
    "SI": "Slovenia", "ES": "Spain", "SE": "Sweden", "IS": "Iceland", "LI": "Liechtenstein", "NO": "Norway",
    "CH": "Switzerland",
}

VISA_FREE = {
    "AL": "Albania", "AD": "Andorra", "AR": "Argentina", "AU": "Australia", "BA": "Bosnia and Herzegovina",
    "BR": "Brazil", "CA": "Canada", "CL": "Chile", "CO": "Colombia", "CR": "Costa Rica", "GE": "Georgia",
    "HK": "Hong Kong", "IL": "Israel", "JP": "Japan", "KR": "South Korea", "MY": "Malaysia", "MX": "Mexico",
    "MD": "Moldova", "MC": "Monaco", "ME": "Montenegro", "NZ": "New Zealand", "MK": "North Macedonia",
    "PA": "Panama", "PY": "Paraguay", "PE": "Peru", "SM": "San Marino", "RS": "Serbia", "SG": "Singapore",
    "TW": "Taiwan", "AE": "United Arab Emirates", "UA": "Ukraine", "GB": "United Kingdom",
    "US": "United States", "UY": "Uruguay", "VA": "Vatican City",
}

# Visa-free only with a biometric passport
BIOMETRIC_ONLY = {"AL", "BA", "GE", "MD", "ME", "MK", "RS", "UA"}

VISA_REQUIRED = {
    "AM": "Armenia", "AZ": "Azerbaijan", "BD": "Bangladesh", "BY": "Belarus", "CN": "China", "EG": "Egypt",
    "IN": "India", "ID": "Indonesia", "IR": "Iran", "KZ": "Kazakhstan", "MA": "Morocco", "NG": "Nigeria",
    "PK": "Pakistan", "PH": "Philippines", "RU": "Russia", "SA": "Saudi Arabia", "ZA": "South Africa",
    "TH": "Thailand", "TN": "Tunisia", "TR": "Turkey", "UZ": "Uzbekistan", "VN": "Vietnam",
}

COUNTRIES = {**EU, **VISA_FREE, **VISA_REQUIRED}

LANGUAGES = {
    "lt": "Lithuanian", "en": "English", "lv": "Latvian", "et": "Estonian", "pl": "Polish", "ru": "Russian",
    "uk": "Ukrainian", "be": "Belarusian", "de": "German", "fr": "French", "es": "Spanish", "ca": "Catalan",
    "it": "Italian", "pt": "Portuguese", "nl": "Dutch", "cs": "Czech", "sk": "Slovak", "hu": "Hungarian",
    "el": "Greek", "ro": "Romanian", "bg": "Bulgarian", "hr": "Croatian", "sr": "Serbian", "sl": "Slovenian",
    "sv": "Swedish", "no": "Norwegian", "da": "Danish", "fi": "Finnish", "ga": "Irish", "tr": "Turkish",
    "ar": "Arabic", "he": "Hebrew", "hi": "Hindi", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
    "ka": "Georgian", "hy": "Armenian", "sq": "Albanian", "mk": "Macedonian",
}


def group_of(code):
    if code in EU:
        return "eu"
    if code in VISA_FREE:
        return "visa_free"
    if code in VISA_REQUIRED:
        return "visa_required"
    return None


SOURCES = [
    {"title": "Your Europe – travel documents for EU citizens",
     "url": "https://europa.eu/youreurope/citizens/travel/entry-exit/eu-citizen/index_en.htm"},
    {"title": "Your Europe – entry rules for non-EU nationals",
     "url": "https://europa.eu/youreurope/citizens/travel/entry-exit/non-eu-nationals/index_en.htm"},
    {"title": "EES and ETIAS – official EU site", "url": "https://travel-europe.europa.eu/"},
]


def document_requirements(nationality, start_date, end_date, destination_countries):
    """
    nationality: ISO code of the passport; start/end: datetime.date of leaving and coming back;
    destination_countries: ISO codes of the countries visited. Returns a dict for the API.
    """
    group = group_of(nationality)
    if group is None:
        raise ValueError("unknown nationality")
    days = (end_date - start_date).days + 1
    items = []

    def add(title, detail, level="required"):
        items.append({"title": title, "detail": detail, "level": level})

    if group == "eu":
        add("Valid passport or national ID card",
            "As an EU/EEA/Swiss citizen you can travel with either one. It must be valid for the whole trip — "
            "an expired document is not accepted, and some airlines are strict about this.")
        add("No visa needed", "You have the right to free movement, so there is no visa and no 90-day limit "
            "for a holiday.", "info")
        add("European Health Insurance Card (EHIC)",
            "Free card from your health insurer. It covers necessary public healthcare at local prices.", "recommended")
        add("Travel insurance", "Covers what the EHIC doesn't: private clinics, repatriation, cancelled flights.",
            "recommended")
        if nationality in destination_countries:
            add("You're going to your own country", "No border formalities apply for you there.", "info")
        return {"group": group, "days": days, "items": items, "sources": SOURCES}

    add("Passport",
        f"Issued within the last 10 years and valid until at least {_plus_months(end_date, 3).isoformat()} "
        "(3 months after you leave the Schengen area). It needs two blank pages.")
    if group == "visa_free":
        if nationality in BIOMETRIC_ONLY:
            add("Biometric passport", "Visa-free travel only applies with a biometric (chip) passport. "
                "With an older passport you need a Schengen visa.")
        add("No visa for short trips",
            "You can stay up to 90 days in any 180-day period across all Schengen countries.", "info")
        if days > 90:
            add("Your trip is longer than 90 days",
                f"This trip lasts {days} days, which is over the visa-free limit. You need a national long-stay "
                "visa or residence permit.", "warning")
        add("ETIAS travel authorisation",
            "The EU is introducing ETIAS, an online authorisation (€20, valid 3 years) for visa-free visitors. "
            "Check on the official site whether it is already required on your travel dates.", "check")
    else:
        add("Schengen visa (type C)",
            "Apply at the consulate of the country where you spend the most nights — or, if equal, the first "
            "country you enter. Apply 15 days to 6 months before travelling.")
        add("Travel medical insurance",
            "Required for the visa: at least €30,000 of cover, valid in all Schengen countries for the whole trip.")
        add("Supporting documents",
            "Usually: return ticket, hotel bookings, proof of enough money, and a letter from your employer or school.")
        if days > 90:
            add("Your trip is longer than 90 days",
                f"This trip lasts {days} days. A short-stay visa covers at most 90 days; you need a national visa.",
                "warning")
    add("Entry/Exit System (EES)",
        "At the first Schengen border your fingerprints and photo are registered, and your passport is no longer "
        "stamped. Allow extra time at the airport.", "info")
    add("Travel insurance", "Strongly advised — healthcare for visitors can be expensive.", "recommended")
    return {"group": group, "days": days, "items": items, "sources": SOURCES}


def _plus_months(d, months):
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    days_in = [31, 29 if year % 4 == 0 and (year % 100 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30,
               31, 30, 31][month - 1]
    return d.replace(year=year, month=month, day=min(d.day, days_in))
