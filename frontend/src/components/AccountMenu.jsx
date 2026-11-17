import { useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle, UserRound } from 'lucide-react'
import { tr } from '../i18n'

const SYNC_TEXT = {
  saved: [CircleCheck, 'Tickets synced to your account'],
  error: [CircleAlert, 'Couldn’t sync tickets — will retry on the next change'],
  idle: [LoaderCircle, 'Syncing tickets…'],
}

function SyncLine({ state }) {
  const [Icon, text] = SYNC_TEXT[state] || SYNC_TEXT.idle
  return (
    <p className={`account-sync ${state}`}>
      <Icon aria-hidden="true" /> {tr(text)}
    </p>
  )
}

export default function AccountMenu({ user, syncState, onLogIn, onLogOut, onRename, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  if (!user) {
    return (
      <button type="button" className="account-btn login" onClick={onLogIn} aria-label={tr("Log in")}>

        <UserRound aria-hidden="true" />
        <span className="tab-long">{tr("Log in")}</span>
      </button>
    )
  }

  const pick = (fn) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="account-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={`Logged in as ${user.username}`}
      >
        <span className="account-initial" aria-hidden="true">
          {user.display_name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="tab-long account-name">{user.display_name}</span>
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <strong>{user.display_name}</strong>
            <span>@{user.username}</span>
          </div>
          <SyncLine state={syncState} />
          <button type="button" role="menuitem" onClick={pick(onRename)}>
            {tr("Edit profile")}
          </button>
          <button type="button" role="menuitem" onClick={pick(onLogOut)}>
            {tr("Log out")}
          </button>
          <button type="button" role="menuitem" className="danger" onClick={pick(onDelete)}>
            {tr("Delete account…")}
          </button>
        </div>
      )}
    </div>
  )
}
