import React, { useState, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';
const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

/* ── Sample data for one-click demo ── */
const SAMPLE = {
    projectName: 'Marina Tower — Mixed Use',
    areas: [
        { id: 'a1', name: 'Unit A — 1BR', level: 'Level 3', levelNumber: 3, area: 65, category: 'residential' },
        { id: 'a2', name: 'Unit B — 2BR', level: 'Level 3', levelNumber: 3, area: 95, category: 'residential' },
        { id: 'a3', name: 'Unit C — Studio', level: 'Level 4', levelNumber: 4, area: 42, category: 'residential' },
        { id: 'a4', name: 'Unit D — 2BR', level: 'Level 4', levelNumber: 4, area: 92, category: 'residential' },
        { id: 'a5', name: 'Core L3', level: 'Level 3', levelNumber: 3, area: 28, category: 'core' },
        { id: 'a6', name: 'Core L4', level: 'Level 4', levelNumber: 4, area: 28, category: 'core' },
        { id: 'a7', name: 'Corridor L3', level: 'Level 3', levelNumber: 3, area: 18, category: 'circulation' },
        { id: 'a8', name: 'Corridor L4', level: 'Level 4', levelNumber: 4, area: 18, category: 'circulation' },
        { id: 'a9', name: 'Shop 1 — Café', level: 'Ground', levelNumber: 0, area: 110, category: 'retail' },
        { id: 'a10', name: 'Shop 2 — Mini Market', level: 'Ground', levelNumber: 0, area: 85, category: 'retail' },
        { id: 'a11', name: 'Core Ground', level: 'Ground', levelNumber: 0, area: 12, category: 'core' },
        { id: 'a12', name: 'Lobby', level: 'Ground', levelNumber: 0, area: 45, category: 'circulation' },
        { id: 'a13', name: 'Parking B1', level: 'Basement 1', levelNumber: -1, area: 420, category: 'parking' },
        { id: 'a14', name: 'Core B1', level: 'Basement 1', levelNumber: -1, area: 18, category: 'core' },
        { id: 'a15', name: 'Ramp B1', level: 'Basement 1', levelNumber: -1, area: 32, category: 'circulation' },
        { id: 'a16', name: 'MEP Room', level: 'Basement 1', levelNumber: -1, area: 25, category: 'boh' },
        { id: 'a17', name: 'Gym', level: 'Level 2', levelNumber: 2, area: 80, category: 'amenity' },
        { id: 'a18', name: 'Core L2', level: 'Level 2', levelNumber: 2, area: 14, category: 'core' },
    ],
    zones: [
        { name: 'Parking Basement', levels: [-1], primaryUse: 'parking' },
        { name: 'Retail Ground', levels: [0], primaryUse: 'retail' },
        { name: 'Amenity Podium', levels: [2], primaryUse: 'amenity' },
        { name: 'Residential Tower', levels: [3, 4], primaryUse: 'residential' },
    ],
    financial: {
        residential_price_per_sqm: 8500,
        retail_rent_per_sqm_year: 1200,
        parking_price_per_space: 45000,
    },
};

/* ── Sample data for classify demo (unclassified areas) ── */
const CLASSIFY_SAMPLE = [
    { id: 'c1', name: 'Corridor L5', level: 'Level 5', area: 22 },
    { id: 'c2', name: 'Shop 3A', level: 'Ground', area: 95 },
    { id: 'c3', name: 'Stair 2', level: 'Level 8', area: 14 },
    { id: 'c4', name: 'Unit E 2BR', level: 'Level 10', area: 88 },
    { id: 'c5', name: 'Plant Room', level: 'Basement 2', area: 35 },
    { id: 'c6', name: 'Gym & Pool', level: 'Level 1', area: 150 },
    { id: 'c7', name: 'Lift Lobby', level: 'Level 6', area: 18 },
    { id: 'c8', name: 'Hotel Suite 401', level: 'Level 15', area: 52 },
    { id: 'c9', name: 'Loading Dock', level: 'Ground', area: 40 },
    { id: 'c10', name: 'Co-Working Space', level: 'Level 2', area: 120 },
];

/* ── Colors ── */
const STATUS_COLORS = {
    above_benchmark: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100' },
    on_target: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100' },
    below_benchmark: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100' },
};
const SEVERITY_COLORS = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
    info: 'bg-slate-100 text-slate-700 border-slate-200',
};
const CATEGORY_COLORS = {
    residential: 'bg-violet-100 text-violet-800',
    retail: 'bg-pink-100 text-pink-800',
    office: 'bg-sky-100 text-sky-800',
    hospitality: 'bg-amber-100 text-amber-800',
    core: 'bg-slate-200 text-slate-700',
    circulation: 'bg-slate-100 text-slate-600',
    parking: 'bg-gray-200 text-gray-700',
    amenity: 'bg-emerald-100 text-emerald-800',
    boh: 'bg-stone-200 text-stone-700',
    unclassified: 'bg-red-100 text-red-600',
};

