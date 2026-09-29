import React, { useEffect, useMemo, useRef, useState } from 'react';
import { calculateRecordMetrics, formatRiskFromSurplus, predictDemand } from './engine.js';
import { createDemoRecords, demoImpact, demoMenuOptions, getTodaySample } from './data.js';
import { predictionService } from './service.js';
import { validateCsv } from './csv.js';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '◫' },
  { id: 'predictions', label: 'Predictions', icon: '⌁' },
  { id: 'simulator', label: 'What-If Simulator', icon: '⦿' },
  { id: 'analytics', label: 'Food Analytics', icon: '▥' },
  { id: 'insights', label: 'AI Insights', icon: '✧' },
  { id: 'impact', label: 'Impact', icon: '♧' },
  { id: 'data', label: 'Data Management', icon: '▤' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

const pageTitles = Object.fromEntries(navItems.map(({ id, label }) => [id, label]));
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const defaultToday = getTodaySample();

function Icon({ name, className = '' }) {
  const glyph = navItems.find((item) => item.id === name)?.icon ?? name;
  return <span className={`icon ${className}`} aria-hidden="true">{glyph}</span>;
}

function Logo({ compact = false }) {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
      {!compact && <span className="brand-name">wastewise<span>ai</span></span>}
    </div>
  );
}

