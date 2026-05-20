/* =====================================================================
   PDF Variation B — "Bold Sport"
   Coach-driven accent. Fully data-driven and adaptive.

   STRUCTURE:
     1. Cover
     2. Goals (parameters → sub-goals hierarchy)
     3. Mesocycle arc (full page, adaptive grid)
     4..N. One page per mesocycle: intensity progression + rep week + legend
     N+1. Why these methods (grouped under parameters)
   ===================================================================== */

(function injectCoachAccent() {
  if (document.getElementById('coach-accent-vars')) return;
  const style = document.createElement('style');
  style.id = 'coach-accent-vars';
  const a = samplePlan.coach && samplePlan.coach.accent || '#D4572C';
  const ai = samplePlan.coach && samplePlan.coach.accentInk || '#FFFFFF';
  style.textContent = `:root { --accent: ${a}; --accent-ink: ${ai}; }`;
  document.head.appendChild(style);
})();

const bStyles = {
  page: {
    width: window.A4.w + 'px',
    height: window.A4.h + 'px',
    background: 'var(--bg)',
    color: 'var(--fg)',
    fontFamily: 'var(--font-sans)',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-print)',
    flexShrink: 0
  },
  pageInner: {
    padding: '48px 48px 84px 48px',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column'
  },
  pageHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 14, marginBottom: 24,
    borderBottom: '2px solid var(--ink)'
  },
  sectionEyebrow: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase',
    color: 'var(--accent)'
  },
  sectionTitle: {
    fontFamily: 'var(--font-sans)', fontSize: 38, fontWeight: 800,
    letterSpacing: '-0.025em', lineHeight: 1.0, margin: '6px 0 0',
    color: 'var(--ink)'
  },
  footer: {
    position: 'absolute', left: 48, right: 48, bottom: 26,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.04em'
  }
};

function BFooter({ pageNum, total }) {
  return (
    <>
      <div style={bStyles.footer}>
        <span style={{ fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          {samplePlan.coach.studio}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {pageNum} / {total}
        </span>
      </div>
      <div style={{
        position: 'absolute', bottom: 8, left: 0, right: 0,
        textAlign: 'center', fontSize: 9, color: 'var(--fg-4)',
        letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500
      }}>
        Created with plan-prep-coach
      </div>
    </>
  );
}

/* Reusable intensity legend strip */
function IntensityLegend({ keys }) {
  const ks = keys || ["off", "easy", "easy-moderate", "moderate", "moderate-hard", "hard", "extremely-hard"];
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
      padding: '8px 14px', background: 'var(--bg-elev)',
      border: '1px solid var(--border)', borderRadius: 8,
    }}>
      {ks.map((k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 12, height: 12, borderRadius: 3,
            background: intensityColor(k), border: '1px solid var(--border)',
          }} />
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--fg-1)',
          }}>{intensityLabel(k)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Cover ---------- */
function BPageCover() {
  const totals = planTotals(samplePlan);
  return (
    <div style={{ ...bStyles.page, background: 'var(--ink)', color: 'var(--ink-fg)' }}>
      <div style={{
        position: 'absolute', top: -20, right: -40,
        fontFamily: 'var(--font-sans)', fontSize: 480, fontWeight: 800,
        letterSpacing: '-0.06em', lineHeight: 0.8,
        color: 'var(--accent)', opacity: 0.16,
        pointerEvents: 'none'
      }}>{totals.microcycles}</div>

      <div style={{
        position: 'absolute', top: 48, left: 48, right: 48,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <img src={samplePlan.coach.logo} alt={samplePlan.coach.studio} style={{ height: 30, width: 'auto', display: 'block', filter: 'invert(1)' }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.04em' }}>
          {samplePlan.plan.createdOn.toUpperCase()}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 48, right: 48, top: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 24 }}>
          Macrocycle · {totals.microcycles} Microcycles · 2026
        </div>
        {(() => {
          // Split plan title for the cover treatment.
          // "Spring Prep — 2026 Outdoor Season"
          //   → primary: "Spring Prep"
          //   → secondary: "2026 Outdoor Season"
          // Falls back gracefully if there's no separator.
          const raw = samplePlan.plan.title || "Training Plan";
          const sep = raw.match(/[—–-]/);
          let primary = raw, secondary = '';
          if (sep) {
            const i = raw.indexOf(sep[0]);
            primary = raw.slice(0, i).trim();
            secondary = raw.slice(i + 1).trim();
          }
          // Adaptive font size: longer titles shrink so they don't overflow.
          const longest = Math.max(primary.length, secondary.length);
          const fontSize = longest > 18 ? 78 : longest > 12 ? 96 : 120;
          return (
            <h1 style={{
              fontFamily: 'var(--font-sans)', fontSize, lineHeight: 0.92,
              letterSpacing: '-0.045em', margin: 0, fontWeight: 800,
              color: 'var(--ink-fg)', textTransform: 'uppercase'
            }}>
              {primary}
              {secondary && <><br /><span style={{ color: 'var(--accent)' }}>{secondary}</span></>}
            </h1>
          );
        })()}
      </div>

      <div style={{
        position: 'absolute', left: 48, right: 48, bottom: 100,
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24,
        alignItems: 'center', padding: '20px 24px',
        background: 'rgba(255,255,255,0.06)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)'
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--accent)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.04em'
        }}>{samplePlan.athlete.avatar}</div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-4)', marginBottom: 6 }}>
            Programmed for
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: '#fff' }}>
            {samplePlan.athlete.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 6 }}>
            {samplePlan.athlete.sport} · {samplePlan.athlete.team || samplePlan.athlete.level}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-4)', marginBottom: 6 }}>Coach</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{samplePlan.coach.name}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>{samplePlan.coach.role}</div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 48, right: 48, bottom: 56,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.14)',
        fontSize: 11, color: 'var(--fg-4)', letterSpacing: '0.06em'
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{samplePlan.plan.startDate}</span>
        <span style={{ fontFamily: 'var(--font-sans)', letterSpacing: '0.32em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--accent)' }}>
          → {totals.microcycles} Microcycles · {totals.days}d →
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{samplePlan.plan.endDate}</span>
      </div>

      <div style={{
        position: 'absolute', bottom: 14, left: 0, right: 0,
        textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)',
        letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500
      }}>Created with plan-prep-coach</div>
    </div>
  );
}

