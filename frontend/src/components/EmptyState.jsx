/**
 * A friendly "nothing here" / "something went wrong" panel with an icon, a short explanation
 * and buttons that fix the problem.
 * Put the buttons inside it as children.
 */
export default function EmptyState({ icon: Icon, title, text, children, tone = 'neutral' }) {
  return (
    <div className={`empty-state ${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {Icon && (
        <span className="empty-icon" aria-hidden="true">
          <Icon />
        </span>
      )}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  )
}