function Badge({ children, tone = 'green' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function RiskBadge({ risk }) {
  const tone = risk === 'HIGH' ? 'red' : risk === 'MEDIUM' ? 'amber' : 'green';
  return <Badge tone={tone}><span className="risk-dot" />{risk}</Badge>;
}

function MetricCard({ label, value, unit, note, icon, tone = 'green' }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-${tone}`}><Icon name={icon} /></div>
      <p className="eyebrow">{label}</p>
      <div className="metric-value">{value}<span>{unit}</span></div>
      <p className="metric-note">{note}</p>
    </article>
  );
}

function SectionHeader({ eyebrow, title, action }) {
  return <div className="section-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>;
}

function Chart({ values, labels, color = '#16845b', height = 170, fill = true, label = 'Trend chart' }) {
  if (!values.length) return <div className="empty-chart">No records in this period.</div>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 90 - ((value - min) / span) * 70;
    return `${x},${y}`;
  }).join(' ');
  const firstX = 0;
  const lastX = values.length === 1 ? 50 : 100;
  const area = `${firstX},100 ${points} ${lastX},100`;
  return (
    <div className="chart-wrap">
      <svg className="line-chart" viewBox="0 0 100 105" preserveAspectRatio="none" role="img" aria-label={label}>
        {[25, 50, 75].map((line) => <line key={line} x1="0" y1={line} x2="100" y2={line} className="chart-grid" />)}
        {fill && <polygon points={area} fill={`${color}1A`} />}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((value, index) => {
          const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
          const y = 90 - ((value - min) / span) * 70;
          return <circle key={`${index}-${value}`} cx={x} cy={y} r="1.25" fill={color}><title>{`${labels[index] ?? `Item ${index + 1}`}: ${value}`}</title></circle>;
        })}
      </svg>
      <div className="chart-labels">{labels.map((labelText, index) => <span key={`${labelText}-${index}`}>{labelText}</span>)}</div>
    </div>
  );
}

function BarChart({ rows, color = '#16845b', label = 'Bar chart' }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  if (!rows.length) return <div className="empty-chart">No records in this period.</div>;
  return <div className="bar-chart" role="img" aria-label={label}>{rows.map((row) => (
    <div className="bar-row" key={row.label}>
      <span>{row.label}</span><div className="bar-track"><div style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: color }} /></div><strong>{row.value.toLocaleString()}</strong>
    </div>
  ))}</div>;
}

function ComparisonChart({ series, label }) {
  const values = series.flatMap((line) => line.values);
  if (!values.length) return <div className="empty-chart">No records in this period.</div>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  return (
    <>
      <div className="chart-wrap">
        <svg className="line-chart" viewBox="0 0 100 105" preserveAspectRatio="none" role="img" aria-label={label}>
          {[25, 50, 75].map((line) => <line key={line} x1="0" y1={line} x2="100" y2={line} className="chart-grid" />)}
          {series.map((line) => {
            const points = line.values.map((value, index) => `${line.values.length === 1 ? 50 : (index / (line.values.length - 1)) * 100},${90 - ((value - min) / span) * 70}`).join(' ');
            return <polyline key={line.name} points={points} fill="none" stroke={line.color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"><title>{line.name}</title></polyline>;
          })}
        </svg>
        <div className="chart-labels">{series[0].labels.map((labelText, index) => <span key={`${labelText}-${index}`}>{labelText}</span>)}</div>
      </div>
      <div className="comparison-legend">{series.map((line) => <span key={line.name}><i style={{ background: line.color }} />{line.name}</span>)}</div>
    </>
  );
}

function Landing({ onLaunch }) {
  const scrollToHow = () => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <main className="landing">
      <header className="landing-nav"><Logo /><div className="landing-links"><a href="#problem">The challenge</a><a href="#how-it-works">How it works</a><a href="#features">Platform</a></div><button className="button button-dark button-small" onClick={onLaunch}>Launch dashboard <span aria-hidden="true">↗</span></button></header>
      <section className="hero">
        <div className="hero-copy"><Badge>FOOD SERVICE, MADE SMARTER</Badge><h1>Make every meal<br /><span>count.</span></h1><p className="hero-lede">AI-powered food demand forecasting for smarter food preparation. WasteWise helps teams anticipate demand, spot surplus risk, and prepare with confidence.</p><div className="hero-actions"><button className="button button-primary" onClick={onLaunch}>Launch dashboard <span aria-hidden="true">↗</span></button><button className="button button-quiet" onClick={scrollToHow}>See how it works <span aria-hidden="true">↓</span></button></div><div className="hero-footnote"><span className="status-dot" /> Ready-to-explore demo · No setup required</div></div>
        <div className="hero-preview"><div className="preview-window"><div className="preview-top"><div className="preview-brand"><Logo compact /><strong>Today at a glance</strong></div><Badge>DEMO</Badge></div>        <div className="preview-date">TODAY · LUNCH SERVICE <span>▾</span></div><div className="preview-main"><div><p className="eyebrow">PREDICTED DEMAND</p><strong>687</strong><span>meals</span></div><div className="preview-ring"><span>87<small>%</small></span><small>confidence*</small></div></div><div className="preview-range"><div><span>650</span><div className="range-line"><i /></div><span>720</span></div><small>Expected demand range</small></div>        <div className="preview-divider" /><div className="preview-stats"><div><span>Recommended production</span><strong>700 <small>meals</small></strong></div><div><span>Waste risk</span><strong><RiskBadge risk="LOW" /></strong></div><div><span>Estimated surplus</span><strong>13 <small>meals</small></strong></div><div><span>Food saved</span><strong>184 <small>kg*</small></strong></div></div><div className="preview-foot">*Estimated demo impact · Synthetic data</div></div><div className="float-chip"><span>↘</span><div><strong>Right-sized prep</strong><small>Less avoidable surplus</small></div></div><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /></div>
      </section>
      <section className="trust-strip"><span>BUILT FOR FOOD SERVICE TEAMS</span><div><span>Campus dining</span><span>·</span><span>Hospitality</span><span>·</span><span>Healthcare</span><span>·</span><span>Workplace dining</span></div></section>
      <section className="landing-section problem-section" id="problem"><div><p className="eyebrow">THE CHALLENGE</p><h2>Good food shouldn't<br />end up in the bin.</h2><p>When demand is uncertain, teams often prepare too much to avoid running short. That safety margin adds up—in food, cost, and effort.</p></div><div className="problem-cards"><article><span className="problem-icon">◌</span><h3>Uncertain demand</h3><p>Attendance, menus, and daily conditions shift meal-by-meal.</p></article><article><span className="problem-icon">⌁</span><h3>Overproduction</h3><p>Rough estimates can leave good food unserved at the end of a shift.</p></article><article><span className="problem-icon">↘</span><h3>Hidden cost</h3><p>Surplus carries a real operational cost beyond the ingredients.</p></article></div></section>
      <section className="landing-section how-section" id="how-it-works"><div className="center-heading"><p className="eyebrow">A CLEARER WAY FORWARD</p><h2>From yesterday's data<br />to a better plan today.</h2></div><div className="steps">{[['01', 'Collect data', 'Bring attendance, menus, and consumption history together.'], ['02', 'Predict demand', 'Estimate likely meal demand from transparent inputs.'], ['03', 'Optimize prep', 'Set a practical production target with a safety buffer.'], ['04', 'Measure impact', 'Track trends and estimated progress over time.']].map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="landing-section feature-section" id="features"><div className="center-heading"><p className="eyebrow">ONE CONNECTED WORKFLOW</p><h2>Practical tools for<br />everyday decisions.</h2></div><div className="feature-grid">{[['⌁', 'Demand prediction', 'A clear forecast with a range and the factors behind it.'], ['◉', 'Waste risk', 'Spot when a production plan may create unnecessary surplus.'], ['↗', 'Production guidance', 'Turn a demand estimate into a useful prep target.'], ['⦿', 'What-if simulator', 'Explore attendance, menu, and weather scenarios instantly.'], ['▥', 'Food analytics', 'See production and consumption patterns at a glance.'], ['♧', 'Impact tracking', 'Follow estimated savings with transparent assumptions.']].map(([icon, title, body]) => <article key={title}><span>{icon}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="example-band"><div><Badge tone="light">A SAMPLE SERVICE</Badge><h2>Plan for 800.<br />Prepare what you need.</h2><p>Use an estimate grounded in your operation—not just a guess.</p></div>      <div className="example-numbers">{[['Expected attendance', '800'], ['Predicted demand', '687'], ['Recommended production', '700'], ['Estimated surplus', '13']].map(([label, value], index) => <div key={label}><small>0{index + 1} / {label}</small><strong>{value}<em> meals</em></strong></div>)}<p>Demo estimate based on the recommended production quantity.</p></div></section>
      <section className="landing-cta"><div><p className="eyebrow">START WITH A DEMO</p><h2>Plan smarter.<br /><span>Waste less.</span></h2></div><button className="button button-primary" onClick={onLaunch}>Explore WasteWise AI <span aria-hidden="true">↗</span></button></section>
      <footer className="landing-footer"><Logo /><span>Predict. Prevent. Preserve.</span><span>Demo experience · All data is synthetic</span></footer>
    </main>
  );
}

function AppShell({ page, setPage, children, onHome, settings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <button className="sidebar-brand" onClick={onHome} aria-label="WasteWise AI home"><Logo /></button>
        <div className="workspace-card"><span className="workspace-avatar">G</span><span><strong>{settings.organization || 'Your organization'}</strong><small>{settings.cafeteria || 'Cafeteria'}</small></span><span className="chevron">⌄</span></div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">{navItems.map((item) => <button key={item.id} aria-label={item.label} className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMenuOpen(false); }}><Icon name={item.id} /><span>{item.label}</span>{item.id === 'simulator' && <span className="nav-new">NEW</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-tip"><span>✧</span><strong>Small changes add up.</strong><p>See how a smarter prep plan could make a difference.</p><button onClick={() => { setPage('impact'); setMenuOpen(false); }}>Explore impact <span>→</span></button></div><button className="profile-row" onClick={() => setPage('settings')}><span className="profile-avatar">A</span><span><strong>Alex Morgan</strong><small>Administrator · Demo</small></span><span className="more">···</span></button></div>
      </aside>
      {menuOpen && <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
      <div className="main-area">
        <header className="topbar"><button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">☰</button><div className="breadcrumb"><button onClick={() => setPage('dashboard')}>Workspace</button><span>/</span><strong>{pageTitles[page]}</strong></div><div className="topbar-right"><Badge>DEMO DATA</Badge><div className="notification-wrap"><button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><span>♧</span><i /></button>{notificationsOpen && <div className="notification-popover" role="status"><strong>You’re all caught up</strong><span>There are no new demo notifications.</span><button onClick={() => setNotificationsOpen(false)}>Dismiss</button></div>}</div><span className="topbar-divider" /><button className="topbar-profile" onClick={() => setPage('settings')}><span className="profile-avatar">A</span><span>Admin</span><span className="chevron">⌄</span></button></div></header>
        <main className="page-content">{children}</main>
        <footer className="app-footer"><span>WasteWise AI <i>·</i> Predict. Prevent. Preserve.</span><span>All metrics shown are demo estimates</span></footer>
      </div>
    </div>
  );
}

function ExplanationModal({ prediction, onClose }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="explanation-title"><button className="modal-close" onClick={onClose} aria-label="Close explanation">×</button><Badge>DEMO MODEL EXPLANATION</Badge><h2 id="explanation-title">What shaped this estimate?</h2><p className="modal-lede">This transparent demo calculation uses a fixed service baseline, an attendance contribution, and the selected service adjustments. It is not a trained machine-learning model.</p><div className="factor-list">{Object.entries({ 'Base service demand': prediction.factors.baseDemand, 'Attendance contribution': prediction.factors.attendance, 'Menu preference': prediction.factors.menu, 'Day of week': prediction.factors.day, 'Weather adjustment': prediction.factors.weather, Holiday: prediction.factors.holiday, Event: prediction.factors.event }).map(([label, value]) => <div key={label}><span>{label}</span><strong className={value > 0 ? 'factor-positive' : value < 0 ? 'factor-negative' : ''}>{value > 0 ? '+' : ''}{value} meals</strong></div>)}</div><div className="modal-result"><span>Predicted demand</span><strong>{prediction.predictedConsumption} meals</strong></div><button className="button button-primary modal-action" onClick={onClose}>Got it</button></section></div>;
}

function Dashboard({ records, prediction, onNavigate, onExplain, settings }) {
  const dailyValues = useMemo(() => getDailySeries(records, 7, 'leftover'), [records]);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const estimatedSurplus = Math.max(0, defaultToday.plannedProduction - prediction.predictedConsumption);
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">{today.toUpperCase()} · LUNCH SERVICE</p><h1>Good morning, Alex <span className="wave">✳</span></h1><p>Here’s the plan for today at {settings.organization || 'your organization'}.</p></div><button className="button button-primary" onClick={() => onNavigate('simulator')}><span>⦿</span> Open simulator</button></div>
      <div className="demo-notice"><span>i</span><div><strong>You’re exploring demo data</strong><small>Synthetic sample records · No real-world results or model accuracy claims</small></div><button onClick={() => onNavigate('data')}>Manage data <span>→</span></button></div>
      <div className="metric-grid dashboard-metric-grid">
        <MetricCard label="Predicted demand" value={prediction.predictedConsumption.toLocaleString()} unit="meals" note="Demo estimate for today" icon="⌁" />
        <MetricCard label="Recommended production" value={prediction.recommendedProduction.toLocaleString()} unit="meals" note={`Includes a ${prediction.safetyBufferPercent}% safety buffer`} icon="↗" tone="mint" />
        <article className="metric-card"><div className="metric-icon metric-yellow"><Icon name="◉" /></div><p className="eyebrow">Waste risk</p><div className="metric-risk"><RiskBadge risk={formatRiskFromSurplus(defaultToday.plannedProduction, prediction.predictedConsumption)} /></div><p className="metric-note">Based on today’s planned production</p></article>
        <MetricCard label="Potential surplus" value={estimatedSurplus.toLocaleString()} unit="meals" note="If the current plan stays unchanged" icon="⌂" tone="peach" />
        <MetricCard label="Food saved this month" value={settings.weightUnit.startsWith('Pounds') ? Math.round(demoImpact.foodSavedKg * 2.20462) : demoImpact.foodSavedKg} unit={settings.weightUnit.startsWith('Pounds') ? 'lb' : 'kg'} note="Estimated demo value" icon="♧" tone="mint" />
        <MetricCard label="Estimated cost saved" value={`₹${demoImpact.costSaved.toLocaleString('en-IN')}`} unit="" note="Estimated demo value" icon="↗" tone="yellow" />
      </div>
      <div className="dashboard-grid">
        <section className="panel prediction-panel"><div className="panel-heading"><div><p className="eyebrow">TODAY’S FORECAST</p><h2>Expected consumption</h2></div><Badge>DEMO ESTIMATE</Badge></div><div className="prediction-highlight"><strong>{prediction.predictedConsumption.toLocaleString()}</strong><span>meals</span><div className="prediction-conf"><span>ⓘ</span> {prediction.confidence}% demo confidence estimate</div></div><div className="range-row"><div><span className="range-marker" /><strong>{prediction.lowerBound}</strong><div className="forecast-range"><i /></div><strong>{prediction.upperBound}</strong></div><small>Estimated range · not a guarantee</small></div><div className="prediction-bottom"><div><span>Recommended to prepare</span><strong>{prediction.recommendedProduction} <small>meals</small></strong></div><button className="text-button" onClick={onExplain}>View explanation <span>→</span></button></div></section>
        <section className="panel recommendation-panel"><div className="panel-heading"><div><p className="eyebrow">SUGGESTED ACTION</p><h2>Prep with a little more precision.</h2></div><span className="sparkle">✧</span></div><p className="recommendation-copy">Prepare around <strong>{prediction.recommendedProduction.toLocaleString()} meals</strong> for today’s lunch service. That’s based on the demand estimate plus a modest safety buffer.</p><div className="recommendation-factors"><div><span>Expected attendance</span><strong>{defaultToday.attendance} people</strong></div><div><span>Today's menu</span><strong>{defaultToday.menu}</strong></div><div><span>Weather</span><strong>{defaultToday.temperature}°C · {defaultToday.holiday ? 'Holiday' : 'Regular day'}</strong></div></div><button className="button button-outline" onClick={() => onNavigate('simulator')}>Adjust in simulator <span>→</span></button><div className="alternative-actions"><div><strong>Reduce preparation</strong><span>Review today’s planned quantity.</span></div><div><strong>Optimize the menu</strong><span>Compare options in the simulator.</span></div><div><strong>Consider redistribution</strong><span>Only through an approved channel if food-safety and organizational rules allow.</span></div></div><p className="small-disclaimer">Suggestions only; no automatic actions. A planning aid based on synthetic demo data.</p></section>
        <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">LAST 7 DAYS · DEMO DATA</p><h2>Daily food waste</h2></div><button className="text-button" onClick={() => onNavigate('analytics')}>View analytics <span>→</span></button></div><Chart values={dailyValues.values} labels={dailyValues.labels} color="#13845a" label="Daily food waste for the last seven days" /><div className="chart-legend"><span><i /> Leftover meals</span><span className="legend-note">Synthetic records</span></div></section>
        <section className="panel insight-mini"><div className="panel-heading"><div><p className="eyebrow">FROM YOUR DEMO DATA</p><h2>A pattern worth a look</h2></div><span className="insight-icon">✧</span></div><p>Compare preparation and consumption before deciding whether to change your service plan.</p><div className="mini-stat"><strong>{records.length}</strong><span>sample food-item records</span></div><button className="text-button" onClick={() => onNavigate('insights')}>Explore demo insights <span>→</span></button></section>
      </div>
    </>
  );
}

function Simulator({ predictionInput, setPredictionInput, prediction, safetyBufferPercent, onReset, error }) {
  const update = (key, value) => setPredictionInput((current) => ({ ...current, [key]: value }));
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">PLAN BEFORE YOU PREPARE</p><h1>What-if simulator</h1><p>Explore how a change in service conditions could affect your prep plan.</p></div><Badge>DETERMINISTIC DEMO</Badge></div>
      <div className="simulator-layout">
        <section className="panel simulator-inputs"><div className="panel-heading"><div><p className="eyebrow">SCENARIO INPUTS</p><h2>Set your service conditions</h2></div><span className="step-count">01 / 02</span></div><p className="panel-description">Adjust any input to see the estimate update immediately.</p>
          <label className="field-label" htmlFor="attendance">Expected attendance <span>People</span></label><div className="input-with-unit"><input id="attendance" type="number" min="0" max="100000" value={predictionInput.attendance} onChange={(event) => update('attendance', event.target.value)} /><span>people</span></div>
          <label className="field-label" htmlFor="menu">Today's menu</label><select id="menu" value={predictionInput.menu} onChange={(event) => update('menu', event.target.value)}>{demoMenuOptions.map((menu) => <option key={menu}>{menu}</option>)}</select>
          <div className="form-columns"><div><label className="field-label" htmlFor="temperature">Temperature</label><div className="input-with-unit"><input id="temperature" type="number" min="-20" max="60" value={predictionInput.temperature} onChange={(event) => update('temperature', event.target.value)} /><span>°C</span></div></div><div><label className="field-label" htmlFor="day">Day of week</label><select id="day" value={predictionInput.dayOfWeek} onChange={(event) => update('dayOfWeek', event.target.value)}>{weekdays.map((day) => <option key={day}>{day}</option>)}</select></div></div>
          <div className="toggle-list"><label><span><strong>Public holiday</strong><small>Expect lower than usual attendance</small></span><input type="checkbox" checked={predictionInput.holiday} onChange={(event) => update('holiday', event.target.checked)} /><i /></label><label><span><strong>Special event</strong><small>May increase demand for this service</small></span><input type="checkbox" checked={predictionInput.event} onChange={(event) => update('event', event.target.checked)} /><i /></label></div>
          <label className="field-label" htmlFor="planned">Current planned production</label><div className="input-with-unit"><input id="planned" type="number" min="0" max="100000" value={predictionInput.plannedProduction} onChange={(event) => update('plannedProduction', event.target.value)} /><span>meals</span></div>
          {error && <p className="form-error" role="alert">{error}</p>}<button className="button button-quiet reset-button" onClick={onReset}>↺ Reset to demo scenario</button>
        </section>
        <section className="panel simulator-results"><div className="panel-heading"><div><p className="eyebrow">LIVE SCENARIO</p><h2>Your updated plan</h2></div><span className="live-pill"><i /> LIVE</span></div>                        <div className="sim-prediction"><span>Predicted consumption</span><strong key={prediction.predictedConsumption}>{prediction.predictedConsumption.toLocaleString()}</strong><small>meals · {prediction.lowerBound}–{prediction.upperBound} range</small></div><div className="sim-result-grid"><div><span>Recommended production</span><strong>{prediction.recommendedProduction.toLocaleString()} <small>meals</small></strong><p>{safetyBufferPercent === 0 ? 'No safety buffer applied' : `+${safetyBufferPercent}% buffer, rounded to 10 meals`}</p></div><div><span>Surplus vs. current plan</span><strong>{prediction.estimatedSurplus.toLocaleString()} <small>meals</small></strong><p>Based on your planned production</p></div><div><span>Surplus at recommended target</span><strong>{prediction.recommendedSurplus.toLocaleString()} <small>meals</small></strong><p>Estimated buffer beyond demand</p></div></div><div className="risk-summary"><div><span>Waste risk against current plan</span><RiskBadge risk={prediction.wasteRisk} /></div><p>{prediction.wasteRisk === 'LOW' ? 'Current plan is close to the demo demand estimate.' : prediction.wasteRisk === 'MEDIUM' ? 'Consider reviewing the plan; it is notably above estimated demand.' : 'Current plan is substantially above estimated demand. Review before preparation.'}</p></div><div className="cost-summary"><span>Estimated plan difference</span><strong>{prediction.costImpact >= 0 ? '+' : '−'}₹{Math.abs(prediction.costImpact).toLocaleString('en-IN')}</strong><small>Illustrative only · ₹28 per meal assumption</small></div><div className="scenario-callout"><span>✧</span><p>Try changing attendance from <strong>800 to 600</strong> and see the forecast respond in real time.</p></div><p className="small-disclaimer">The demo model uses fixed, transparent rules. It is not a trained ML model or operational advice.</p></section>
      </div>
    </>
  );
}

function Predictions({ records, prediction, onExplain }) {
  const series = useMemo(() => getComparisonSeries(records, 'forecast'), [records]);
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">FORECAST OVERVIEW</p><h1>Predictions</h1><p>Review the demo forecast and historical consumption context.</p></div><Badge>DEMO MODEL</Badge></div>
      <div className="metric-grid three-cols"><MetricCard label="Today's predicted demand" value={prediction.predictedConsumption.toLocaleString()} unit="meals" note="For the current scenario" icon="⌁" /><MetricCard label="Prediction range" value={`${prediction.lowerBound}–${prediction.upperBound}`} unit="meals" note="Illustrative range" icon="↔" tone="mint" /><article className="metric-card"><div className="metric-icon metric-yellow"><Icon name="◎" /></div><p className="eyebrow">Demo confidence</p><div className="metric-value">{prediction.confidence}<span>%</span></div><p className="metric-note">Not an evaluated accuracy score</p></article></div>
      <section className="panel prediction-chart-panel"><div className="panel-heading"><div><p className="eyebrow">HISTORICAL CONTEXT · SYNTHETIC</p><h2>Predicted vs. actual consumption</h2></div><button className="text-button" onClick={onExplain}>How is this calculated? <span>→</span></button></div><ComparisonChart series={series} label="Historical demo predicted and actual consumption" /><p className="table-hint">Historical prediction line is recalculated from each day’s demo inputs; actual values come from synthetic records.</p></section>
      <div className="panel info-panel"><div className="info-icon">i</div><div><strong>How to read this page</strong><p>The chart reflects recorded demo consumption and planned quantities. Today’s forecast is calculated separately from scenario inputs using a deterministic rule-based engine.</p></div></div>
    </>
  );
}

function Analytics({ records, onFoodClick }) {
  const [period, setPeriod] = useState('30');
  const filteredRecords = useMemo(() => filterPeriod(records, Number(period)), [records, period]);
  const daily = useMemo(() => aggregateByDay(filteredRecords, 'leftover', 12), [filteredRecords]);
  const weekly = useMemo(() => aggregateByWeek(filteredRecords), [filteredRecords]);
  const monthly = useMemo(() => aggregateByMonth(filteredRecords, 'leftover'), [filteredRecords]);
  const byCategory = useMemo(() => aggregateByField(filteredRecords, 'category', 'leftover'), [filteredRecords]);
  const byMenu = useMemo(() => aggregateByField(filteredRecords, 'menu', 'leftover'), [filteredRecords]);
  const tableRows = useMemo(() => summarizeItems(filteredRecords), [filteredRecords]);
  const forecastComparison = useMemo(() => getComparisonSeries(filteredRecords, 'forecast'), [filteredRecords]);
  const productionComparison = useMemo(() => getComparisonSeries(filteredRecords, 'production'), [filteredRecords]);
  const periodName = period === '7' ? 'Last 7 days' : period === '30' ? 'Last 30 days' : period === '90' ? 'Last 3 months' : 'Last year';
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">MAKE PATTERNS VISIBLE</p><h1>Food analytics</h1><p>Explore how planned production compares with recorded consumption.</p></div><label className="period-select"><span className="sr-only">Analytics date range</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 3 months</option><option value="365">Last year</option></select></label></div>
      <div className="demo-notice compact-notice"><span>i</span><div><strong>{periodName} · {filteredRecords.length} synthetic records</strong><small>All charts below update to match your selected period.</small></div></div>
      <div className="analytics-grid"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">SURPLUS TREND</p><h2>Daily food waste</h2></div><span className="chart-unit">Meals</span></div><Chart values={daily.values} labels={daily.labels} label={`Daily leftovers, ${periodName}`} /></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">WEEKLY VIEW</p><h2>Weekly waste trend</h2></div><span className="chart-unit">Meals</span></div><Chart values={weekly.values} labels={weekly.labels} color="#b78239" label={`Weekly leftovers, ${periodName}`} /></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">MONTHLY VIEW</p><h2>Monthly waste trend</h2></div><span className="chart-unit">Meals</span></div><Chart values={monthly.values} labels={monthly.labels} color="#3f9670" label={`Monthly leftovers, ${periodName}`} /></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">BY CATEGORY</p><h2>Waste by food category</h2></div><span className="chart-unit">Meals</span></div><BarChart rows={byCategory} color="#288b67" label="Waste by food category" /></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">BY MENU ITEM</p><h2>Waste by menu</h2></div><span className="chart-unit">Meals</span></div><BarChart rows={byMenu} color="#769f78" label="Waste by menu" /></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">MODEL CONTEXT</p><h2>Predicted vs. actual</h2></div><span className="chart-unit">Meals</span></div><ComparisonChart series={forecastComparison} label={`Predicted and actual consumption, ${periodName}`} /></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">SERVICE PLANNING</p><h2>Production vs. consumption</h2></div><span className="chart-unit">Meals</span></div><ComparisonChart series={productionComparison} label={`Production and consumption, ${periodName}`} /></section></div>
      <section className="panel food-table-panel"><div className="panel-heading"><div><p className="eyebrow">ITEM-LEVEL VIEW</p><h2>Food item analysis</h2></div><span className="chart-unit">{tableRows.length} items</span></div><div className="table-scroll"><table><thead><tr><th>Food item</th><th>Prepared</th><th>Consumed</th><th>Surplus</th><th>Waste %</th><th>Waste risk</th></tr></thead><tbody>{tableRows.map((row) => <tr key={row.foodItem} onClick={() => onFoodClick(row.foodItem)} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') onFoodClick(row.foodItem); }}><td><strong>{row.foodItem}</strong><small>{row.category}</small></td><td>{row.prepared.toLocaleString()}</td><td>{row.consumed.toLocaleString()}</td><td>{row.leftover.toLocaleString()}</td><td>{row.wastePercent.toFixed(1)}%</td><td><RiskBadge risk={row.risk} /></td></tr>)}</tbody></table></div><p className="table-hint">Select a food item to view its trend. Figures aggregate demo records.</p></section>
    </>
  );
}

function FoodDetailModal({ item, records, onClose }) {
  const itemRecords = records.filter((record) => record.foodItem === item).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const series = itemRecords.map((record) => record.leftover);
  const labels = itemRecords.map((record) => new Date(`${record.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="food-detail-title"><button className="modal-close" onClick={onClose} aria-label="Close food analysis">×</button><Badge>DEMO DATA · LAST 14 RECORDS</Badge><h2 id="food-detail-title">{item} history</h2>{itemRecords.length ? <><Chart values={series} labels={labels} label={`Leftovers for ${item} in the last 14 records`} /><p className="small-disclaimer">Each point shows leftover quantity from a synthetic demo record.</p></> : <div className="empty-state">No historical records available for this item.</div>}<button className="button button-primary modal-action" onClick={onClose}>Close</button></section></div>;
}

function Insights({ records }) {
  const insights = useMemo(() => createInsights(records), [records]);
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">PATTERNS, NOT PROMISES</p><h1>AI insights</h1><p>Exploratory observations calculated from the available demo records.</p></div><Badge>DATA-DERIVED DEMO</Badge></div>
      <div className="insight-summary"><span className="insight-summary-icon">✧</span><div><strong>Generated from {records.length} synthetic records</strong><p>These descriptive signals are not causal findings or predictions. Insights update when your dataset changes.</p></div></div>
      <div className="insight-grid">{insights.map((insight, index) => <article className="panel insight-card" key={insight.title}><div className="insight-card-top"><span className="insight-count">0{index + 1}</span><Badge tone={insight.strength === 'Strong' ? 'green' : 'amber'}>{insight.strength} signal</Badge></div><h2>{insight.title}</h2><p>{insight.explanation}</p><div className="insight-metric"><strong>{insight.metric}</strong><span>{insight.support}</span></div><div className="insight-meta"><span>Based on available demo records</span><span>Descriptive only</span></div></article>)}</div>
    </>
  );
}

function Impact({ records, settings }) {
  const monthly = useMemo(() => aggregateByMonth(records, 'leftover'), [records]);
  const totalLeftover = records.reduce((sum, record) => sum + record.leftover, 0);
  const totalPrepared = records.reduce((sum, record) => sum + record.plannedQuantity, 0);
  const wastePercent = totalPrepared ? (totalLeftover / totalPrepared) * 100 : 0;
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">ESTIMATES WITH CONTEXT</p><h1>Impact dashboard</h1><p>Explore illustrative food and cost metrics from this demo workspace.</p></div><Badge>ESTIMATED · DEMO</Badge></div>
      <div className="impact-callout"><span>♧</span><div><strong>Impact metrics are estimates</strong><p>These values use configurable assumptions and synthetic demo data. They are not independently verified measurements.</p></div></div>
      <div className="metric-grid"><MetricCard label="Food saved" value={settings.weightUnit.startsWith('Pounds') ? Math.round(demoImpact.foodSavedKg * 2.20462) : demoImpact.foodSavedKg} unit={settings.weightUnit.startsWith('Pounds') ? 'lb' : 'kg'} note="Illustrative monthly estimate" icon="♧" /><MetricCard label="Meals potentially preserved" value={demoImpact.mealsPreserved.toLocaleString()} unit="meals" note="Estimated from demo assumptions" icon="♡" tone="mint" /><MetricCard label="Estimated cost savings" value={`₹${demoImpact.costSaved.toLocaleString('en-IN')}`} unit="" note="Illustrative monthly estimate · INR assumption" icon="↗" tone="yellow" /><MetricCard label="Recorded leftover rate" value={`${wastePercent.toFixed(1)}`} unit="%" note={`From ${records.length} synthetic records`} icon="◉" tone="peach" /></div>
      <div className="analytics-grid impact-grid"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">MONTHLY ESTIMATE</p><h2>Recorded leftover trend</h2></div><span className="chart-unit">Meals</span></div><Chart values={monthly.values} labels={monthly.labels} label="Monthly demo leftovers" /></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">ILLUSTRATIVE COMPARISON</p><h2>Before vs. with guidance</h2></div><Badge>ESTIMATED</Badge></div><div className="comparison"><div><span>Baseline plan</span><strong>100</strong><small>index · illustrative</small><div className="comparison-bar"><i style={{ width: '100%' }} /></div></div><div><span>With prep guidance</span><strong>{(100 - demoImpact.reductionPercent).toFixed(1)}</strong><small>index · illustrative</small><div className="comparison-bar improved"><i style={{ width: `${100 - demoImpact.reductionPercent}%` }} /></div></div></div><p className="small-disclaimer">Illustrative index based on the demo reduction assumption; not measured performance.</p></section></div>
      <section className="panel progress-panel"><div className="panel-heading"><div><p className="eyebrow">DEMO GOAL TRACKER</p><h2>Progress indicators</h2></div><span className="chart-unit">Illustrative</span></div><div className="progress-items">{[['Estimated waste avoided', demoImpact.reductionPercent, '20% illustrative goal'], ['Estimated meal preservation', 64, '65% illustrative goal'], ['Data coverage', Math.min(100, Math.round((records.length / 270) * 100)), `${records.length} / 270 demo records`]].map(([label, progress, note]) => <div key={label}><div><strong>{label}</strong><span>{progress}%</span></div><div className="progress-track"><i style={{ width: `${Math.min(100, progress)}%` }} /></div><small>{note}</small></div>)}</div></section>
    </>
  );
}

const recordFields = [
  ['date', 'Date', 'date'],
  ['attendance', 'Attendance', 'number'],
  ['menu', 'Menu', 'text'],
  ['foodItem', 'Food item', 'text'],
  ['plannedQuantity', 'Planned quantity', 'number'],
  ['actualConsumption', 'Actual consumption', 'number'],
  ['weather', 'Weather', 'text'],
  ['holiday', 'Holiday', 'checkbox'],
  ['event', 'Event', 'text'],
];

function emptyRecord() {
  return { date: new Date().toISOString().slice(0, 10), attendance: '', menu: '', foodItem: '', category: 'Main course', plannedQuantity: '', actualConsumption: '', weather: 'Sunny', holiday: false, event: '' };
}

function RecordModal({ record, onSave, onClose, error }) {
  const [form, setForm] = useState(record ?? emptyRecord());
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card record-modal" role="dialog" aria-modal="true" aria-labelledby="record-modal-title" onSubmit={(event) => { event.preventDefault(); onSave(form); }}><button type="button" className="modal-close" onClick={onClose} aria-label="Close form">×</button><Badge>{record ? 'EDIT RECORD' : 'NEW RECORD'}</Badge><h2 id="record-modal-title">{record ? 'Update food record' : 'Add food record'}</h2><div className="record-form-grid">{recordFields.map(([key, label, type]) => <label key={key} className={`record-field ${type === 'checkbox' ? 'checkbox-field' : ''}`}><span>{label}</span>{type === 'checkbox' ? <input type="checkbox" checked={Boolean(form[key])} onChange={(event) => change(key, event.target.checked)} /> : <input type={type} min={type === 'number' ? '0' : undefined} required={type !== 'checkbox'} value={form[key] ?? ''} onChange={(event) => change(key, event.target.value)} />}</label>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-buttons"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Save record</button></div></form></div>;
}

function DataManagement({ records, setRecords }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [ascending, setAscending] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalError, setModalError] = useState('');
  const [notice, setNotice] = useState('');
  const [importError, setImportError] = useState('');
  const fileInput = useRef(null);
  const filtered = useMemo(() => records.filter((record) => {
    const matchesQuery = `${record.foodItem} ${record.menu} ${record.date} ${record.category}`.toLowerCase().includes(query.toLowerCase());
    const risk = formatRiskFromSurplus(record.plannedQuantity, record.actualConsumption);
    return matchesQuery && (filter === 'all' || risk === filter);
  }).sort((a, b) => {
    const left = a[sortBy] ?? '';
    const right = b[sortBy] ?? '';
    const comparison = typeof left === 'number' ? left - Number(right) : String(left).localeCompare(String(right));
    return ascending ? comparison : -comparison;
  }), [records, query, filter, sortBy, ascending]);

  const saveRecord = (form) => {
    try {
      if (!isValidIsoDate(form.date)) throw new Error('Enter a valid date in YYYY-MM-DD format.');
      const plannedQuantity = Number(form.plannedQuantity);
      const actualConsumption = Number(form.actualConsumption);
      const attendance = Number(form.attendance);
      if ([plannedQuantity, actualConsumption, attendance].some((number) => !Number.isFinite(number) || number < 0)) throw new Error('Attendance, planned quantity, and consumption must be non-negative numbers.');
      const { leftover } = calculateRecordMetrics({ plannedQuantity, actualConsumption });
      const saved = { ...form, id: form.id || `record-${Date.now()}`, attendance, plannedQuantity, actualConsumption, leftover };
      setRecords((current) => form.id ? current.map((record) => record.id === form.id ? saved : record) : [saved, ...current]);
      setEditing(null); setModalError(''); setNotice(form.id ? 'Record updated.' : 'Record added.');
    } catch (caught) { setModalError(caught.message); }
  };

  const importFile = (file) => {
    setImportError(''); setNotice('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) {
      setImportError('Choose a CSV file smaller than 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = validateCsv(String(reader.result ?? ''), records.length);
        setRecords((current) => [...imported, ...current]);
        setNotice(`${imported.length} records imported successfully.`);
        if (fileInput.current) fileInput.current.value = '';
      } catch (caught) { setImportError(caught.message); }
    };
    reader.onerror = () => setImportError('Unable to read the file. Please try another CSV.');
    reader.readAsText(file);
  };

  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE DATA</p><h1>Data management</h1><p>Add, review, and maintain food-service records.</p></div><div className="heading-actions"><button className="button button-outline" onClick={() => fileInput.current?.click()}>↑ Upload CSV</button><button className="button button-primary" onClick={() => { setEditing(emptyRecord()); setModalError(''); }}>＋ Add record</button><input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => importFile(event.target.files?.[0])} /></div></div>
      <div className="demo-notice compact-notice"><span>i</span><div><strong>Demo dataset · {records.length} records</strong><small>Changes are saved in this browser. Uploaded data stays on this device.</small></div><button onClick={() => { if (window.confirm('Delete all records? This cannot be undone.')) { setRecords([]); setNotice('All records deleted.'); } }}>Clear all <span>×</span></button></div>
      {(notice || importError) && <div className={`inline-notice ${importError ? 'inline-error' : ''}`} role={importError ? 'alert' : 'status'}>{importError || notice}<button onClick={() => { setNotice(''); setImportError(''); }} aria-label="Dismiss message">×</button></div>}
      <section className="panel data-panel"><div className="data-toolbar"><div className="search-field"><span>⌕</span><label className="sr-only" htmlFor="record-search">Search records</label><input id="record-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search food, menu, or date…" /></div><label className="filter-select"><span className="sr-only">Filter by waste risk</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All risk levels</option><option value="LOW">Low risk</option><option value="MEDIUM">Medium risk</option><option value="HIGH">High risk</option></select></label><span className="result-count">{filtered.length} records</span></div><div className="table-scroll"><table><thead><tr>{[['date', 'Date'], ['foodItem', 'Food item'], ['menu', 'Menu'], ['attendance', 'Attendance'], ['plannedQuantity', 'Prepared'], ['actualConsumption', 'Consumed'], ['leftover', 'Leftover']].map(([key, label]) => <th key={key}><button className="sort-button" onClick={() => { if (sortBy === key) setAscending(!ascending); else { setSortBy(key); setAscending(true); } }}>{label}{sortBy === key ? (ascending ? ' ↑' : ' ↓') : ''}</button></th>)}<th>Risk</th><th>Actions</th></tr></thead><tbody>{filtered.slice(0, 100).map((record) => <tr key={record.id}><td>{record.date}</td><td><strong>{record.foodItem}</strong></td><td>{record.menu}</td><td>{record.attendance.toLocaleString()}</td><td>{record.plannedQuantity.toLocaleString()}</td><td>{record.actualConsumption.toLocaleString()}</td><td>{record.leftover.toLocaleString()}</td><td><RiskBadge risk={formatRiskFromSurplus(record.plannedQuantity, record.actualConsumption)} /></td><td><div className="row-actions"><button onClick={() => { setEditing(record); setModalError(''); }} aria-label={`Edit ${record.foodItem} record`}>Edit</button><button onClick={() => { setRecords((current) => current.filter((item) => item.id !== record.id)); setNotice('Record deleted.'); }} aria-label={`Delete ${record.foodItem} record`}>Delete</button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state">No records match those filters. Try a different search or add a record.</div>}{filtered.length > 100 && <p className="table-hint">Showing the first 100 records. Narrow your search to see more.</p>}</div><p className="table-hint">Select a column heading to sort. CSV columns: date, attendance, menu, food_item, category, planned_quantity, actual_consumption, leftover, weather, holiday, event.</p></section>
      {editing && <RecordModal record={editing.id ? editing : null} onSave={saveRecord} onClose={() => setEditing(null)} error={modalError} />}
    </>
  );
}