/* ---------- Goals page: bezier tree (main goals → sub-goals) ---------- */
function GoalNode({ goal, kind }) {
  // kind: "main" | "sub"
  const isMain = kind === "main";
  return (
    <div style={{
      padding: isMain ? '14px 16px 16px' : '12px 14px 14px',
      background: isMain ? 'var(--ink)' : 'var(--bg-elev)',
      color: isMain ? 'var(--ink-fg)' : 'var(--fg)',
      border: isMain ? 'none' : '1px solid var(--border)',
      borderRadius: 10,
      position: 'relative',
      minHeight: isMain ? 100 : 86,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: isMain ? '0 4px 14px rgba(0,0,0,0.08)' : 'none',
    }}>
      <div>
        <div style={{
          fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: isMain ? 'var(--accent)' : 'var(--fg-3)', marginBottom: 6
        }}>{isMain ? 'Main Goal' : 'Sub-goal'}</div>
        <div style={{
          fontSize: isMain ? 14 : 12.5,
          fontWeight: 800, letterSpacing: '-0.01em',
          lineHeight: 1.2, color: isMain ? '#fff' : 'var(--ink)'
        }}>{goal.name}</div>
      </div>
      <div style={{
        marginTop: 10, paddingTop: 8,
        borderTop: isMain ? '1px solid rgba(255,255,255,0.14)' : '1px dashed var(--border)',
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        gap: 6, alignItems: 'baseline',
        fontFamily: 'var(--font-mono)', fontSize: 10
      }}>
        <div>
          <div style={{ fontSize: 7.5, color: isMain ? 'var(--fg-4)' : 'var(--fg-3)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>Baseline</div>
          <div style={{ color: isMain ? 'var(--fg-4)' : 'var(--fg-1)' }}>{goal.baseline}</div>
        </div>
        <div style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 800, alignSelf: 'center' }}>→</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 7.5, color: 'var(--accent)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>Target</div>
          <div style={{ color: isMain ? '#fff' : 'var(--ink)', fontWeight: 700 }}>{goal.target}</div>
        </div>
      </div>
    </div>
  );
}

