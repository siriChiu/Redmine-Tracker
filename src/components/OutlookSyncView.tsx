import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

interface Project { id: number; name: string }
interface Issue { id: number; subject: string }
interface Activity { id: number; name: string }

interface CalendarMapping {
    id: string;
    title_pattern: string;
    match_type: 'contains' | 'exact';
    project_id: number | '';
    project_name?: string;
    issue_id?: number | '';
    issue_name?: string;
    activity_id: number;
    rd_function_team: string;
    comments?: string;
    enabled: boolean;
}

interface OutlookEvent {
    id: string;
    subject: string;
    start: string;
    end: string;
    date: string;
    start_time: string;
    hours: number;
    duration_minutes: number;
    location: string;
    organizer: string;
    all_day: boolean;
    mapping?: CalendarMapping | null;
    logged_entry_id?: number | null;
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)',
    background: '#1b1b22', color: 'white', boxSizing: 'border-box'
};

const localDate = (value: Date) => {
    const adjusted = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return adjusted.toISOString().split('T')[0];
};

const newMappingId = () => globalThis.crypto?.randomUUID?.() || `mapping-${Date.now()}-${Math.random()}`;

const MappingIssueSelect = ({ projectId, value, onChange }: {
    projectId: number | '', value?: number | '', onChange: (value: number | '', issueName?: string) => void
}) => {
    const [issues, setIssues] = useState<Issue[]>([]);

    useEffect(() => {
        if (!projectId) return;
        fetch(`http://127.0.0.1:8000/api/redmine/issues?project_id=${projectId}&status_id=open&limit=300`)
            .then(res => res.json())
            .then(data => setIssues(Array.isArray(data) ? data : []))
            .catch(() => setIssues([]));
    }, [projectId]);

    return (
        <select value={value || ''} onChange={event => {
            const id = event.target.value ? Number(event.target.value) : '';
            onChange(id, issues.find(issue => issue.id === id)?.subject);
        }} style={inputStyle} disabled={!projectId}>
            <option value="">Project only</option>
            {issues.map(issue => <option key={issue.id} value={issue.id}>#{issue.id} · {issue.subject}</option>)}
        </select>
    );
};

const OutlookSyncView = () => {
    const today = new Date();
    const defaultFrom = new Date(today); defaultFrom.setDate(today.getDate() - today.getDay() + 1);
    const defaultTo = new Date(defaultFrom); defaultTo.setDate(defaultFrom.getDate() + 4);

    const [fromDate, setFromDate] = useState(localDate(defaultFrom));
    const [toDate, setToDate] = useState(localDate(defaultTo));
    const [projects, setProjects] = useState<Project[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [mappings, setMappings] = useState<CalendarMapping[]>([]);
    const [events, setEvents] = useState<OutlookEvent[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [savingMappings, setSavingMappings] = useState(false);
    const [logging, setLogging] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const selectableEvents = useMemo(() => events.filter(event => !event.all_day && !event.logged_entry_id && event.mapping?.project_id), [events]);

    useEffect(() => {
        Promise.all([
            fetch('http://127.0.0.1:8000/api/redmine/projects').then(res => res.json()),
            fetch('http://127.0.0.1:8000/api/redmine/activities').then(res => res.json()),
            fetch('http://127.0.0.1:8000/api/outlook/mappings').then(res => res.json())
        ]).then(([projectData, activityData, mappingData]) => {
            setProjects(Array.isArray(projectData) ? projectData : []);
            setActivities(Array.isArray(activityData)
                ? activityData
                : Object.entries(activityData || {}).map(([id, name]) => ({ id: Number(id), name: String(name) })));
            setMappings(Array.isArray(mappingData) ? mappingData : []);
        }).catch(() => setError('無法載入 Redmine 或對應設定。'));
    }, []);

    const loadEvents = useCallback(async (silent = false) => {
        setLoading(true);
        if (!silent) { setError(''); setMessage(''); }
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/outlook/events?from_date=${fromDate}&to_date=${toDate}`);
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error(data.error || 'Outlook 讀取失敗。');
            setEvents(data);
            setSelectedIds(new Set());
            if (!silent) setMessage(`已讀取 ${data.length} 個 Outlook 行事曆項目。`);
        } catch (reason) {
            setEvents([]);
            setError(reason instanceof Error ? reason.message : 'Outlook 讀取失敗。');
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => { loadEvents(); }, [loadEvents]);

    const patchMapping = (id: string, patch: Partial<CalendarMapping>) => {
        setMappings(current => current.map(mapping => mapping.id === id ? { ...mapping, ...patch } : mapping));
    };

    const addMapping = (subject = '') => setMappings(current => [...current, {
        id: newMappingId(), title_pattern: subject, match_type: subject ? 'exact' : 'contains', project_id: '',
        issue_id: '', activity_id: 9, rd_function_team: 'SW_OS/BSP', comments: '', enabled: true
    }]);

    const saveMappings = async () => {
        const invalid = mappings.find(mapping => !mapping.title_pattern.trim() || !mapping.project_id);
        if (invalid) { setError('每一列對應都需要標題條件與 Project。'); return; }
        setSavingMappings(true); setError(''); setMessage('');
        try {
            const payload = mappings.map(mapping => ({
                ...mapping,
                project_id: Number(mapping.project_id),
                issue_id: mapping.issue_id ? Number(mapping.issue_id) : null,
                project_name: projects.find(project => project.id === Number(mapping.project_id))?.name || mapping.project_name
            }));
            const response = await fetch('http://127.0.0.1:8000/api/outlook/mappings', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.status !== 'success') throw new Error(data.error || '儲存失敗。');
            setMappings(data.mappings);
            await loadEvents(true);
            setMessage('Outlook 標題對應已儲存並重新套用。');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '儲存失敗。');
        } finally {
            setSavingMappings(false);
        }
    };

    const logSelected = async () => {
        const selected = events.filter(event => selectedIds.has(event.id));
        if (!selected.length) { setError('請先勾選至少一個已完成對應的會議。'); return; }
        setLogging(true); setError(''); setMessage('');
        let success = 0;
        const failures: string[] = [];
        for (const event of selected) {
            const mapping = event.mapping;
            if (!mapping?.project_id) { failures.push(`${event.subject}：尚未對應 Project`); continue; }
            try {
                const response = await fetch('http://127.0.0.1:8000/api/outlook/time_entries', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                        outlook_event_id: event.id,
                        outlook_subject: event.subject,
                        project_id: Number(mapping.project_id),
                        issue_id: mapping.issue_id ? Number(mapping.issue_id) : null,
                        spent_on: event.date,
                        hours: event.hours,
                        activity_id: mapping.activity_id || 9,
                        rd_function_team: 'SW_OS/BSP',
                        comments: mapping.comments || event.subject,
                        start_time: event.start_time
                    })
                });
                const data = await response.json();
                if (data.status !== 'success') throw new Error(data.error || '登錄失敗');
                success += 1;
            } catch (reason) {
                failures.push(`${event.subject}：${reason instanceof Error ? reason.message : '登錄失敗'}`);
            }
        }
        setLogging(false);
        await loadEvents(true);
        if (failures.length) setError(failures.join('；'));
        if (success) setMessage(`已將 ${success} 個會議登錄到 Redmine。`);
    };

    const eventDateTime = (event: OutlookEvent) => new Intl.DateTimeFormat('zh-TW', {
        month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit'
    }).format(new Date(event.start));

    return (
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '28px', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.8em' }}>Outlook 行事曆匯入</h2>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>設定一次標題規則，之後會議會自動帶入 Project、Issue 與工時預設值。</p>
                </div>
                <Link to="/calendar" style={{ color: '#c4b5fd', textDecoration: 'none', padding: '8px' }}>返回 Calendar →</Link>
            </div>

            {(message || error) && <div style={{
                padding: '11px 14px', borderRadius: '9px', marginBottom: '16px', fontSize: '0.9em',
                color: error ? '#fecaca' : '#bbf7d0', background: error ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                border: `1px solid ${error ? 'rgba(239,68,68,.25)' : 'rgba(34,197,94,.25)'}`
            }}>{error || message}</div>}

            <section className="glass-panel" style={{ padding: '20px', marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>1. 會議標題 → Redmine 預設值</h3>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82em', marginTop: '4px' }}>較長的條件優先；「包含」不分大小寫。</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => addMapping()} style={{ padding: '8px 12px' }}>＋ 新增規則</button>
                        <button onClick={saveMappings} disabled={savingMappings} style={{ padding: '8px 14px', background: 'var(--accent-gradient)' }}>
                            {savingMappings ? '儲存中…' : '儲存對應'}
                        </button>
                    </div>
                </div>

                {mappings.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px', border: '1px dashed var(--glass-border)', borderRadius: '10px' }}>
                        尚無規則。可從下方會議按「建立對應」，或手動新增。
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <div style={{ minWidth: '1010px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .65fr 1.25fr 1.45fr 1fr 1.2fr 42px', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.76em', padding: '0 4px 7px' }}>
                                <span>Calendar 標題</span><span>比對</span><span>Project</span><span>Issue 預設</span><span>Activity</span><span>Comments 預設</span><span />
                            </div>
                            {mappings.map(mapping => (
                                <div key={mapping.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr .65fr 1.25fr 1.45fr 1fr 1.2fr 42px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                    <input value={mapping.title_pattern} onChange={event => patchMapping(mapping.id, { title_pattern: event.target.value })} style={inputStyle} placeholder="例如 Weekly Sync" />
                                    <select value={mapping.match_type} onChange={event => patchMapping(mapping.id, { match_type: event.target.value as 'contains' | 'exact' })} style={inputStyle}>
                                        <option value="contains">包含</option><option value="exact">完全相同</option>
                                    </select>
                                    <select value={mapping.project_id} onChange={event => patchMapping(mapping.id, {
                                        project_id: event.target.value ? Number(event.target.value) : '', issue_id: '', issue_name: ''
                                    })} style={inputStyle}>
                                        <option value="">選擇 Project</option>
                                        {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                                    </select>
                                    <MappingIssueSelect projectId={mapping.project_id} value={mapping.issue_id} onChange={(issue_id, issue_name) => patchMapping(mapping.id, { issue_id, issue_name })} />
                                    <select value={mapping.activity_id} onChange={event => patchMapping(mapping.id, { activity_id: Number(event.target.value) })} style={inputStyle}>
                                        {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
                                    </select>
                                    <input value={mapping.comments || ''} onChange={event => patchMapping(mapping.id, { comments: event.target.value })} style={inputStyle} placeholder="留空則使用會議標題" />
                                    <button title="刪除規則" onClick={() => setMappings(current => current.filter(item => item.id !== mapping.id))}
                                        style={{ padding: '8px', background: 'rgba(239,68,68,.13)', color: '#fca5a5' }}>×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <section className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>2. 選擇會議並登錄工時</h3>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82em', marginTop: '4px' }}>已登錄的 Outlook occurrence 不會再次送出。</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>從
                            <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} style={{ ...inputStyle, marginTop: '4px' }} />
                        </label>
                        <label style={{ fontSize: '0.78em', color: 'var(--text-secondary)' }}>到
                            <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} style={{ ...inputStyle, marginTop: '4px' }} />
                        </label>
                        <button onClick={() => loadEvents()} disabled={loading} style={{ padding: '9px 13px' }}>{loading ? '讀取中…' : '讀取 Outlook'}</button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                    <button onClick={() => setSelectedIds(new Set(selectableEvents.map(event => event.id)))} style={{ padding: '7px 10px', fontSize: '0.82em' }}>選取所有已對應會議</button>
                    <button onClick={logSelected} disabled={logging || selectedIds.size === 0} style={{
                        padding: '8px 14px', background: logging || selectedIds.size === 0 ? '#444' : '#16a34a'
                    }}>{logging ? '登錄中…' : `登錄選取的 ${selectedIds.size} 個會議`}</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {events.length === 0 && !loading && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)' }}>這個日期範圍沒有可顯示的會議。</div>}
                    {events.map(event => {
                        const mapped = Boolean(event.mapping?.project_id);
                        const logged = Boolean(event.logged_entry_id);
                        return (
                            <div key={event.id} style={{
                                display: 'grid', gridTemplateColumns: '32px minmax(180px, 1.4fr) minmax(150px, .9fr) 85px 120px',
                                gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '10px',
                                background: logged ? 'rgba(34,197,94,.07)' : 'rgba(255,255,255,.025)',
                                border: `1px solid ${logged ? 'rgba(34,197,94,.22)' : 'rgba(255,255,255,.06)'}`
                            }}>
                                <input type="checkbox" checked={selectedIds.has(event.id)} disabled={!mapped || logged || event.all_day}
                                    onChange={change => setSelectedIds(current => {
                                        const next = new Set(current);
                                        if (change.target.checked) next.add(event.id);
                                        else next.delete(event.id);
                                        return next;
                                    })} style={{ width: '18px', height: '18px' }} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.subject}</div>
                                    <div style={{ fontSize: '0.78em', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.location || event.organizer || 'Outlook Calendar'}</div>
                                </div>
                                <div style={{ fontSize: '0.84em' }}>{eventDateTime(event)}</div>
                                <div style={{ fontSize: '0.84em' }}>{event.all_day ? '全天' : `${event.hours}h`}</div>
                                {logged ? <span style={{ color: '#86efac', fontSize: '0.82em' }}>✓ 已登錄 #{event.logged_entry_id}</span>
                                    : mapped ? <span title={event.mapping?.project_name} style={{ color: '#c4b5fd', fontSize: '0.82em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {event.mapping?.project_name || `Project #${event.mapping?.project_id}`}</span>
                                        : <button onClick={() => addMapping(event.subject)} style={{ padding: '6px 9px', fontSize: '0.78em', color: '#fcd34d' }}>建立對應</button>}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

export default OutlookSyncView;