function Settings({ settings, setSettings, error }) {
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">WORKSPACE PREFERENCES</p><h1>Settings</h1><p>Configure default assumptions for this demo workspace.</p></div><Badge>SAVED IN THIS BROWSER</Badge></div>
      <div className="settings-layout"><div className="settings-nav"><a href="#organization">Organization</a><a href="#cafeteria">Cafeteria</a><a href="#prediction-preferences">Prediction preferences</a><a href="#notifications">Notifications</a><a href="#units">Units & currency</a><a href="#account">Account</a></div><div className="settings-sections">
        <section className="panel settings-panel" id="organization"><div className="settings-heading"><span>01</span><div><h2>Organization</h2><p>Basic details for your workspace.</p></div></div><label className="settings-field"><span>Organization name</span><input value={settings.organization} onChange={(event) => update('organization', event.target.value)} /></label><label className="settings-field"><span>Organization type</span><select value={settings.organizationType} onChange={(event) => update('organizationType', event.target.value)}><option>College / campus</option><option>Restaurant</option><option>Hotel</option><option>Hospital</option><option>Corporate cafeteria</option></select></label></section>
        <section className="panel settings-panel" id="cafeteria"><div className="settings-heading"><span>02</span><div><h2>Cafeteria</h2><p>Set your default service location.</p></div></div><label className="settings-field"><span>Cafeteria name</span><input value={settings.cafeteria} onChange={(event) => update('cafeteria', event.target.value)} /></label><label className="settings-field"><span>Default serving size</span><div className="input-with-unit"><input type="number" min="1" value={settings.servingSize} onChange={(event) => update('servingSize', event.target.value)} /><span>g / meal</span></div></label></section>
        <section className="panel settings-panel" id="prediction-preferences"><div className="settings-heading"><span>03</span><div><h2>Prediction preferences</h2><p>Adjust the buffer used in production recommendations.</p></div></div><label className="settings-field"><span>Safety buffer</span><div className="input-with-unit"><input type="number" min="0" max="25" value={settings.safetyBuffer} onChange={(event) => update('safetyBuffer', event.target.value)} /><span>%</span></div></label><p className="settings-helper">Used by the deterministic demo prediction engine. Choose a value from 0% to 25%.</p>{error && <p className="form-error" role="alert">{error}</p>}</section>
        <section className="panel settings-panel" id="notifications"><div className="settings-heading"><span>04</span><div><h2>Notifications</h2><p>Choose which operational reminders you want.</p></div></div><label className="settings-toggle"><span><strong>Daily prediction summary</strong><small>Show a reminder to review the daily estimate.</small></span><input type="checkbox" checked={settings.dailySummary} onChange={(event) => update('dailySummary', event.target.checked)} /></label><label className="settings-toggle"><span><strong>High waste-risk notice</strong><small>Flag a plan that is well above predicted demand.</small></span><input type="checkbox" checked={settings.riskNotice} onChange={(event) => update('riskNotice', event.target.checked)} /></label></section>
        <section className="panel settings-panel" id="units"><div className="settings-heading"><span>05</span><div><h2>Units & currency</h2><p>Configure display preferences.</p></div></div><label className="settings-field"><span>Currency</span><select value={settings.currency} onChange={(event) => update('currency', event.target.value)}><option>INR (₹)</option><option>USD ($)</option><option>EUR (€)</option></select></label><label className="settings-field"><span>Weight unit</span><select value={settings.weightUnit} onChange={(event) => update('weightUnit', event.target.value)}><option>Kilograms (kg)</option><option>Pounds (lb)</option></select></label><p className="settings-helper">Demo financial estimates remain INR-based; selecting another currency changes the saved preference only (no exchange-rate conversion).</p></section>
        <section className="panel settings-panel" id="account"><div className="settings-heading"><span>06</span><div><h2>Account</h2><p>This is a local demo account—no authentication is connected.</p></div></div><div className="account-card"><span className="profile-avatar">A</span><div><strong>Alex Morgan</strong><small>Administrator · Demo account</small></div><Badge>DEMO</Badge></div></section>
      </div></div>
    </>
  );
}