function GoalsTree() {
  const containerRef = React.useRef(null);
  const mainRefs = React.useRef({});
  const subRefs = React.useRef({});
  const [edges, setEdges] = React.useState([]);
  const [subEdges, setSubEdges] = React.useState([]);
  const [mainEdges, setMainEdges] = React.useState([]);

  const main = samplePlan.mainGoals;
  const subs = samplePlan.subGoals;

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const cb = containerRef.current.getBoundingClientRect();
    const ed = [];
    const subEd = [];
    const mainEd = [];
    for (const sg of subs) {
      const sb = subRefs.current[sg.id]?.getBoundingClientRect();
      if (!sb) continue;
      const sx = sb.left + sb.width / 2 - cb.left;
      const sy = sb.top - cb.top;
      // sub → main (top)
      for (const mgId of sg.contributesTo) {
        const mb = mainRefs.current[mgId]?.getBoundingClientRect();
        if (!mb) continue;
        const mx = mb.left + mb.width / 2 - cb.left;
        const my = mb.bottom - cb.top;
        ed.push({ key: `${sg.id}-${mgId}`, mx, my, sx, sy });
      }
      // sub → sub (sideways via curve below)
      for (const otherId of sg.contributesToSubs || []) {
        const ob = subRefs.current[otherId]?.getBoundingClientRect();
        if (!ob) continue;
        const fx = sb.left + sb.width / 2 - cb.left;
        const fy = sb.bottom - cb.top;
        const tx = ob.left + ob.width / 2 - cb.left;
        const ty = ob.bottom - cb.top;
        subEd.push({ key: `sub-${sg.id}-${otherId}`, fx, fy, tx, ty });
      }
    }
    // main → main (curve BELOW the main row, anchored at card bottoms)
    for (const mg of main) {
      const fb = mainRefs.current[mg.id]?.getBoundingClientRect();
      if (!fb) continue;
      for (const otherId of mg.contributesTo || []) {
        const tb = mainRefs.current[otherId]?.getBoundingClientRect();
        if (!tb) continue;
        const fx = fb.left + fb.width / 2 - cb.left;
        const fy = fb.bottom - cb.top;
        const tx = tb.left + tb.width / 2 - cb.left;
        const ty = tb.bottom - cb.top;
        mainEd.push({ key: `main-${mg.id}-${otherId}`, fx, fy, tx, ty });
      }
    }
    setEdges(ed);
    setSubEdges(subEd);
    setMainEdges(mainEd);
  }, []);

  const mainCols = main.length;
  const subCols = subs.length;
  // Equal columns for each tier — each tier independent.
  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Main goals row — staggered vertically, like sub-goals, so
          main↔main curves below have room without crossing cards. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${mainCols}, 1fr)`,
        gap: 14,
        alignItems: 'start',
        position: 'relative', zIndex: 2
      }}>
        {main.map((g, i) => (
          <div key={g.id} ref={(el) => { mainRefs.current[g.id] = el; }}
               style={{ marginTop: i % 2 === 1 ? 24 : 0 }}>
            <GoalNode goal={g} kind="main" />
          </div>
        ))}
      </div>

      {/* Spacer for the bezier band */}
      <div style={{ flex: 1, minHeight: 100, position: 'relative' }} />

      {/* Sub-goals row — staggered (alternating vertical offset) for room
          to draw inter-sub-goal connections without crossings. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${subCols}, 1fr)`,
        gap: 10,
        alignItems: 'start',
        position: 'relative', zIndex: 2
      }}>
        {subs.map((g, i) => (
          <div key={g.id} ref={(el) => { subRefs.current[g.id] = el; }}
               style={{ marginTop: i % 2 === 1 ? 32 : 0 }}>
            <GoalNode goal={g} kind="sub" />
          </div>
        ))}
      </div>

      {/* SVG overlay for bezier connectors — behind the cards (zIndex:1). */}
      <svg style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', overflow: 'visible', zIndex: 1
      }}>
        <defs>
          <linearGradient id="edge-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.7" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.3" />
          </linearGradient>
          <marker id="edge-arrow" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" opacity="0.7" />
          </marker>
        </defs>
        {edges.map((e) => {
          const dy = (e.sy - e.my) / 2;
          const c1y = e.my + dy;
          const c2y = e.sy - dy;
          const d = `M ${e.mx} ${e.my} C ${e.mx} ${c1y}, ${e.sx} ${c2y}, ${e.sx} ${e.sy}`;
          return (
            <g key={e.key}>
              <path d={d} fill="none" stroke="url(#edge-grad)" strokeWidth="2" />
              <circle cx={e.mx} cy={e.my} r="3.5" fill="var(--accent)" />
              <circle cx={e.sx} cy={e.sy} r="3.5" fill="var(--accent)" />
            </g>
          );
        })}
        {/* Sub-to-sub edges: same accent style as main↔sub, with arrow */}
        {subEdges.map((e) => {
          const midX = (e.fx + e.tx) / 2;
          const dist = Math.abs(e.tx - e.fx);
          const bow = Math.min(28 + dist * 0.18, 56);
          const cy = Math.max(e.fy, e.ty) + bow;
          const d = `M ${e.fx} ${e.fy} Q ${midX} ${cy}, ${e.tx} ${e.ty}`;
          return (
            <g key={e.key}>
              <path d={d} fill="none" stroke="url(#edge-grad)" strokeWidth="2"
                markerEnd="url(#edge-arrow)" />
              <circle cx={e.fx} cy={e.fy} r="3.5" fill="var(--accent)" />
            </g>
          );
        })}
        {/* Main-to-main edges: arc bowing BELOW the main row */}
        {mainEdges.map((e) => {
          const midX = (e.fx + e.tx) / 2;
          const dist = Math.abs(e.tx - e.fx);
          const bow = Math.min(28 + dist * 0.18, 56);
          const cy = Math.max(e.fy, e.ty) + bow;
          const d = `M ${e.fx} ${e.fy} Q ${midX} ${cy}, ${e.tx} ${e.ty}`;
          return (
            <g key={e.key}>
              <path d={d} fill="none" stroke="url(#edge-grad)" strokeWidth="2"
                markerEnd="url(#edge-arrow)" />
              <circle cx={e.fx} cy={e.fy} r="3.5" fill="var(--accent)" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BPageGoals({ pageNum, total }) {
  return (
    <div style={bStyles.page}>
      <div style={bStyles.pageInner}>
        <div style={bStyles.pageHeader}>
          <div>
            <div style={bStyles.sectionEyebrow}>01 / The Mission</div>
            <h2 style={bStyles.sectionTitle}>GOALS HIERARCHY</h2>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
            {samplePlan.mainGoals.length} MAIN · {samplePlan.subGoals.length} SUB-GOALS
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 24, maxWidth: 640, lineHeight: 1.55 }}>
          Top row: the <strong>main goals</strong> this plan is built to improve.
          Bottom row: the <strong>sub-goals</strong> that feed them. Lines show
          which goals contribute to which — sub→main, sub→sub, and main→main.
          Direction is shown by the arrowhead.
        </div>

        <GoalsTree />
      </div>
      <BFooter pageNum={pageNum} total={total} />
    </div>
  );
}

/* ---------- Mesocycle arc page (stacked rows, paginated) ---------- */
function MesocycleArcRow({ meso }) {
  const mcDays = meso.microcycles.reduce((s, mc) => s + mc.days.length, 0);
  // Stripe AND badge use the intensity color so the wizard color is consistent.
  const intensityCol = intensityColor(meso.intensityKey);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gap: 16,
      alignItems: 'stretch',
      padding: '16px 18px',
      background: 'var(--bg-elev)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      position: 'relative'
    }}>
      <div style={{ width: 6, background: intensityCol, borderRadius: 3 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', fontWeight: 700, letterSpacing: '0.18em' }}>
            M{String(meso.id).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)' }}>
            {meso.name.toUpperCase()}
          </div>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: '#fff', background: intensityCol,
            padding: '3px 8px', borderRadius: 3, marginLeft: 'auto'
          }}>{meso.intensityLabel}</div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 600 }}>
          {meso.microcycles.length} MC · {mcDays}d
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.5, marginTop: 2 }}>
          {meso.description}
        </div>
      </div>
      {/* Mini intensity preview — one bar per microcycle */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'flex-end',
        gap: 4, minWidth: 130
      }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--fg-3)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Microcycles
        </div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 36 }}>
          {meso.microcycles.map((mc, i) => {
            const k = microIntensityKey(mc);
            const HEIGHTS = {
              "off": 0.1, "deload": 0.22, "easy": 0.32, "easy-moderate": 0.46,
              "moderate": 0.58, "moderate-hard": 0.70, "hard": 0.84, "extremely-hard": 1.0,
            };
            return (
              <div key={i} style={{
                width: 10, height: `${(HEIGHTS[k] || 0.5) * 100}%`,
                background: intensityColor(k), borderRadius: 2
              }} title={`${mc.label} · ${intensityLabel(k)}`} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BPageArc({ chunk, pageNum, total, ordinal, isFirst, isContinued }) {
  const totalMesos = samplePlan.mesocycles.length;
  return (
    <div style={bStyles.page}>
      <div style={bStyles.pageInner}>
        <div style={bStyles.pageHeader}>
          <div>
            <div style={bStyles.sectionEyebrow}>{String(ordinal).padStart(2, '0')} / The Arc</div>
            <h2 style={bStyles.sectionTitle}>
              {totalMesos} MESOCYCLES{isContinued ? ' (CONT.)' : ''}
            </h2>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
            MACROCYCLE STRUCTURE
          </div>
        </div>

        {isFirst && (
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 24, maxWidth: 620, lineHeight: 1.55 }}>
            The macrocycle is divided into {totalMesos} blocks. Each one has a focus,
            an overall intensity character, and a stack of microcycles inside it.
            The story moves <strong>from base to peak</strong>.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {chunk.map((m) => <MesocycleArcRow key={m.id} meso={m} />)}
        </div>
      </div>
      <BFooter pageNum={pageNum} total={total} />
    </div>
  );
}

/* ---------- One page per mesocycle: progression + rep week + legend ---------- */
function MesocycleIntensityChart({ meso }) {
  const HEIGHTS = {
    "off": 0.05, "deload": 0.18, "easy": 0.28, "easy-moderate": 0.42,
    "moderate": 0.55, "moderate-hard": 0.68, "hard": 0.82, "extremely-hard": 1.0,
  };
  const CHART_H = 200;

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 12 }}>
        Microcycle Intensity Progression
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${meso.microcycles.length}, 1fr)`,
        gap: 6,
      }}>
        {meso.microcycles.map((mc, i) => {
          const k = microIntensityKey(mc);
          const tinted = `color-mix(in oklab, ${getComputedStyle(document.documentElement).getPropertyValue(`--intensity-${k}`).trim() || '#999'} 18%, white)`;
          return (
            <div key={`h${i}`} style={{
              border: '1px solid var(--border)', borderBottom: 'none',
              borderRadius: '6px 6px 0 0', padding: '8px 8px 7px',
              background: tinted, textAlign: 'center', minHeight: 44,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.005em', lineHeight: 1.1 }}>
                {mc.label.replace(/^MC\s+/, 'Week ').replace('· Deload', '(Deload)')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--fg-2)', marginTop: 3, fontWeight: 600 }}>
                {mc.dateRange} ({mc.days.length}d)
              </div>
            </div>
          );
        })}
        {meso.microcycles.map((mc, i) => {
          const k = microIntensityKey(mc);
          const isOff = k === 'off';
          const ratio = HEIGHTS[k] || 0.5;
          const h = ratio * CHART_H;
          return (
            <div key={`b${i}`} style={{
              border: '1px solid var(--border)',
              borderTop: '1px dashed var(--border)',
              borderRadius: '0 0 6px 6px', height: CHART_H,
              position: 'relative',
              background: 'repeating-linear-gradient(to top, transparent 0, transparent 24px, var(--border) 24px, var(--border) 25px)',
            }}>
              <div style={{
                position: 'absolute', left: '18%', right: '18%', bottom: 0, height: h,
                background: intensityColor(k), borderRadius: '4px 4px 0 0',
                opacity: isOff ? 0.55 : 1,
              }}>
                {ratio > 0.32 ? (
                  <div style={{
                    position: 'absolute', top: 6, left: 0, right: 0,
                    textAlign: 'center', fontSize: 8.5, fontWeight: 800,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: isOff ? 'var(--fg-2)' : '#fff', lineHeight: 1.1,
                  }}>{intensityLabel(k)}</div>
                ) : (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0,
                    textAlign: 'center', fontSize: 8.5, fontWeight: 800,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'var(--fg-2)', paddingBottom: 4, lineHeight: 1.1,
                  }}>{intensityLabel(k)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MesocycleRepWeek({ meso }) {
  // Column chart: each column = one day. Top half = intensity bar (height
  // proportional to load). Bottom = day label + focus title + main exercise.
  // Sets/reps deliberately omitted.
  const HEIGHTS = {
    "off": 0.06, "deload": 0.20, "easy": 0.30, "easy-moderate": 0.44,
    "moderate": 0.56, "moderate-hard": 0.70, "hard": 0.84, "extremely-hard": 1.0,
  };
  const CHART_H = 180;

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 10
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink)' }}>
          Representative Microcycle
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', fontWeight: 600, letterSpacing: '0.06em' }}>
          INTENSITY · FOCUS · MAIN WORK
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${meso.repSession.length}, 1fr)`,
        gap: 6,
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 8, paddingBottom: 12
      }}>
        {meso.repSession.map((s, i) => {
          const isOff = s.intensity === 'off';
          const h = (HEIGHTS[s.intensity] || 0.5);
          const col = intensityColor(s.intensity);
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'stretch',
              opacity: isOff ? 0.55 : 1,
            }}>
              {/* Bar plot */}
              <div style={{
                height: CHART_H, position: 'relative',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                marginBottom: 8,
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  height: `${h * 100}%`,
                  background: col,
                  borderRadius: '3px 3px 0 0',
                  position: 'relative',
                }}>
                  {/* Intensity label inside bar if tall enough; above bar if short */}
                  {h > 0.35 ? (
                    <div style={{
                      position: 'absolute', top: 4, left: 0, right: 0,
                      textAlign: 'center', fontSize: 7.5, fontWeight: 800,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: isOff ? 'var(--fg-2)' : '#fff',
                    }}>{intensityLabel(s.intensity)}</div>
                  ) : (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: 0, right: 0,
                      textAlign: 'center', fontSize: 7.5, fontWeight: 800,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: 'var(--fg-2)', paddingBottom: 3,
                    }}>{intensityLabel(s.intensity)}</div>
                  )}
                </div>
              </div>

              {/* Day label */}
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                color: 'var(--fg-3)', letterSpacing: '0.14em',
                textAlign: 'center', marginBottom: 6,
              }}>{s.day.toUpperCase()}</div>

              {/* Focus title */}
              <div style={{
                fontSize: 10.5, fontWeight: 800, letterSpacing: '-0.005em',
                lineHeight: 1.2, color: 'var(--ink)',
                textAlign: 'center', marginBottom: 5,
                minHeight: 26,
              }}>{s.title}</div>

              {/* Main work — exercise name only, prescription is intentionally hidden */}
              <div style={{
                fontSize: 9.5, color: 'var(--fg-2)', lineHeight: 1.35,
                textAlign: 'center', fontStyle: 'italic',
              }}>{s.exercise}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BPageMesocycle({ meso, pageNum, total, ordinal }) {
  const mcDays = meso.microcycles.reduce((s, mc) => s + mc.days.length, 0);
  return (
    <div style={bStyles.page}>
      <div style={bStyles.pageInner}>
        <div style={bStyles.pageHeader}>
          <div>
            <div style={bStyles.sectionEyebrow}>
              {String(ordinal).padStart(2, '0')} / Mesocycle {String(meso.id).padStart(2, '0')}
            </div>
            <h2 style={bStyles.sectionTitle}>{meso.name.toUpperCase()}</h2>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#fff', background: intensityColor(meso.intensityKey),
              padding: '5px 10px', borderRadius: 4
            }}>{meso.intensityLabel}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', textAlign: 'right' }}>
              {meso.dateRange} · {meso.microcycles.length} MC · {mcDays}d
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 14, alignItems: 'stretch',
          marginBottom: 24, paddingBottom: 0
        }}>
          <div style={{ width: 6, background: intensityColor(meso.intensityKey), borderRadius: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 14.5, color: 'var(--fg-1)', lineHeight: 1.55, flex: 1 }}>
            {meso.description}
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <MesocycleIntensityChart meso={meso} />
        </div>

        <div>
          <MesocycleRepWeek meso={meso} />
        </div>

        <div style={{ flex: 1 }} />
      </div>
      <BFooter pageNum={pageNum} total={total} />
    </div>
  );
}

