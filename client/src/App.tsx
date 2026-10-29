import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import type { Application, Job, Role, User } from './types'
import './App.css'

const Map3D = lazy(() => import('./Map3D').then((module) => ({ default: module.Map3D })))
type Page = 'home' | 'jobs' | 'map' | 'post' | 'applications' | 'my-jobs' | 'profile' | 'helper' | 'rules'
const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const categories = ['Construction', 'Cleaning', 'Cooking', 'Driving', 'Electrical', 'Plumbing', 'Farm work', 'Other']

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('kc-token')
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  }).catch((reason: unknown) => {
    if (reason instanceof TypeError) {
      throw new Error('Can’t reach the DL Connect API. Start the Java backend and try again.')
    }
    throw reason
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; detail?: string; error?: string } | null
    throw new Error(body?.message || body?.detail || body?.error || `Request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState<Page>('home')
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register')
  const [role, setRole] = useState<Role>('WORKER')
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [chat, setChat] = useState<{ who: 'you' | 'helper'; text: string }[]>([
    { who: 'helper', text: 'Hello! I can help you find work, apply for a job, or understand the labour rules.' },
  ])
  const [chatInput, setChatInput] = useState('')

  const refresh = useCallback(async (current: User) => {
    const [allJobs, mine] = await Promise.all([
      request<Job[]>(current.role === 'EMPLOYER' ? '/jobs/mine' : '/jobs'),
      request<Application[]>(current.role === 'WORKER' ? '/applications/mine' : '/applications/for-employer'),
    ])
    setJobs(allJobs)
    setApplications(mine)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('kc-token')
    if (!token) return
    request<User>('/users/me').then(async (current) => {
      setUser(current)
      await refresh(current)
    }).catch(() => localStorage.removeItem('kc-token'))
  }, [refresh])

  useEffect(() => {
    if (page !== 'map' || !locationEnabled) return
    let watchId: string | undefined
    let active = true
    Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }, (position, reason) => {
      if (position) setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      else if (reason) setError(`Live location stopped: ${reason.message}`)
    }).then((id) => {
      if (active) watchId = id
      else void Geolocation.clearWatch({ id })
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Live location is unavailable.'))
    return () => {
      active = false
      if (watchId) void Geolocation.clearWatch({ id: watchId })
    }
  }, [locationEnabled, page])

  const showError = (reason: unknown) => setError(reason instanceof Error ? reason.message : 'Something went wrong')
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (reason) { showError(reason) } finally { setBusy(false) }
  }
  const visibleJobs = useMemo(() => jobs.filter((job) => {
    const value = `${job.title} ${job.category} ${job.place}`.toLowerCase()
    return !job.closed && value.includes(query.toLowerCase())
  }), [jobs, query])
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget).entries())
    await run(async () => {
    const body = authMode === 'register' ? { ...values, role } : values
    const result = await request<{ token: string; user: User }>(`/auth/${authMode}`, {
      method: 'POST', body: JSON.stringify(body),
      })
      localStorage.setItem('kc-token', result.token)
      setUser(result.user); setPage('home'); await refresh(result.user)
    })
  }
  const signOut = () => {
    localStorage.removeItem('kc-token'); setUser(null); setJobs([]); setApplications([])
  }
  const apply = (job: Job) => run(async () => {
    await request('/applications', { method: 'POST', body: JSON.stringify({ jobId: job.id }) })
    if (user) await refresh(user)
    setNotice(`Application sent for ${job.title}.`)
  })
  const changeApplication = (id: string, status: string) => run(async () => {
    await request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    if (user) await refresh(user)
  })
  const closeJob = (job: Job) => run(async () => {
    await request(`/jobs/${job.id}/close`, { method: 'PATCH' })
    if (user) await refresh(user)
    setNotice(`${job.title} is now closed.`)
  })
  const createJob = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    run(async () => {
      await request<Job>('/jobs', { method: 'POST', body: JSON.stringify({
        ...values, pay: Number(values.pay), workersNeeded: Number(values.workersNeeded),
        latitude: location?.latitude, longitude: location?.longitude,
      }) })
      if (user) await refresh(user)
      setNotice('Your job is now posted.')
      form.reset()
      setPage('my-jobs')
    })
  }
  const locate = () => {
    setError('')
    Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 })
      .then(({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude })
        setLocationEnabled(true)
      })
      .catch(() => setError('Location permission was denied. You can still browse jobs without it.'))
  }
  const askHelper = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = chatInput.trim()
    if (!text) return
    const queryText = text.toLowerCase()
    let reply = 'Tell me the kind of work you want, or ask how to apply, post a job, or work safely.'
    if (queryText.includes('apply') || queryText.includes('application')) {
      reply = 'Workers can open Find work, choose a job, and tap Apply. Your applications and their status appear under Applications.'
    } else if (queryText.includes('post') || queryText.includes('hire')) {
      reply = 'Employers can choose Post a job, add the pay, work location and number of workers, then publish the listing.'
    } else if (queryText.includes('pay') || queryText.includes('wage')) {
      reply = 'Agree on the pay before work begins. The job listing should state the amount and when it will be paid.'
    } else if (queryText.includes('near') || queryText.includes('map') || queryText.includes('location')) {
      reply = 'Open Live map and choose Use my location. Location is optional; jobs without map coordinates still appear in the job list.'
    } else if (queryText.includes('rule') || queryText.includes('safe') || queryText.includes('age')) {
      reply = 'Everyone must be 18 or older. Work must be voluntary, legal, and paid as agreed. Open Labour rules for the full checklist.'
    }
    setChat((messages) => [...messages, { who: 'you', text }, { who: 'helper', text: reply }])
    setChatInput('')
  }

  if (!user) return <main className="auth-shell">
    <div className="brand"><img className="brand-mark" src="/logo.svg" alt="" /><span>DL<strong>Connect</strong></span></div>
    <section className="auth-card">
      <div className="eyebrow">WORK NEAR YOU, TODAY</div>
      <h1>{authMode === 'register' ? 'Find work. Find people.' : 'Welcome back.'}</h1>
      <p className="muted">A simpler way for local workers and employers to connect.</p>
      <div className="role-switch">
        <button className={role === 'WORKER' ? 'selected' : ''} onClick={() => setRole('WORKER')}>I need work</button>
        <button className={role === 'EMPLOYER' ? 'selected' : ''} onClick={() => setRole('EMPLOYER')}>I’m hiring</button>
      </div>
      <form onSubmit={signIn} className="form-stack">
        {authMode === 'register' && <label>Full name<input name="name" autoComplete="name" required minLength={2} /></label>}
        <label>Mobile number<input name="phone" type="tel" inputMode="numeric" autoComplete="tel" pattern="[6-9][0-9]{9}" placeholder="10-digit number" required /></label>
        <label>Password<input name="password" type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={8} required /></label>
        {authMode === 'register' && <>
          <label>Area or town<input name="area" autoComplete="address-level2" required /></label>
          {role === 'WORKER'
            ? <label>Main skill<select name="skill" required>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
            : <label>Business / employer name<input name="businessName" required /></label>}
          <label className="check"><input name="adultConfirmed" value="true" type="checkbox" required /> I confirm that I am 18 or older.</label>
          <label className="check"><input name="rulesAgreed" value="true" type="checkbox" required /> I agree to the labour rules.</label>
        </>}
        <button className="button primary wide" disabled={busy}>{busy ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Sign in'}</button>
      </form>
      <button className="text-button" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setError('') }}>
        {authMode === 'register' ? 'Already registered? Sign in' : 'New here? Create an account'}
      </button>
      {error && <p className="alert error">{error}</p>}
      <p className="auth-foot">By continuing, you agree to work safely and lawfully.</p>
    </section>
  </main>

  const nav: { id: Page; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '⌂' },
    { id: user.role === 'WORKER' ? 'jobs' : 'my-jobs', label: user.role === 'WORKER' ? 'Find work' : 'My jobs', icon: '▤' },
    { id: 'map', label: 'Live map', icon: '⌖' },
    ...(user.role === 'EMPLOYER' ? [{ id: 'post' as Page, label: 'Post a job', icon: '+' }] : [{ id: 'applications' as Page, label: 'Applications', icon: '✓' }]),
  ]
  const myJobs = jobs
  return <div className={`app-shell role-${user.role.toLowerCase()}`}>
    <header className="topbar"><button className="brand" onClick={() => setPage('home')}><img className="brand-mark" src="/logo.svg" alt="" /><span>DL<strong>Connect</strong></span></button>
      <div className="top-actions"><span className="welcome">Hi, {user.name.split(' ')[0]}</span><button className="avatar" aria-label="Profile" onClick={() => setPage('profile')}>{user.name[0]?.toUpperCase()}</button></div>
    </header>
    <main className="main-content">
      {error && <div className="alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
      {notice && <div className="alert success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
      {page === 'home' && <section className="welcome-panel">
        <div><div className="eyebrow">{user.role === 'WORKER' ? 'WORKER ACCOUNT' : 'EMPLOYER DASHBOARD'}</div>
          <h1>{user.role === 'WORKER' ? `Good day, ${user.name.split(' ')[0]}` : user.businessName || user.name}</h1>
          <p className="muted">{user.area} · {user.role === 'WORKER' ? user.skill : 'Find reliable local workers'}</p>
          <div className="button-row"><button className="button primary" onClick={() => setPage(user.role === 'WORKER' ? 'jobs' : 'post')}>{user.role === 'WORKER' ? 'Browse nearby jobs' : 'Post a job'}</button><button className="button secondary" onClick={() => setPage('map')}>Open live map</button></div>
        </div><div className="hero-art" aria-hidden="true"><span>✦</span><i>⌖</i></div>
      </section>}
      {page === 'home' && <section className="section"><div className="section-heading"><div><div className="eyebrow">NEAR YOU</div><h2>{user.role === 'WORKER' ? 'Jobs you may like' : 'Your open jobs'}</h2></div><button className="text-button" onClick={() => setPage(user.role === 'WORKER' ? 'jobs' : 'my-jobs')}>View all →</button></div>
        <JobList jobs={user.role === 'WORKER' ? visibleJobs.slice(0, 3) : myJobs.filter((job) => !job.closed).slice(0, 3)} onApply={apply} onClose={closeJob} applied={applications.map((item) => item.jobId)} role={user.role} />
      </section>}
      {page === 'home' && <div className="home-shortcuts"><button className="shortcut-card" onClick={() => setPage('helper')}><span>✦</span><strong>Ask DL Connect</strong><small>Get help finding or posting work</small></button><button className="shortcut-card" onClick={() => setPage('rules')}><span>✓</span><strong>Work safely</strong><small>Read the labour rules</small></button></div>}
      {page === 'jobs' && <section className="section"><div className="eyebrow">DISCOVER</div><h1>Find work nearby</h1><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search role, skill or area…" /><JobList jobs={visibleJobs} onApply={apply} applied={applications.map((item) => item.jobId)} role={user.role} /></section>}
      {page === 'map' && <section className="section"><div className="section-heading"><div><div className="eyebrow">OPENSTREETMAP · LIVE LOCATION</div><h1>Work around you</h1><p className="muted">Your location is only used on this device to center the map.</p></div><button className="button secondary" onClick={locate}>◎ {location ? 'Update location' : 'Use my location'}</button></div>
        <Suspense fallback={<div className="empty">Loading interactive map…</div>}><Map3D jobs={jobs.filter((job) => !job.closed)} location={location} onLocate={locate} /></Suspense>
      </section>}
      {page === 'post' && user.role === 'EMPLOYER' && <section className="section form-panel"><div className="eyebrow">HIRING LOCALLY</div><h1>Post a job</h1><p className="muted">Add a map location for workers to find the job nearby.</p>
        <form className="form-stack" onSubmit={createJob}>
          <label>Job name<input name="title" required maxLength={100} placeholder="e.g. Experienced electrician" /></label>
          <label>Work type<select name="category">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Duration<select name="type"><option>Daily</option><option>Weekly</option><option>Contract</option></select></label>
          <div className="two-cols"><label>Pay (₹ per day)<input name="pay" type="number" min="1" max="1000000" required /></label><label>Workers needed<input name="workersNeeded" type="number" min="1" max="1000" defaultValue="1" required /></label></div>
          <label>Work location<input name="place" required defaultValue={user.area} /></label>
          <button type="button" className="button secondary" onClick={locate}>{location ? '✓ Location attached' : '◎ Attach current location'}</button>
          <button className="button primary" disabled={busy}>{busy ? 'Posting…' : 'Publish job'}</button>
        </form></section>}
      {page === 'applications' && user.role === 'WORKER' && <section className="section"><div className="eyebrow">YOUR PROGRESS</div><h1>My applications</h1>
        {applications.length ? applications.map((item) => <article className="job-card" key={item.id}><div className="job-icon">✓</div><div className="job-main"><h3>{item.jobTitle}</h3><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></div></article>) : <Empty text="You haven’t applied to any jobs yet." action="Find work" onClick={() => setPage('jobs')} />}
      </section>}
      {page === 'my-jobs' && user.role === 'EMPLOYER' && <section className="section"><div className="section-heading"><div><div className="eyebrow">EMPLOYER</div><h1>My jobs & applicants</h1></div><button className="button primary" onClick={() => setPage('post')}>+ Post a job</button></div>
        <JobList jobs={myJobs} onApply={apply} onClose={closeJob} applied={[]} role={user.role} />
        {applications.map((item) => <article className="job-card applicant" key={item.id}><div className="job-icon">◉</div><div className="job-main"><h3>{item.workerName}</h3><p className="muted">Applied for {item.jobTitle}</p></div><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>{item.status === 'APPLIED' && <div className="button-row"><button className="button primary" onClick={() => changeApplication(item.id, 'ACCEPTED')}>Accept</button><button className="button secondary" onClick={() => changeApplication(item.id, 'REJECTED')}>Decline</button></div>}</article>)}
      </section>}
      {page === 'profile' && <section className="section profile-card"><div className="avatar large">{user.name[0]?.toUpperCase()}</div><div className="eyebrow">{user.role === 'WORKER' ? 'WORKER ACCOUNT' : 'EMPLOYER ACCOUNT'}</div><h1>{user.name}</h1><p>{user.phone} · {user.area}</p><p className="muted">{user.skill || user.businessName}</p><button className="button secondary" onClick={signOut}>Sign out</button></section>}
      {page === 'helper' && <section className="section helper-panel"><div className="eyebrow">DL CONNECT HELPER</div><h1>Your work helper</h1><div className="chat-list" aria-live="polite">{chat.map((message, index) => <p className={`chat-message ${message.who}`} key={`${index}-${message.who}`}>{message.text}</p>)}</div><div className="helper-prompts"><button className="chip" onClick={() => setChatInput('How do I apply?')}>How to apply</button><button className="chip" onClick={() => setChatInput('How do I post a job?')}>Post a job</button><button className="chip" onClick={() => setPage('rules')}>Labour rules</button></div><form className="helper-form" onSubmit={askHelper}><input aria-label="Ask DL Connect" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask how to find work…" /><button className="button primary">Send</button></form></section>}
      {page === 'rules' && <section className="section"><div className="eyebrow">SAFETY FIRST</div><h1>Labour rules</h1><p className="muted">A safe, fair workplace starts with clear expectations.</p><div className="rules-list"><article className="rule-card"><span>18+</span><div><h3>No child labour</h3><p>Workers must be at least 18 years old.</p></div></article><article className="rule-card"><span>✓</span><div><h3>Voluntary and legal work</h3><p>No forced work, unlawful work, or unpaid work.</p></div></article><article className="rule-card"><span>₹</span><div><h3>Agree pay before work</h3><p>State the pay before work begins and pay it on time.</p></div></article><article className="rule-card"><span>▣</span><div><h3>Use safe, lawful equipment</h3><p>If a vehicle is provided, the driver must hold a valid licence.</p></div></article></div></section>}
      {busy && <span className="sr-only" role="status">Saving</span>}
    </main>
    <nav className="bottom-nav" aria-label="Main navigation">{nav.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => { setPage(item.id); setError(''); setNotice('') }}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
  </div>
}

function JobList({ jobs, onApply, onClose, applied, role }: { jobs: Job[]; onApply: (job: Job) => void; onClose?: (job: Job) => void; applied: string[]; role: Role }) {
  if (!jobs.length) return <div className="empty"><span>⌕</span><p>No jobs to show yet.</p></div>
  return <div className="job-list">{jobs.map((job) => <article className="job-card" key={job.id}>
    <div className="job-icon">{job.category.slice(0, 1)}</div><div className="job-main"><div className="eyebrow">{job.category} · {job.type}</div><h3>{job.title}</h3><p className="muted">{job.employerName} · {job.place}</p><div className="job-meta"><strong>₹{job.pay.toLocaleString('en-IN')}</strong><span>per day · {job.workersNeeded} needed</span></div></div>
    {role === 'WORKER' && <button className={`button ${applied.includes(job.id) ? 'secondary' : 'primary'} apply`} disabled={applied.includes(job.id)} onClick={() => onApply(job)}>{applied.includes(job.id) ? 'Applied ✓' : 'Apply'}</button>}
    {role === 'EMPLOYER' && onClose && !job.closed && <button className="button secondary apply" onClick={() => onClose(job)}>Close job</button>}
  </article>)}</div>
}

function Empty({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return <div className="empty"><span>⌕</span><p>{text}</p><button className="button secondary" onClick={onClick}>{action}</button></div>
}

export default App
