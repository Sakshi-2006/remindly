'use client'

import { useMemo, useState } from 'react'
import {
  Activity, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Clock3, Download, LayoutDashboard, Mail, MoreHorizontal,
  Plus, Search, Send, Settings2, Sparkles, Users, X,
} from 'lucide-react'

type Message = { id: number; initials: string; name: string; email: string; subject: string; campaign: string; time: string; status: 'Delivered' | 'Scheduled' | 'Failed'; color: string }
type Reminder = { id: number; title: string; person: string; date: string; time: string; kind: string; done?: boolean }

const initialMessages: Message[] = [
  { id: 1, initials: 'SC', name: 'Sarah Chen', email: 'sarah.chen@email.com', subject: 'Your design review is tomorrow', campaign: 'Project follow-up', time: 'Today, 10:42 AM', status: 'Delivered', color: 'sage' },
  { id: 2, initials: 'JM', name: 'James Miller', email: 'james.m@email.com', subject: 'A quick reminder about your invoice', campaign: 'Payment reminders', time: 'Today, 10:18 AM', status: 'Delivered', color: 'lavender' },
  { id: 3, initials: 'AP', name: 'Ava Patel', email: 'ava.patel@email.com', subject: 'Workshop starts in one hour', campaign: 'Workshop series', time: 'Today, 9:30 AM', status: 'Scheduled', color: 'peach' },
  { id: 4, initials: 'DW', name: 'Daniel Wilson', email: 'daniel.w@email.com', subject: 'Thanks for joining us, Daniel', campaign: 'Welcome sequence', time: 'Today, 9:12 AM', status: 'Failed', color: 'blue' },
  { id: 5, initials: 'ER', name: 'Emma Rivera', email: 'emma.r@email.com', subject: 'Your weekly team update', campaign: 'Team updates', time: 'Yesterday, 4:05 PM', status: 'Delivered', color: 'rose' },
]
const initialReminders: Reminder[] = [
  { id: 1, title: 'Design review with product team', person: 'Sarah Chen · Project follow-up', date: 'Today', time: '2:30 PM', kind: 'Meeting' },
  { id: 2, title: 'Workshop: Getting started with Figma', person: '24 contacts · Workshop series', date: 'Today', time: '4:00 PM', kind: 'Workshop' },
  { id: 3, title: 'Invoice payment due', person: 'James Miller · Payment reminders', date: 'Tomorrow', time: '9:00 AM', kind: 'Payment' },
]
const navItems = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Campaigns', icon: Send, count: '4' },
  { name: 'Reminders', icon: CalendarDays, count: '8' },
  { name: 'Contacts', icon: Users },
]

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button><div className="modal-heading"><div className="modal-symbol"><Plus size={19} /></div><h2 id="modal-title">{title}</h2><p>{description}</p></div>{children}</section></div>
}

