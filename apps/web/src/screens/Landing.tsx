// Public landing page (logged out). For visitors and judges: what Heard is, how it works, guardrails.
import { ArrowRight, Ban, CheckCircle2, Languages, MessageCircleHeart, ShieldCheck, UserCheck } from 'lucide-react';
import { href } from '../router';

const STEPS = [
  { icon: CheckCircle2, title: 'A one-tap check-in', body: 'Every Monday, students tap how studies, money, health and home are going. Ten seconds, in their language.' },
  { icon: UserCheck, title: 'Evidence for the mentor', body: 'Rules you can read (two struggling weeks, a sudden drop, gone quiet) put a student in their mentor’s inbox with the evidence and their own words.' },
  { icon: MessageCircleHeart, title: 'A real conversation', body: 'The mentor sends a warm first message. Chat, voice notes and translation run on Nexconn, so a Marathi student and an English-speaking mentor understand each other.' },
];

const GUARDRAILS: [string, string][] = [
  ['Reduce a student to a score', 'Evidence flags that show the rule, the weeks and the answers'],
  ['Let AI message a student on its own', 'Drafts and suggestions only; a person sends'],
  ['Show answers to other students or wardens', 'Only the mentor sees answers; wardens see totals'],
  ['Trust AI with a crisis', 'Fixed keywords in code; helplines shown at once; mentor and warden alerted'],
  ['Hide a machine translation', 'The original is always shown next to the translation'],
  ['Infer emotions or diagnose', 'Quote what the student wrote; labels are refused in mentor messages'],
];

export function Landing() {
  return (
    <div className="landing">
      <header className="hero">
        <nav className="hero-nav">
          <a className="logo" href={href()}>
            <span className="logo-mark" aria-hidden>
              H
            </span>
            Heard
          </a>
          <span className="spacer" />
          <a className="nav-link desktop-only" href="#how">
            How it works
          </a>
          <a className="nav-link desktop-only" href="#guardrails">
            Guardrails
          </a>
          <a className="btn primary" href={href('start')}>
            Open the app <ArrowRight size={16} aria-hidden />
          </a>
        </nav>

        <div className="hero-body">
          <span className="hero-badge">Built on the Nexconn Chat SDK · for hostels and campuses</span>
          <h1>
            Heard,
            <br />
            before it’s a crisis.
          </h1>
          <p>
            A weekly one-tap check-in, an inbox that shows mentors who may need a conversation, and chat that works in 211 languages.
            No scores. A person always decides.
          </p>
          <div className="row hero-cta">
            <a className="btn white" href={href('start')}>
              Open the app <ArrowRight size={16} aria-hidden />
            </a>
            <a className="btn outline-white" href={href('start', 'demo')}>
              Try the demo campus
            </a>
          </div>
          <div className="promise">
            <div>
              <Ban size={18} aria-hidden />
              <b>No scores</b>
              <span>every flag shows its evidence</span>
            </div>
            <div>
              <ShieldCheck size={18} aria-hidden />
              <b>Mentor decides</b>
              <span>AI drafts, people send</span>
            </div>
            <div>
              <Languages size={18} aria-hidden />
              <b>Your language</b>
              <span>Marathi, Hindi, 中文, 211 in all</span>
            </div>
          </div>
        </div>
      </header>

      <section className="landing-section" id="how">
        <span className="section-badge">How it works</span>
        <h2>From a quiet slide to a conversation</h2>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card step">
              <span className="step-n">{i + 1}</span>
              <s.icon size={22} className="step-icon" aria-hidden />
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" id="guardrails">
        <span className="section-badge">Guardrails</span>
        <h2>What Heard never does</h2>
        <div className="card guardrails">
          <div className="g-head">
            <span>✕ Never</span>
            <span>✓ Instead</span>
          </div>
          {GUARDRAILS.map(([never, instead]) => (
            <div key={never} className="g-row">
              <span>{never}</span>
              <span>{instead}</span>
            </div>
          ))}
        </div>
        <p className="small muted center" style={{ marginTop: '2rem' }}>
          Built for the Nexconn Build Challenge 2026 · Humanitarian &amp; Social Good · If you’re not safe right now, call Tele-MANAS 14416 or 112.
        </p>
      </section>
    </div>
  );
}