function getDailySeries(records, days, field) {
  const keys = [];
  const values = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const recordsForDay = records.filter((record) => record.date === key);
    const value = recordsForDay.reduce((sum, record) => sum + (field === 'leftover' ? record.leftover : field === 'planned' ? record.plannedQuantity : record.actualConsumption), 0);
    keys.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    values.push(value);
  }
  return { labels: keys, values };
}

function getComparisonSeries(records, mode) {
  const buckets = new Map();
  records.forEach((record) => {
    const current = buckets.get(record.date) ?? {
      date: record.date,
      attendance: record.attendance,
      menu: record.menu,
      holiday: Boolean(record.holiday),
      event: Boolean(record.event),
      planned: 0,
      consumed: 0,
    };
    current.planned += record.plannedQuantity;
    current.consumed += record.actualConsumption;
    buckets.set(record.date, current);
  });
  const days = [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const labels = days.map(({ date }) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  if (mode === 'production') {
    return [
      { name: 'Planned production', color: '#81988a', labels, values: days.map((day) => day.planned) },
      { name: 'Actual consumption', color: '#16845b', labels, values: days.map((day) => day.consumed) },
    ];
  }
  const predicted = days.map((day) => predictDemand({
    attendance: day.attendance,
    temperature: 24,
    plannedProduction: day.planned,
    menu: day.menu,
    dayOfWeek: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
    holiday: day.holiday,
    event: day.event,
  }).predictedConsumption);
  return [
    { name: 'Predicted consumption', color: '#16845b', labels, values: predicted },
    { name: 'Actual consumption', color: '#9aa99e', labels, values: days.map((day) => day.consumed) },
  ];
}

function filterPeriod(records, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  const cutoffString = cutoff.toISOString().slice(0, 10);
  return records.filter((record) => record.date >= cutoffString);
}

function aggregateByDay(records, field, maxPoints) {
  const buckets = new Map();
  records.forEach((record) => buckets.set(record.date, (buckets.get(record.date) ?? 0) + record[field]));
  const entries = [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-maxPoints);
  return { values: entries.map(([, value]) => value), labels: entries.map(([date]) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) };
}

function aggregateByWeek(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const date = new Date(`${record.date}T00:00:00`);
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + record.leftover);
  });
  const entries = [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right));
  return { values: entries.map(([, value]) => value), labels: entries.map(([date]) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) };
}