export default function Page() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [messages, setMessages] = useState(initialMessages)
  const [reminders, setReminders] = useState(initialReminders)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All activity')
  const [modal, setModal] = useState<'reminder' | 'campaign' | 'contact' | null>(null)
  const [toast, setToast] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const filteredMessages = useMemo(() => messages.filter((message) => `${message.name} ${message.email} ${message.subject} ${message.campaign}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All activity' || message.status === filter)), [messages, query, filter])

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 3200) }
  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (modal === 'reminder') {
      setReminders((current) => [{ id: Date.now(), title: subject, person: `${name} · Personal reminder`, date: date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Tomorrow', time: time || '9:00 AM', kind: 'Reminder' }, ...current])
      notify('Your reminder has been scheduled.')
    } else if (modal === 'campaign') {
      setMessages((current) => [{ id: Date.now(), initials: 'YO', name: name || 'New campaign', email: email || 'Draft campaign', subject: subject || 'New campaign draft', campaign: 'Just created', time: 'Just now', status: 'Scheduled', color: 'sage' }, ...current])
      notify('Campaign draft created.')
    } else {
      setMessages((current) => [{ id: Date.now(), initials: name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'NC', name, email, subject: 'Contact added to your list', campaign: 'New contact', time: 'Just now', status: 'Delivered', color: 'sage' }, ...current])
      notify('Contact added successfully.')
    }
    setModal(null); setName(''); setEmail(''); setSubject(''); setDate(''); setTime('')
  }

  function exportReport() {
    const rows = [['Name', 'Email', 'Subject', 'Campaign', 'Status', 'Time'], ...messages.map((message) => [message.name, message.email, message.subject, message.campaign, message.status, message.time])]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'send-report.csv'; anchor.click(); URL.revokeObjectURL(url)
    notify('Your CSV report is ready to download.')
  }

  const openModal = (kind: 'reminder' | 'campaign' | 'contact') => setModal(kind)
  const title = activeNav === 'Overview' ? 'Good morning, Alex' : activeNav

  return <main className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#overview" aria-label="Nudge home"><span className="brand-mark"><Mail size={20} strokeWidth={2.2} /></span><span>nudge<span className="brand-dot">.</span></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <button className="workspace-switch"><span className="workspace-avatar">A</span><span className="workspace-copy"><strong>Acme Studio</strong><small>Free workspace</small></span><ChevronDown size={16} /></button>
      <div className="nav-section-label">MENU</div>
      <nav className="main-nav" aria-label="Main navigation">{navItems.map(({ name: item, icon: Icon, count }) => <button key={item} className={`nav-item ${activeNav === item ? 'active' : ''}`} onClick={() => { setActiveNav(item); setMobileMenu(false) }}><Icon size={18} strokeWidth={1.8} /><span>{item}</span>{count && <span className="nav-count">{count}</span>}</button>)}</nav>
      <div className="nav-section-label tools-label">PREFERENCES</div>
      <button className="nav-item" onClick={() => notify('Settings are ready to configure.')}><Settings2 size={18} strokeWidth={1.8} /><span>Settings</span></button>
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon"><Sparkles size={15} /></div><strong>Make more happen</strong><p>You&apos;ve used 68% of your monthly sends.</p><div className="plan-progress"><span /></div><div className="plan-foot"><span>680 of 1,000 emails</span><button onClick={() => notify('You are on the Free plan.')}>Upgrade <ArrowRight size={12} /></button></div></div><button className="help-link" onClick={() => notify('Help center opened.') }><CircleHelp size={17} /> Help &amp; support</button><button className="profile-button"><span className="profile-avatar">AM</span><span className="profile-copy"><strong>Alex Morgan</strong><small>alex@acmestudio.co</small></span><MoreHorizontal size={19} /></button></div>
    </aside>
    <div className="main-panel">
      <header className="topbar"><button className="mobile-menu-toggle icon-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu"><LayoutDashboard size={19} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div><div className="topbar-actions"><div className="date-chip"><CalendarDays size={15} /> Monday, November 23</div><button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify('You are all caught up.')}><Bell size={18} /><i /></button><div className="top-avatar">AM</div></div></header>
      <div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> YOUR WORKSPACE AT A GLANCE</div><h1>{title}<span className="wave">,</span></h1><p className="welcome-subtitle">Here&apos;s what&apos;s happening with your email automations today.</p></div><div className="welcome-actions"><button className="button-secondary" onClick={() => openModal('reminder')}><CalendarDays size={16} /> New reminder</button><button className="button-primary" onClick={() => openModal('campaign')}><Plus size={17} /> Create campaign</button></div></div>
        <section className="metrics-grid" aria-label="Email performance summary">
          <article className="metric-card"><div className="metric-top"><span className="metric-label">Emails sent</span><span className="metric-icon green"><Send size={17} /></span></div><div className="metric-value">2,486</div><div className="metric-foot"><span className="change positive"><ArrowUpRight size={13} /> 12.8%</span><span>vs. last month</span><span className="sparkline"><svg viewBox="0 0 92 30" fill="none" aria-label="Sent emails trending upward"><path d="M1 24L12 19L22 23L32 14L42 19L53 10L63 14L74 6L83 10L91 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span></div></article>
          <article className="metric-card"><div className="metric-top"><span className="metric-label">Delivery rate</span><span className="metric-icon lavender"><Activity size={17} /></span></div><div className="metric-value">98.4<span className="metric-unit">%</span></div><div className="metric-foot"><span className="change positive"><ArrowUpRight size={13} /> 2.4%</span><span>vs. last month</span><span className="sparkline purple"><svg viewBox="0 0 92 30" fill="none" aria-label="Delivery rate trending upward"><path d="M1 24L12 18L22 21L32 15L42 18L53 8L63 13L74 7L83 9L91 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span></div></article>
          <article className="metric-card"><div className="metric-top"><span className="metric-label">Active reminders</span><span className="metric-icon amber"><Clock3 size={17} /></span></div><div className="metric-value">18</div><div className="metric-foot"><span className="metric-note"><span className="tiny-dot amber-dot" /> 3 due today</span><span>across 4 campaigns</span><span className="sparkline amber-line"><svg viewBox="0 0 92 30" fill="none" aria-label="Upcoming reminders"><path d="M1 24L12 19L22 21L32 13L42 17L53 8L63 14L74 5L83 9L91 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span></div></article>
          <article className="metric-card"><div className="metric-top"><span className="metric-label">Active contacts</span><span className="metric-icon blue"><Users size={17} /></span></div><div className="metric-value">1,204</div><div className="metric-foot"><span className="change positive"><ArrowUpRight size={13} /> 8.1%</span><span>vs. last month</span><span className="sparkline blue-line"><svg viewBox="0 0 92 30" fill="none" aria-label="Contacts trending upward"><path d="M1 25L12 22L22 18L32 21L42 12L53 15L63 8L74 12L83 5L91 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span></div></article>
        </section>
        <section className="middle-grid">
          <article className="panel performance-panel"><div className="panel-heading"><div><h2>Delivery overview</h2><p>A look at your email performance</p></div><button className="select-button" onClick={() => notify('Showing the last 7 days.')}>Last 7 days <ChevronDown size={14} /></button></div><div className="chart-summary"><strong>1,842</strong><span>emails delivered</span><span className="change positive"><ArrowUpRight size={13} /> 14.6%</span></div><div className="chart" role="img" aria-label="Line chart showing emails sent and delivered across the week"><div className="chart-y-labels"><span>600</span><span>450</span><span>300</span><span>150</span><span>0</span></div><div className="chart-content"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><svg className="chart-svg" viewBox="0 0 720 170" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#51896e" stopOpacity=".16" /><stop offset="100%" stopColor="#51896e" stopOpacity="0" /></linearGradient></defs><path d="M0 139C38 130 54 116 92 119S142 131 184 106S246 105 276 85S333 105 368 80S422 68 460 84S520 58 552 47S610 59 644 34S687 43 720 15V170H0Z" fill="url(#chart-fill)"/><path d="M0 139C38 130 54 116 92 119S142 131 184 106S246 105 276 85S333 105 368 80S422 68 460 84S520 58 552 47S610 59 644 34S687 43 720 15" fill="none" stroke="#558b72" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/><path d="M0 153C38 149 56 135 92 140S145 145 184 126S244 132 276 108S337 120 368 103S424 92 460 107S520 82 552 69S609 78 644 57S689 62 720 41" fill="none" stroke="#b5a6d8" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke"/><circle cx="552" cy="47" r="4" fill="#558b72" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><div className="chart-x-labels"><span>Mon, 17</span><span>Tue, 18</span><span>Wed, 19</span><span>Thu, 20</span><span>Fri, 21</span><span>Sat, 22</span><span>Sun, 23</span></div></div></div><div className="chart-legend"><span><i className="legend-green" /> Delivered</span><span><i className="legend-purple" /> Scheduled</span><span className="chart-period">Updated just now</span></div></article>
          <article className="panel reminders-panel"><div className="panel-heading"><div><h2>Upcoming reminders</h2><p>What&apos;s coming up next</p></div><button className="icon-button subtle-icon" aria-label="More reminder options" onClick={() => notify('Reminder options opened.')}><MoreHorizontal size={19} /></button></div><div className="reminders-list">{reminders.slice(0, 4).map((reminder, index) => <div className="reminder-row" key={reminder.id}><div className={`reminder-date date-tone-${index % 3}`}><span>{reminder.date === 'Today' ? 'TODAY' : reminder.date.toUpperCase()}</span><strong>{reminder.time}</strong></div><div className="reminder-info"><strong>{reminder.title}</strong><span>{reminder.person}</span></div><button className="reminder-more icon-button" aria-label={`Mark ${reminder.title} complete`} onClick={() => { setReminders((current) => current.filter((item) => item.id !== reminder.id)); notify('Reminder marked complete.') }}><Check size={16} /></button></div>)}</div><button className="view-all" onClick={() => setActiveNav('Reminders')}>View all reminders <ArrowRight size={14} /></button></article>
        </section>
        <section className="panel activity-panel"><div className="panel-heading activity-heading"><div><h2>Recent activity</h2><p>Keep track of every message, all in one place</p></div><div className="activity-actions"><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity..." aria-label="Search activity" /><kbd>⌘ K</kbd></label><select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by message status"><option>All activity</option><option>Delivered</option><option>Scheduled</option><option>Failed</option></select><button className="export-button" onClick={exportReport}><Download size={15} /> Export</button></div></div><div className="table-wrap"><table><thead><tr><th>RECIPIENT</th><th>SUBJECT</th><th>CAMPAIGN</th><th>TIME</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredMessages.map((message) => <tr key={message.id}><td><div className="recipient-cell"><span className={`recipient-avatar avatar-${message.color}`}>{message.initials}</span><span className="recipient-copy"><strong>{message.name}</strong><small>{message.email}</small></span></div></td><td className="subject-cell">{message.subject}</td><td><span className="campaign-tag">{message.campaign}</span></td><td className="time-cell">{message.time}</td><td><span className={`status-badge status-${message.status.toLowerCase()}`}><i />{message.status}</span></td><td><button className="row-more icon-button" aria-label={`More options for ${message.name}`} onClick={() => notify(`Message details for ${message.name}`)}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{filteredMessages.length === 0 && <div className="no-results"><Search size={20} /><strong>No activity found</strong><span>Try another search or change the status filter.</span></div>}</div><div className="table-footer"><span>Showing <strong>{filteredMessages.length}</strong> of <strong>{messages.length}</strong> messages</span><div className="pagination"><button className="icon-button" aria-label="Previous page" disabled><ChevronLeft size={15} /></button><button className="page-number">1</button><button className="icon-button" aria-label="Next page" disabled><ChevronRight size={15} /></button></div></div></section>
        <footer className="page-footer"><span><span className="live-dot" /> All systems operational</span><span>Last synced 2 minutes ago <span className="footer-divider">·</span> <button onClick={() => notify('You are viewing the demo workspace.')}>View send report <ArrowUpRight size={12} /></button></span></footer>
      </div>
    </div>
    {mobileMenu && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
    {modal && <Modal title={modal === 'reminder' ? 'Schedule a reminder' : modal === 'campaign' ? 'Create a campaign' : 'Add a contact'} description={modal === 'reminder' ? 'We’ll send a timely nudge so nothing slips through.' : modal === 'campaign' ? 'Start with the basics. You can fine-tune your message next.' : 'Add someone to your workspace contact list.'} onClose={() => setModal(null)}><form onSubmit={submitForm} className="modal-form">{modal !== 'campaign' && <label>Your name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Jordan Lee" /></label>}{modal !== 'reminder' && <label>{modal === 'campaign' ? 'Campaign name' : 'Email address'}<input required type={modal === 'contact' ? 'email' : 'text'} value={modal === 'contact' ? email : name} onChange={(event) => modal === 'contact' ? setEmail(event.target.value) : setName(event.target.value)} placeholder={modal === 'contact' ? 'jordan@example.com' : 'e.g. Welcome sequence'} /></label>}{modal === 'reminder' && <label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jordan@example.com" /></label>}<label>{modal === 'reminder' ? 'What should we remind them about?' : 'Email subject'}<input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={modal === 'reminder' ? 'e.g. Team standup' : 'e.g. Your weekly update'} /></label>{modal === 'reminder' && <div className="form-two-col"><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div>}<div className="modal-note"><CheckCircle2 size={15} /> Demo mode is on. No real emails will be sent.</div><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="button-primary">{modal === 'reminder' ? 'Schedule reminder' : modal === 'campaign' ? 'Create draft' : 'Add contact'} <ArrowRight size={15} /></button></div></form></Modal>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
  </main>
}
