import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { CONTACT_URL, UPDATED } from '../site'
import { getLang, tr } from '../i18n'

function About() {
  return (
    <>
      <h1>About Trip Planner</h1>
      <p className="lead">
        Trip Planner shows you which European cities fit your budget and how many days you can spend there — and then
        helps you prepare: events on your dates, the official travel advice, the documents you need, and people to meet.
      </p>
      <h2>How prices work</h2>
      <p>
        Every trip adds up three parts: the flight, accommodation per night and everyday costs per day (food, local
        transport, a museum or two). Fares from Vilnius come from typical low-cost prices; from other airports they are
        estimated from the flight distance and marked with “~”. Prices are a guide for planning, not an offer — always
        check the final price where you book.
      </p>
      <h2>Meeting people safely</h2>
      <p>
        The travellers chat and Meet a local only show people who proved their trip with a real ticket, or who live in
        the city. You can hide, block or report anyone, and you decide who sees your trips.
      </p>
      <h2>Credits</h2>
      <ul>
        <li>City photos: Wikimedia Commons authors, credited under each photo (CC BY / CC BY-SA).</li>
        <li>Maps: © OpenStreetMap contributors.</li>
        <li>Travel advice: GOV.UK foreign travel advice (Open Government Licence).</li>
        <li>Public holidays: Nager.Date. Events: Ticketmaster (when enabled).</li>
        <li>Flags: flag-icons (MIT). Icons: Lucide (ISC). Fonts: Syne and Manrope (SIL Open Font Licence).</li>
      </ul>
    </>
  )
}

function Privacy() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="muted">Last updated {UPDATED}</p>
      <p className="lead">
        You can use Trip Planner without an account. If you create one, we keep only what the features need, and you
        can delete all of it at any time.
      </p>
      <h2>Without an account</h2>
      <p>
        Your saved tickets, your departure airport and similar settings stay in your browser&apos;s storage on this
        device. Nothing is sent to us except your searches (budget, days, airport), which are not stored.
      </p>
      <h2>With an account we store</h2>
      <ul>
        <li>Your username, display name, a scrambled (hashed) password, home country and languages.</li>
        <li>Your saved tickets, so they appear on all your devices.</li>
        <li>If you turn on Meet travellers: the cities and dates of those trips, and the messages you send.</li>
        <li>
          If you verify a trip: whether it&apos;s verified and a fingerprint (SHA-256) of the ticket file, so the same
          ticket can&apos;t be used twice. The PDF itself is read once and then thrown away — it is never saved.
        </li>
        <li>If you use Meet a local: your local profile, meet-up requests and your conversations.</li>
        <li>Reports you send and people you block. A reported person never learns who reported them.</li>
      </ul>
      <h2>Who sees what</h2>
      <p>
        Other members see only your display name, country, languages and, in the chat, the cities and dates you shared.
        Booking references, flight numbers and ticket files are never shown to anyone. We don&apos;t sell data or show
        ads.
      </p>
      <h2>Other services</h2>
      <p>
        Photos load from Wikimedia, maps from OpenStreetMap. Our server asks GOV.UK, Nager.Date and (if enabled)
        Ticketmaster for travel information — only the city and dates are sent, never who you are.
      </p>
      <h2>Your rights</h2>
      <p>
        You can see and change your profile under <em>Edit profile</em>, turn the chat off (which deletes your
        messages), and delete your account with <em>Delete account</em> — this removes everything listed above at once.
        Questions? <a href={CONTACT_URL}>Contact us</a>.
      </p>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="muted">Last updated {UPDATED}</p>
      <h2>Who can use it</h2>
      <p>You must be 18 or older to create an account, use the chat or meet people.</p>
      <h2>Prices and information</h2>
      <p>
        Trip Planner is a planning tool, not a travel agency: we don&apos;t sell tickets or rooms. Prices, events,
        travel advice and document requirements are shown in good faith but can be incomplete or out of date. Always
        check official sources (your airline, embassy and the destination&apos;s government) before you travel.
      </p>
      <h2>Behaving well</h2>
      <ul>
        <li>Be honest: only share trips you are really taking, and only verify tickets that are yours.</li>
        <li>No harassment, hate, sexual messages, spam, advertising, or asking for money or personal documents.</li>
        <li>Don&apos;t share other people&apos;s personal information.</li>
      </ul>
      <p>We can remove messages and close accounts that break these rules, especially after reports.</p>
      <h2>Meeting people</h2>
      <p>
        Members are responsible for their own meetings. Meet in busy public places, tell someone where you&apos;re
        going, and never hand over your passport or money. Verification shows that someone has a ticket — not who
        they are. If you feel unsafe, leave and call 112.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms; the date above shows the latest version. Questions? <a href={CONTACT_URL}>Contact us</a>.
      </p>
    </>
  )
}

const PAGES = { about: About, privacy: Privacy, terms: Terms }

/** About, Privacy and Terms. */
export default function InfoPage({ page, onBack }) {
  const Page = PAGES[page] || About
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])
  return (
    <article className="info-page">
      <button type="button" className="link back-link" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> {tr('Back to trips')}
      </button>
      {getLang() !== 'en' && (
        <p className="info-note" lang="lt">
          {tr('This page is only in English for now.')}
        </p>
      )}
      <div lang="en">
        <Page />
      </div>
    </article>
  )
}
