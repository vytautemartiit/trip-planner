import { Plane } from 'lucide-react'
import { CONTACT_URL, SITE_NAME, SOURCE_URL } from '../site'
import { tr } from '../i18n'

export default function Footer({ onGo }) {
  const link = (view, label) => (
    <a
      href={`#/${view}`}
      onClick={(e) => {
        e.preventDefault()
        onGo(view)
        window.scrollTo({ top: 0 })
      }}
    >
      {label}
    </a>
  )

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <span className="brand-mark" aria-hidden="true">
            <Plane />
          </span>
          <div>
            <strong>{SITE_NAME}</strong>
            <span>{tr("Budget trips across Europe, planned in a minute.")}</span>
          </div>
        </div>
        <nav className="footer-links" aria-label={tr("Footer")}>
          <div>
            <span className="footer-head">{tr("Plan")}</span>
            {link('explore', tr('Find trips'))}
            {link('tickets', tr('My tickets'))}
            {link('chat', tr('Meet travellers'))}
          </div>
          <div>
            <span className="footer-head">{tr("About")}</span>
            {link('about', tr('How it works'))}
            {link('privacy', tr('Privacy'))}
            {link('terms', tr('Terms'))}
          </div>
          <div>
            <span className="footer-head">{tr("Contact")}</span>
            <a href={CONTACT_URL} target="_blank" rel="noreferrer">
              {tr("Send feedback")}
            </a>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              {tr("Source code")}
            </a>
          </div>
        </nav>
      </div>
      <p className="footer-fine">
        © {new Date().getFullYear()} {SITE_NAME} · Prices are estimates for planning, not offers · Photos: Wikimedia
        Commons (CC BY / CC BY-SA) · Map data © OpenStreetMap contributors
      </p>
    </footer>
  )
}