function aggregateByMonth(records, field) {
  const buckets = new Map();
  records.forEach((record) => {
    const key = record.date.slice(0, 7);
    buckets.set(key, (buckets.get(key) ?? 0) + record[field]);
  });
  const entries = [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right));
  return { values: entries.map(([, value]) => value), labels: entries.map(([date]) => new Date(`${date}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' })) };
}

function aggregateByField(records, field, metric) {
  const buckets = new Map();
  records.forEach((record) => buckets.set(record[field], (buckets.get(record[field]) ?? 0) + record[metric]));
  return [...buckets.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function summarizeItems(records) {
  const buckets = new Map();
  records.forEach((record) => {
    const item = buckets.get(record.foodItem) ?? { foodItem: record.foodItem, category: record.category, prepared: 0, consumed: 0, leftover: 0 };
    item.prepared += record.plannedQuantity; item.consumed += record.actualConsumption; item.leftover += record.leftover;
    buckets.set(record.foodItem, item);
  });
  return [...buckets.values()].map((item) => ({ ...item, wastePercent: item.prepared ? (item.leftover / item.prepared) * 100 : 0, risk: formatRiskFromSurplus(item.prepared, item.consumed) })).sort((a, b) => b.leftover - a.leftover);
}

function createInsights(records) {
  if (!records.length) return [];
  const items = summarizeItems(records);
  const days = new Map();
  records.forEach((record) => {
    const weekday = new Date(`${record.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
    const bucket = days.get(weekday) ?? { leftover: 0, prepared: 0 };
    bucket.leftover += record.leftover; bucket.prepared += record.plannedQuantity; days.set(weekday, bucket);
  });
  const weekdayPatterns = [...days.entries()].map(([day, value]) => ({ day, rate: value.prepared ? value.leftover / value.prepared : 0 })).sort((a, b) => b.rate - a.rate);
  const highestWaste = items[0];
  const lowestWaste = items.at(-1);
  const overallLeftover = records.reduce((sum, record) => sum + record.leftover, 0);
  const overallPrepared = records.reduce((sum, record) => sum + record.plannedQuantity, 0);
  return [
    { title: `${highestWaste.foodItem} has the highest recorded surplus`, explanation: `Among the food items in this dataset, ${highestWaste.foodItem} accounts for the largest total leftover quantity. Consider reviewing its portion plan alongside service context.`, metric: `${highestWaste.leftover.toLocaleString()} meals`, support: `${highestWaste.wastePercent.toFixed(1)}% of prepared quantity`, strength: 'Strong' },
    { title: `${weekdayPatterns[0].day} shows the highest leftover rate`, explanation: `The synthetic records show a higher leftover share on ${weekdayPatterns[0].day}s than on other days. This is descriptive and does not establish why the difference occurs.`, metric: `${(weekdayPatterns[0].rate * 100).toFixed(1)}%`, support: `${weekdayPatterns[0].day} leftover rate`, strength: 'Moderate' },
    { title: `${lowestWaste.foodItem} has the lowest surplus share`, explanation: `${lowestWaste.foodItem} has the smallest share of prepared quantity left over among the available food items in the current demo dataset.`, metric: `${lowestWaste.wastePercent.toFixed(1)}%`, support: `Of ${lowestWaste.prepared.toLocaleString()} meals prepared`, strength: 'Moderate' },
    { title: 'A baseline to compare against', explanation: `Across the selected demo records, total leftovers are ${overallLeftover.toLocaleString()} meals. Use this as an exploratory baseline when testing changes to recorded plans.`, metric: `${overallPrepared ? ((overallLeftover / overallPrepared) * 100).toFixed(1) : 0}%`, support: 'Overall recorded leftover share', strength: 'Moderate' },
  ];
}

function App() {
  const [page, setPage] = useState('landing');
  const [records, setRecords] = useState(() => {
    try {
      const saved = window.localStorage.getItem('wastewise-records-v1');
      return saved ? JSON.parse(saved) : createDemoRecords();
    } catch {
      return createDemoRecords();
    }
  });
  const [predictionInput, setPredictionInput] = useState(defaultToday);
  const [prediction, setPrediction] = useState(() => predictDemand({ ...defaultToday, safetyBufferPercent: 2 }));
  const [predictionError, setPredictionError] = useState('');
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [settings, setSettings] = useState(() => {
    try {
      return { organization: 'Greenfield Campus', organizationType: 'College / campus', cafeteria: 'Central Cafeteria', servingSize: '450', safetyBuffer: '2', currency: 'INR (₹)', weightUnit: 'Kilograms (kg)', dailySummary: true, riskNotice: true, ...JSON.parse(window.localStorage.getItem('wastewise-settings-v1') || '{}') };
    } catch { return { organization: 'Greenfield Campus', organizationType: 'College / campus', cafeteria: 'Central Cafeteria', servingSize: '450', safetyBuffer: '2', currency: 'INR (₹)', weightUnit: 'Kilograms (kg)', dailySummary: true, riskNotice: true }; }
  });

  useEffect(() => {
    try { window.localStorage.setItem('wastewise-records-v1', JSON.stringify(records)); }
    catch { /* Browser storage may be unavailable; the current session remains usable. */ }
  }, [records]);
  useEffect(() => {
    try { window.localStorage.setItem('wastewise-settings-v1', JSON.stringify(settings)); }
    catch { /* Settings remain active for the current session. */ }
  }, [settings]);
  useEffect(() => {
    let active = true;
    setPredictionError('');
    predictionService.predict({ ...predictionInput, safetyBufferPercent: settings.safetyBuffer })
      .then((result) => { if (active) setPrediction(result); })
      .catch((error) => { if (active) setPredictionError(error.message); });
    return () => { active = false; };
  }, [predictionInput, settings.safetyBuffer]);

  if (page === 'landing') return <Landing onLaunch={() => setPage('dashboard')} />;
  let content;
  if (page === 'dashboard') content = <Dashboard records={records} prediction={prediction} settings={settings} onNavigate={setPage} onExplain={() => setExplanationOpen(true)} />;
  if (page === 'predictions') content = <Predictions records={records} prediction={prediction} onExplain={() => setExplanationOpen(true)} />;
  if (page === 'simulator') content = <Simulator predictionInput={predictionInput} setPredictionInput={setPredictionInput} prediction={prediction} safetyBufferPercent={Number(settings.safetyBuffer)} onReset={() => { setPredictionError(''); setPredictionInput(defaultToday); }} error={predictionError} />;
  if (page === 'analytics') content = <Analytics records={records} onFoodClick={setSelectedFood} />;
  if (page === 'insights') content = <Insights records={records} />;
  if (page === 'impact') content = <Impact records={records} settings={settings} />;
  if (page === 'data') content = <DataManagement records={records} setRecords={setRecords} />;
  if (page === 'settings') content = <Settings settings={settings} setSettings={setSettings} error={predictionError} />;
  return <AppShell page={page} setPage={setPage} settings={settings} onHome={() => setPage('landing')}>{content}{explanationOpen && <ExplanationModal prediction={prediction} onClose={() => setExplanationOpen(false)} />}{selectedFood && <FoodDetailModal item={selectedFood} records={records} onClose={() => setSelectedFood(null)} />}</AppShell>;
}

export default App;