/* ---------- Why these methods (grouped under parameters) ---------- */
function MethodCard({ method, index }) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10,
      padding: '12px 16px 14px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: 'var(--accent)'
      }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 800,
          letterSpacing: '-0.04em', color: 'var(--accent)', lineHeight: 1
        }}>{String(index + 1).padStart(2, '0')}</div>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.15,
            color: 'var(--ink)', margin: 0
          }}>{method.name.toUpperCase()}</h3>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--fg-3)' }}>
              IMPROVES →
            </span>
            {method.parameters.map((p, pi) =>
              <span key={pi} style={{
                padding: '2px 8px', background: 'var(--ink)', color: '#fff',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                borderRadius: 999
              }}>{p}</span>
            )}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--fg-1)', margin: '0 0 8px' }}>
        {method.rationale}
      </p>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 4 }}>
          Evidence
        </div>
        {method.citations.map((c, ci) =>
          <div key={ci} style={{
            fontSize: 9.5, color: 'var(--fg-2)', lineHeight: 1.45,
            marginTop: ci > 0 ? 3 : 0, fontFamily: 'var(--font-mono)'
          }}>→ {c}</div>
        )}
      </div>
    </div>
  );
}

function BPageWhy({ chunk, startIndex, pageNum, total, ordinal, isFirst }) {
  return (
    <div style={bStyles.page}>
      <div style={bStyles.pageInner}>
        <div style={bStyles.pageHeader}>
          <div>
            <div style={bStyles.sectionEyebrow}>{String(ordinal).padStart(2, '0')} / The Why</div>
            <h2 style={bStyles.sectionTitle}>SCIENCE BEHIND IT{isFirst ? '' : ' (CONT.)'}</h2>
          </div>
        </div>

        {isFirst && (
          <div style={{ fontSize: 12.5, color: 'var(--fg-2)', marginBottom: 18, maxWidth: 620, lineHeight: 1.55 }}>
            Every method below is tagged with the <strong>parameter(s)</strong> it improves —
            a direct line from the goals on page 2 to the work in the program. The rationale
            explains why this method drives that parameter, with the supporting research.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {chunk.map((m, i) => (
            <MethodCard key={startIndex + i} method={m} index={startIndex + i} />
          ))}
        </div>

        <div style={{ flex: 1 }} />
      </div>
      <BFooter pageNum={pageNum} total={total} />
    </div>
  );
}

function PdfVariationB() {
  const mesocycles = samplePlan.mesocycles;

  // Paginate the arc — 4 mesocycle rows per page
  const ARC_PER_PAGE = 4;
  const arcPages = [];
  for (let i = 0; i < mesocycles.length; i += ARC_PER_PAGE) {
    arcPages.push(mesocycles.slice(i, i + ARC_PER_PAGE));
  }

  const METHODS_PER_PAGE = 3;
  const whyPages = [];
  for (let i = 0; i < samplePlan.methods.length; i += METHODS_PER_PAGE) {
    whyPages.push({ chunk: samplePlan.methods.slice(i, i + METHODS_PER_PAGE), startIndex: i });
  }
  // pages: cover + goals + arcPages + mesocycles + why
  const totalPages = 2 + arcPages.length + mesocycles.length + whyPages.length;
  const totalStr = String(totalPages).padStart(2, '0');
  const pn = (n) => String(n).padStart(2, '0');

  let p = 1;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 32, padding: 32,
      background: '#e7e5e4', alignItems: 'center'
    }}>
      <BPageCover />
      <BPageGoals pageNum={pn(++p)} total={totalStr} />
      {arcPages.map((chunk, i) => (
        <BPageArc
          key={`arc-${i}`}
          chunk={chunk}
          ordinal={2}
          isFirst={i === 0}
          isContinued={i > 0}
          pageNum={pn(++p)}
          total={totalStr}
        />
      ))}
      {mesocycles.map((m, i) => (
        <BPageMesocycle
          key={m.id}
          meso={m}
          ordinal={2 + arcPages.length + i + 1}
          pageNum={pn(++p)}
          total={totalStr}
        />
      ))}
      {whyPages.map((wp, i) => (
        <BPageWhy
          key={`why-${i}`}
          chunk={wp.chunk}
          startIndex={wp.startIndex}
          isFirst={i === 0}
          ordinal={2 + arcPages.length + mesocycles.length + i + 1}
          pageNum={pn(++p)}
          total={totalStr}
        />
      ))}
    </div>
  );
}

window.PdfVariationB = PdfVariationB;