export default function BSI() {
    const [tab, setTab] = useState('analyze');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Analyze state
    const [analyzeInput, setAnalyzeInput] = useState(JSON.stringify(SAMPLE, null, 2));
    const [analysisResult, setAnalysisResult] = useState(null);

    // Classify state
    const [classifyInput, setClassifyInput] = useState(JSON.stringify(CLASSIFY_SAMPLE, null, 2));
    const [classifyResult, setClassifyResult] = useState(null);

    // Advise state
    const [adviseResult, setAdviseResult] = useState(null);

    /* ── API calls ── */
    const callAnalyze = useCallback(async () => {
        setError(null); setLoading(true); setAnalysisResult(null); setAdviseResult(null);
        try {
            const body = JSON.parse(analyzeInput);
            const res = await fetch(`${API}/api/bsi/analyze`, {
                method: 'POST', headers: headers(), credentials: 'include',
                body: JSON.stringify(body),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
            setAnalysisResult(await res.json());
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [analyzeInput]);

    const callClassify = useCallback(async () => {
        setError(null); setLoading(true); setClassifyResult(null);
        try {
            const areas = JSON.parse(classifyInput);
            const res = await fetch(`${API}/api/bsi/classify`, {
                method: 'POST', headers: headers(), credentials: 'include',
                body: JSON.stringify({ areas }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
            setClassifyResult(await res.json());
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [classifyInput]);

    const callAdvise = useCallback(async () => {
        if (!analysisResult) { setError('Run Analyze first'); return; }
        setError(null); setLoading(true); setAdviseResult(null);
        try {
            const res = await fetch(`${API}/api/bsi/advise`, {
                method: 'POST', headers: headers(), credentials: 'include',
                body: JSON.stringify({ analysis: analysisResult }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
            setAdviseResult(await res.json());
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [analysisResult]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800">
            {/* ── Hero ── */}
            <section className="max-w-6xl mx-auto px-6 pt-28 pb-12">
                <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 text-xs font-semibold tracking-wider uppercase rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        AI-Powered
                    </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
                    Building Scheme Intelligence
                </h1>
                <p className="mt-4 text-lg text-slate-400 max-w-2xl">
                    Mixed-use building efficiency analysis with AI auto-classification and design advisor.
                    Powered by Claude.
                </p>
            </section>

            {/* ── Tabs ── */}
            <section className="max-w-6xl mx-auto px-6 pb-20">
                <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1 w-fit">
                    {[
                        { key: 'analyze', label: 'Analyze', desc: 'Efficiency calculation' },
                        { key: 'classify', label: 'AI Classify', desc: 'Auto-categorize areas' },
                        { key: 'advise', label: 'AI Advise', desc: 'Design suggestions' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                                tab === t.key
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {/* ── ANALYZE TAB ── */}
                {tab === 'analyze' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Input */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-slate-300">Input JSON</label>
                                <button
                                    onClick={() => setAnalyzeInput(JSON.stringify(SAMPLE, null, 2))}
                                    className="text-xs text-violet-400 hover:text-violet-300"
                                >
                                    Reset to sample
                                </button>
                            </div>
                            <textarea
                                value={analyzeInput}
                                onChange={e => setAnalyzeInput(e.target.value)}
                                rows={22}
                                className="w-full p-4 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-y"
                            />
                            <button
                                onClick={callAnalyze}
                                disabled={loading}
                                className="mt-3 w-full px-5 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                            >
                                {loading && tab === 'analyze' ? 'Analyzing…' : 'Run Analysis'}
                            </button>
                        </div>

                        {/* Results */}
                        <div>
                            {analysisResult ? (
                                <div className="space-y-4">
                                    {/* Summary card */}
                                    <div className="p-5 rounded-lg bg-slate-800/60 border border-slate-700">
                                        <h3 className="text-lg font-bold text-white mb-3">{analysisResult.projectName}</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <Stat label="Total GFA" value={`${fmt(analysisResult.summary.totalGFA)} m²`} />
                                            <Stat label="Total NLA" value={`${fmt(analysisResult.summary.totalNLA)} m²`} />
                                            <Stat label="Blended Eff." value={pct(analysisResult.summary.blendedEfficiency)} accent />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 mt-3">
                                            <Stat label="Zones" value={analysisResult.summary.zoneCount} />
                                            <Stat label="Areas" value={analysisResult.summary.areaCount} />
                                            <Stat label="Unclassified" value={analysisResult.summary.unclassifiedCount} warn={analysisResult.summary.unclassifiedCount > 0} />
                                        </div>
                                    </div>

                                    {/* Zone cards */}
                                    {analysisResult.zones.map(z => {
                                        const sc = STATUS_COLORS[z.status] || STATUS_COLORS.on_target;
                                        return (
                                            <div key={z.name} className={`p-4 rounded-lg border ${sc.border} ${sc.bg}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-bold text-slate-900">{z.name}</h4>
                                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sc.badge} ${sc.text}`}>
                                                        {z.status.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${CATEGORY_COLORS[z.primaryUse] || 'bg-slate-200 text-slate-700'}`}>
                                                        {z.primaryUse}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        Levels {z.levels[0]}–{z.levels[z.levels.length - 1]}
                                                    </span>
                                                </div>
                                                {/* Efficiency bar */}
                                                <EfficiencyBar efficiency={z.efficiency} benchmark={z.benchmark} />
                                                <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                                                    <div><span className="text-slate-500">GFA</span><br /><span className="font-semibold text-slate-800">{fmt(z.gfa)} m²</span></div>
                                                    <div><span className="text-slate-500">NLA</span><br /><span className="font-semibold text-slate-800">{fmt(z.nla)} m²</span></div>
                                                    <div><span className="text-slate-500">Core</span><br /><span className="font-semibold text-slate-800">{pct(z.coreRatio)}</span></div>
                                                    <div><span className="text-slate-500">Circ.</span><br /><span className="font-semibold text-slate-800">{pct(z.circulationRatio)}</span></div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Financial */}
                                    {analysisResult.financial && (
                                        <div className="p-4 rounded-lg bg-emerald-900/30 border border-emerald-700/50">
                                            <h4 className="text-sm font-bold text-emerald-300 mb-2">Financial Estimates</h4>
                                            <div className="space-y-1 text-sm">
                                                {Object.entries(analysisResult.financial).map(([k, v]) => (
                                                    <div key={k} className="flex justify-between text-emerald-200">
                                                        <span className="text-emerald-400">{k.replace(/_/g, ' ')}</span>
                                                        <span className="font-semibold">${fmt(v)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Advise CTA */}
                                    <button
                                        onClick={() => { setTab('advise'); callAdvise(); }}
                                        className="w-full px-5 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all"
                                    >
                                        Get AI Design Suggestions →
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-slate-700 text-slate-500 text-sm">
                                    Run analysis to see results
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── CLASSIFY TAB ── */}
                {tab === 'classify' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-slate-300">Areas to classify (JSON array)</label>
                                <button
                                    onClick={() => setClassifyInput(JSON.stringify(CLASSIFY_SAMPLE, null, 2))}
                                    className="text-xs text-violet-400 hover:text-violet-300"
                                >
                                    Reset to sample
                                </button>
                            </div>
                            <textarea
                                value={classifyInput}
                                onChange={e => setClassifyInput(e.target.value)}
                                rows={18}
                                className="w-full p-4 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-y"
                            />
                            <button
                                onClick={callClassify}
                                disabled={loading}
                                className="mt-3 w-full px-5 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                            >
                                {loading && tab === 'classify' ? 'Classifying with Claude…' : 'Auto-Classify with AI'}
                            </button>
                        </div>
                        <div>
                            {classifyResult ? (
                                <div className="space-y-3">
                                    <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-400">
                                        Model: <span className="text-slate-200">{classifyResult.model}</span> · Tokens: <span className="text-slate-200">{classifyResult.tokens}</span>
                                    </div>
                                    {classifyResult.classifications.map(c => {
                                        const orig = CLASSIFY_SAMPLE.find(a => a.id === c.id) || {};
                                        return (
                                            <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">{orig.name || c.id}</p>
                                                    <p className="text-xs text-slate-500">{orig.level} · {orig.area}m²</p>
                                                </div>
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${CATEGORY_COLORS[c.category] || 'bg-slate-200 text-slate-700'}`}>
                                                    {c.category}
                                                </span>
                                                <ConfidenceDot confidence={c.confidence} />
                                            </div>
                                        );
                                    })}
                                    {classifyResult.unresolved?.length > 0 && (
                                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                                            {classifyResult.unresolved.length} area(s) could not be classified.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-slate-700 text-slate-500 text-sm">
                                    Paste area names and let Claude classify them
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── ADVISE TAB ── */}
                {tab === 'advise' && (
                    <div>
                        {!analysisResult && (
                            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm mb-4">
                                Run an analysis first (Analyze tab), then come back here for AI suggestions.
                            </div>
                        )}
                        {analysisResult && !adviseResult && !loading && (
                            <button
                                onClick={callAdvise}
                                className="mb-6 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all"
                            >
                                Get AI Design Suggestions
                            </button>
                        )}
                        {loading && tab === 'advise' && (
                            <div className="flex items-center gap-3 p-6 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300">
                                <Spinner /> Claude Opus is analyzing your building scheme…
                            </div>
                        )}
                        {adviseResult && (
                            <div className="space-y-4">
                                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-400">
                                    Model: <span className="text-slate-200">{adviseResult.model}</span> · Tokens: <span className="text-slate-200">{adviseResult.tokens}</span>
                                </div>

                                {/* Narrative */}
                                <div className="p-5 rounded-lg bg-violet-900/30 border border-violet-700/50">
                                    <h4 className="text-sm font-bold text-violet-300 mb-2">Executive Summary</h4>
                                    <p className="text-sm text-violet-100 leading-relaxed">{adviseResult.narrative}</p>
                                </div>

                                {/* Suggestions */}
                                {adviseResult.suggestions.map((s, i) => (
                                    <div key={i} className={`p-4 rounded-lg border ${SEVERITY_COLORS[s.severity] || SEVERITY_COLORS.medium}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider">{s.severity}</span>
                                            <span className="text-xs opacity-60">· {s.zone}</span>
                                            <span className="text-xs opacity-40 ml-auto">{s.type}</span>
                                        </div>
                                        <p className="text-sm leading-relaxed">{s.message}</p>
                                        {s.metric_impact && (
                                            <div className="flex gap-4 mt-2 text-xs opacity-75">
                                                {s.metric_impact.efficiency_delta != null && (
                                                    <span>Efficiency: {s.metric_impact.efficiency_delta > 0 ? '+' : ''}{(s.metric_impact.efficiency_delta * 100).toFixed(1)}%</span>
                                                )}
                                                {s.metric_impact.revenue_delta != null && (
                                                    <span>Revenue: {s.metric_impact.revenue_delta > 0 ? '+' : ''}${fmt(s.metric_impact.revenue_delta)}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}

/* ── Subcomponents ── */
function Stat({ label, value, accent, warn }) {
    return (
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-lg font-bold ${warn ? 'text-amber-400' : accent ? 'text-violet-300' : 'text-white'}`}>{value}</p>
        </div>
    );
}

function EfficiencyBar({ efficiency, benchmark }) {
    const pctE = efficiency * 100;
    const pctMin = benchmark.min * 100;
    const pctMax = benchmark.max * 100;
    // Scale: display range 50-100%
    const scale = v => Math.max(0, Math.min(100, ((v - 50) / 50) * 100));
    const color = pctE < pctMin ? 'bg-amber-500' : pctE > pctMax ? 'bg-emerald-400' : 'bg-blue-500';
    return (
        <div className="relative h-6 rounded-full bg-slate-200 overflow-hidden">
            {/* benchmark range */}
            <div
                className="absolute top-0 h-full bg-slate-300/60"
                style={{ left: `${scale(pctMin)}%`, width: `${scale(pctMax) - scale(pctMin)}%` }}
            />
            {/* actual efficiency */}
            <div
                className={`absolute top-0 h-full ${color} transition-all duration-700`}
                style={{ width: `${scale(pctE)}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-900">
                {pctE.toFixed(1)}%
            </span>
        </div>
    );
}

function ConfidenceDot({ confidence }) {
    const c = confidence * 100;
    const color = c >= 90 ? 'bg-emerald-400' : c >= 70 ? 'bg-yellow-400' : 'bg-red-400';
    return (
        <div className="flex items-center gap-1.5" title={`${c.toFixed(0)}% confidence`}>
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-xs text-slate-400">{c.toFixed(0)}%</span>
        </div>
    );
}

function Spinner() {
    return (
        <svg className="animate-spin h-5 w-5 text-violet-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}

/* ── Helpers ── */
function fmt(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function pct(n) { return `${(n * 100).toFixed(1)}%`; }
