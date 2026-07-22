import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer } from './Toast';
import ConfirmModal from './ConfirmModal';

interface TimeEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialDate: string;
    existingEntry: { id?: string; extendedProps?: EntryExtendedProps } | null;
    initialStartTime?: string;
    initialEndTime?: string;
}

interface Project { id: number; name: string }
interface Issue { id: number; subject: string; project_id?: number }
interface Activity { id: number; name: string }
interface ResolvedIssue {
    id: number;
    subject: string;
    created: boolean;
}
interface LastEntryDefaults {
    profile_name?: string;
    project_id?: number;
    issue_id?: number;
    activity_id?: number;
    comments?: string;
}
interface Profile {
    name: string;
    project_id: number;
    issue_id?: number;
    activity_id?: number;
    comments?: string;
}
interface EntryExtendedProps {
    source?: 'redmine' | 'outlook';
    hours?: number;
    comments?: string;
    projectId?: number;
    issueId?: number;
    activityId?: number;
    startTime?: string;
    endTime?: string;
    outlookSubject?: string;
    outlookEventId?: string;
}
interface TimeEntryPayload {
    spent_on: string;
    hours: number;
    comments: string;
    activity_id: number;
    project_id: number;
    issue_id?: number;
    rd_function_team: string;
    start_time: string;
    end_time: string;
    outlook_event_id?: string;
    outlook_subject?: string;
}

const timeToMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
};

const minutesToTime = (value: number) => {
    const normalized = Math.max(0, Math.min(1439, Math.round(value)));
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

const workingHoursBetween = (startTime: string, endTime: string) => {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (end <= start) return 0;
    const lunchOverlap = Math.max(0, Math.min(end, 13 * 60) - Math.max(start, 12 * 60));
    return Number(((end - start - lunchOverlap) / 60).toFixed(2));
};

const endTimeFromWorkingHours = (startTime: string, hours: number) => {
    let cursor = timeToMinutes(startTime);
    let remaining = Math.max(0, Number(hours) * 60);
    if (cursor >= 12 * 60 && cursor < 13 * 60) cursor = 13 * 60;
    if (cursor < 12 * 60 && cursor + remaining > 12 * 60) {
        remaining -= 12 * 60 - cursor;
        cursor = 13 * 60;
    }
    return minutesToTime(cursor + remaining);
};

const loadLastEntryDefaults = (): LastEntryDefaults => {
    try {
        return JSON.parse(localStorage.getItem('redmine_tracker_last_entry_defaults') || '{}');
    } catch {
        return {};
    }
};

const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#202027',
    color: 'white',
    boxSizing: 'border-box'
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    color: 'rgba(255,255,255,0.68)',
    fontSize: '0.86em',
    fontWeight: 600
};

const TimeEntryModal: React.FC<TimeEntryModalProps> = ({
    isOpen, onClose, onSave, initialDate, existingEntry, initialStartTime, initialEndTime
}) => {
    const props = existingEntry?.extendedProps || {};
    const isOutlookEvent = props.source === 'outlook';
    const isEditMode = Boolean(existingEntry?.id) && !isOutlookEvent;

    const [hours, setHours] = useState(0);
    const [comments, setComments] = useState('');
    const [activityId, setActivityId] = useState<number | ''>(9);
    const [projectId, setProjectId] = useState<number | ''>('');
    const [issueId, setIssueId] = useState<number | ''>('');
    const [issueMode, setIssueMode] = useState<'existing' | 'new'>('existing');
    const [pendingProfileIssue, setPendingProfileIssue] = useState<ResolvedIssue | null>(null);
    const [newIssueSubject, setNewIssueSubject] = useState('');
    const [hwVersion, setHwVersion] = useState('N/A');
    const [fwVersion, setFwVersion] = useState('N/A');
    const [issueFinder, setIssueFinder] = useState('FW&SW RD');
    const [bugCreateAfterMp, setBugCreateAfterMp] = useState('0');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('09:00');
    const [selectedProfile, setSelectedProfile] = useState('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [favoriteProjectIds, setFavoriteProjectIds] = useState<number[]>([]);
    const [showAllProjects, setShowAllProjects] = useState(false);
    const [loadingIssues, setLoadingIssues] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; title?: string; onConfirm: () => void }>({
        isOpen: false, message: '', onConfirm: () => undefined
    });
    const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToasts(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, message, type }]);
    };

    const activityList = useMemo(() => activities.length ? activities : [{ id: 9, name: 'Development' }], [activities]);
    const visibleProjects = useMemo(() => {
        if (showAllProjects || favoriteProjectIds.length === 0) return projects;
        return projects.filter(project => favoriteProjectIds.includes(project.id) || project.id === projectId);
    }, [favoriteProjectIds, projectId, projects, showAllProjects]);

    useEffect(() => {
        if (!isOpen) return;
        const entryProps = existingEntry?.extendedProps || {};
        const outlookEntry = entryProps.source === 'outlook';
        Promise.all([
            fetch('http://127.0.0.1:8000/api/redmine/projects').then(res => res.json()),
            fetch('http://127.0.0.1:8000/api/redmine/activities').then(res => res.json()),
            fetch('http://127.0.0.1:8000/api/profiles').then(res => res.json()),
            fetch('http://127.0.0.1:8000/api/favorite_projects').then(res => res.json())
        ]).then(([projectData, activityData, profileData, favoriteData]) => {
            const projectList = Array.isArray(projectData) ? projectData : [];
            setProjects(projectList);
            const activityValues = Array.isArray(activityData)
                ? activityData
                : Object.entries(activityData || {}).map(([id, name]) => ({ id: Number(id), name: String(name) }));
            setActivities(activityValues);
            const profileList = Array.isArray(profileData) ? profileData : [];
            setProfiles(profileList);
            const favoriteIds = Array.isArray(favoriteData) ? favoriteData.map(Number) : [];
            setFavoriteProjectIds(favoriteIds);
            setShowAllProjects(favoriteIds.length === 0);
            if (!entryProps.projectId) {
                const defaults = loadLastEntryDefaults();
                const legacyProjectId = Number(defaults.project_id || localStorage.getItem('redmine_tracker_last_project'));
                const rememberedProfile = profileList.find(profile => profile.name === defaults.profile_name)
                    || [...profileList].reverse().find(profile => (
                        !defaults.profile_name && legacyProjectId && Number(profile.project_id) === legacyProjectId
                    ));
                if (rememberedProfile) {
                    setSelectedProfile(rememberedProfile.name);
                    setProjectId(Number(rememberedProfile.project_id));
                    setIssueId(rememberedProfile.issue_id ? Number(rememberedProfile.issue_id) : '');
                    setActivityId(rememberedProfile.activity_id ? Number(rememberedProfile.activity_id) : 9);
                    setComments(rememberedProfile.comments || defaults.comments || '');
                    setIssueMode('existing');
                } else {
                    const lastProjectId = legacyProjectId;
                    if (lastProjectId && projectList.some(project => project.id === lastProjectId)) {
                        setProjectId(lastProjectId);
                        setIssueId(defaults.issue_id ? Number(defaults.issue_id) : '');
                    }
                    if (defaults.activity_id) setActivityId(Number(defaults.activity_id));
                    if (defaults.comments) setComments(defaults.comments);
                }
            }
        }).catch(() => addToast('無法載入 Redmine 基本資料，請確認連線。', 'error'));

        const defaultHours = Number(entryProps.hours || 0);
        setHours(defaultHours);
        setComments(entryProps.comments || (outlookEntry ? entryProps.outlookSubject || '' : ''));
        setProjectId(entryProps.projectId ? Number(entryProps.projectId) : '');
        setIssueId(entryProps.issueId ? Number(entryProps.issueId) : '');
        setPendingProfileIssue(null);
        setActivityId(entryProps.activityId ? Number(entryProps.activityId) : 9);
        setHwVersion(localStorage.getItem('redmine_issue_hw_version') || 'N/A');
        setFwVersion(localStorage.getItem('redmine_issue_fw_version') || 'N/A');
        setIssueFinder(localStorage.getItem('redmine_issue_finder') || 'FW&SW RD');
        setBugCreateAfterMp(localStorage.getItem('redmine_issue_bug_after_mp') || '0');
        const resolvedStartTime = entryProps.startTime || initialStartTime || '09:00';
        setStartTime(resolvedStartTime);
        setEndTime(entryProps.endTime || initialEndTime || endTimeFromWorkingHours(resolvedStartTime, defaultHours));
        setIssueMode('existing');
        setNewIssueSubject(outlookEntry ? entryProps.outlookSubject || '' : '');
        setSelectedProfile('');
        setSaving(false);
    }, [isOpen, existingEntry, initialStartTime, initialEndTime]);

    useEffect(() => {
        if (!isOpen || !projectId) {
            setIssues([]);
            return;
        }
        setLoadingIssues(true);
        fetch(`http://127.0.0.1:8000/api/redmine/issues?project_id=${projectId}&status_id=open&limit=300`)
            .then(res => res.json())
            .then(data => setIssues(Array.isArray(data) ? data : []))
            .catch(() => setIssues([]))
            .finally(() => setLoadingIssues(false));
    }, [isOpen, projectId]);

    const openConfirm = (message: string, title?: string) => new Promise<boolean>((resolve) => {
        confirmResolveRef.current = resolve;
        setConfirmModal({
            isOpen: true,
            message,
            title,
            onConfirm: () => {
                confirmResolveRef.current?.(true);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    });

    const handleConfirmCancel = () => {
        confirmResolveRef.current?.(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleProfileSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const name = event.target.value;
        setSelectedProfile(name);
        const profile = profiles.find(item => item.name === name);
        if (!profile) return;
        setProjectId(Number(profile.project_id));
        setIssueId(profile.issue_id ? Number(profile.issue_id) : '');
        setActivityId(profile.activity_id ? Number(profile.activity_id) : 9);
        setComments(profile.comments || comments);
        setIssueMode('existing');
    };

    const toggleFavoriteProject = async () => {
        if (!projectId) return;
        const projectNumber = Number(projectId);
        const nextIds = favoriteProjectIds.includes(projectNumber)
            ? favoriteProjectIds.filter(id => id !== projectNumber)
            : [...favoriteProjectIds, projectNumber];
        setFavoriteProjectIds(nextIds);
        try {
            const response = await fetch('http://127.0.0.1:8000/api/favorite_projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_ids: nextIds })
            });
            const data = await response.json();
            if (data.status !== 'success') throw new Error(data.error || '常用 Project 儲存失敗。');
            setFavoriteProjectIds(data.project_ids);
        } catch (error) {
            setFavoriteProjectIds(favoriteProjectIds);
            addToast(error instanceof Error ? error.message : '常用 Project 儲存失敗。', 'error');
        }
    };

    const createIssueIfNeeded = async (): Promise<ResolvedIssue | undefined> => {
        if (issueMode === 'existing') {
            if (!issueId) return undefined;
            const existingIssue = issues.find(item => item.id === Number(issueId));
            return { id: Number(issueId), subject: existingIssue?.subject || `Issue #${issueId}`, created: false };
        }
        if (!newIssueSubject.trim()) throw new Error('請輸入新 Issue 名稱。');
        const requiredValues = [
            ['HW Version', hwVersion], ['FW Version', fwVersion],
            ['Issue Finder', issueFinder], ['Bug Create After MP', bugCreateAfterMp]
        ];
        const emptyField = requiredValues.find(([, value]) => !value.trim());
        if (emptyField) throw new Error(`${emptyField[0]} 不可留白。`);
        const response = await fetch('http://127.0.0.1:8000/api/redmine/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: Number(projectId), subject: newIssueSubject.trim(), assign_to_me: true,
                hw_version: hwVersion.trim(), fw_version: fwVersion.trim(), issue_finder: issueFinder.trim(),
                bug_create_after_mp: bugCreateAfterMp
            })
        });
        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.error || '新增 Issue 失敗。');
        localStorage.setItem('redmine_issue_hw_version', hwVersion.trim());
        localStorage.setItem('redmine_issue_fw_version', fwVersion.trim());
        localStorage.setItem('redmine_issue_finder', issueFinder.trim());
        localStorage.setItem('redmine_issue_bug_after_mp', bugCreateAfterMp);
        const createdIssue = {
            id: Number(data.issue.id),
            subject: String(data.issue.subject || newIssueSubject.trim()),
            created: true
        };
        // If a later step fails, retry as the existing Issue instead of creating a duplicate.
        setIssueId(createdIssue.id);
        setIssueMode('existing');
        setPendingProfileIssue(createdIssue);
        setIssues(previous => previous.some(item => item.id === createdIssue.id)
            ? previous
            : [...previous, { id: createdIssue.id, subject: createdIssue.subject, project_id: Number(projectId) }]);
        return createdIssue;
    };

    const saveCreatedIssueAsProfile = async (issue: ResolvedIssue) => {
        const project = projects.find(item => item.id === Number(projectId));
        const profileName = `#${issue.id} · ${issue.subject}`;
        const response = await fetch('http://127.0.0.1:8000/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: profileName,
                project_id: Number(projectId),
                issue_id: issue.id,
                activity_id: Number(activityId),
                comments: comments.trim() || issue.subject,
                rd_function_team: 'SW_OS/BSP',
                project_name: project?.name || '',
                issue_name: issue.subject
            })
        });
        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.error || 'Profile 建立失敗。');
        setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
        setSelectedProfile(profileName);
        return profileName;
    };

    const handleSave = async () => {
        if (!projectId) {
            addToast('請先選擇 Project。', 'error');
            return;
        }
        if (!hours || hours <= 0 || hours > 24) {
            addToast('工時必須大於 0 且不超過 24 小時。', 'error');
            return;
        }
        if (!activityId) {
            addToast('請選擇 Activity。', 'error');
            return;
        }

        setSaving(true);
        try {
            const resolvedIssue = await createIssueIfNeeded();
            const profileIssue = resolvedIssue?.created ? resolvedIssue : pendingProfileIssue;
            let rememberedProfileName = selectedProfile;
            if (profileIssue) {
                rememberedProfileName = await saveCreatedIssueAsProfile(profileIssue);
                setPendingProfileIssue(null);
            }
            const payload: TimeEntryPayload = {
                spent_on: initialDate,
                hours: Number(hours),
                comments: comments.trim() || (isOutlookEvent ? props.outlookSubject || '' : ''),
                activity_id: Number(activityId),
                project_id: Number(projectId),
                issue_id: resolvedIssue?.id,
                rd_function_team: 'SW_OS/BSP',
                start_time: startTime,
                end_time: endTime
            };
            if (isOutlookEvent) {
                payload.outlook_event_id = props.outlookEventId || '';
                payload.outlook_subject = props.outlookSubject || '';
            }

            const url = isOutlookEvent
                ? 'http://127.0.0.1:8000/api/outlook/time_entries'
                : isEditMode
                    ? `http://127.0.0.1:8000/api/redmine/time_entries/${existingEntry?.id}`
                    : 'http://127.0.0.1:8000/api/redmine/time_entries';
            const response = await fetch(url, {
                method: isEditMode ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.status !== 'success') throw new Error(data.error || data.detail || '工時儲存失敗。');
            localStorage.setItem('redmine_tracker_last_project', String(projectId));
            localStorage.setItem('redmine_tracker_last_entry_defaults', JSON.stringify({
                profile_name: rememberedProfileName || undefined,
                project_id: Number(projectId),
                issue_id: resolvedIssue?.id,
                activity_id: Number(activityId),
                comments: comments.trim() || (profileIssue?.subject || '')
            } satisfies LastEntryDefaults));
            addToast(profileIssue ? 'Issue、工時與 Profile 已建立。' : '工時已儲存。', 'success');
            window.setTimeout(onSave, 450);
        } catch (error) {
            addToast(error instanceof Error ? error.message : '工時儲存失敗。', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const entryId = existingEntry?.id;
        if (!isEditMode || !entryId) return;
        if (!await openConfirm('確定要刪除這筆 Redmine 工時嗎？', '刪除工時')) return;
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/redmine/time_entries/${entryId}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.status !== 'success') throw new Error(data.error || '刪除失敗。');
            addToast('工時已刪除。', 'success');
            window.setTimeout(onSave, 400);
        } catch (error) {
            addToast(error instanceof Error ? error.message : '刪除失敗。', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.76)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px', boxSizing: 'border-box'
        }}>
            <ToastContainer toasts={toasts} removeToast={id => setToasts(prev => prev.filter(item => item.id !== id))} />
            <ConfirmModal isOpen={confirmModal.isOpen} message={confirmModal.message} title={confirmModal.title}
                onConfirm={confirmModal.onConfirm} onCancel={handleConfirmCancel} />

            <div className="glass-panel" style={{
                background: '#17171d', padding: '24px', borderRadius: '16px', width: '640px', maxWidth: '95vw',
                maxHeight: '90vh', overflowY: 'auto', position: 'relative'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>{isEditMode ? '編輯工時' : isOutlookEvent ? '從 Outlook 登錄工時' : '新增工時'}</h3>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88em', marginTop: '4px' }}>
                            {initialDate}{isOutlookEvent ? ` · ${props.outlookSubject}` : ''}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="關閉" style={{ padding: '6px 10px', background: 'transparent', boxShadow: 'none' }}>✕</button>
                </div>

                {profiles.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>快速套用 Saved Profile（選填）</label>
                        <select value={selectedProfile} onChange={handleProfileSelect} style={fieldStyle}>
                            <option value="">不套用 Profile</option>
                            {profiles.map(profile => <option key={profile.name} value={profile.name}>{profile.name}</option>)}
                        </select>
                    </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Project *</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button type="button" onClick={() => setShowAllProjects(value => !value)} style={{
                                padding: '4px 8px', fontSize: '0.75em', background: 'transparent', boxShadow: 'none', color: '#a5b4fc'
                            }}>
                                {showAllProjects ? '只看常用' : '顯示全部'}
                            </button>
                            <button type="button" onClick={toggleFavoriteProject} disabled={!projectId} title="切換常用 Project" style={{
                                padding: '4px 8px', fontSize: '0.75em', boxShadow: 'none',
                                background: projectId && favoriteProjectIds.includes(Number(projectId)) ? 'rgba(245,158,11,.18)' : 'transparent',
                                color: projectId && favoriteProjectIds.includes(Number(projectId)) ? '#fbbf24' : '#aaa'
                            }}>
                                {projectId && favoriteProjectIds.includes(Number(projectId)) ? '★ 常用' : '☆ 加入常用'}
                            </button>
                        </div>
                    </div>
                    <select value={projectId} onChange={event => {
                        setProjectId(event.target.value ? Number(event.target.value) : '');
                        setIssueId('');
                    }} style={fieldStyle}>
                        <option value="">{favoriteProjectIds.length && !showAllProjects ? '選擇常用 Project' : '選擇 Project'}</option>
                        {visibleProjects.map(project => <option key={project.id} value={project.id}>
                            {favoriteProjectIds.includes(project.id) ? '★ ' : ''}{project.name}
                        </option>)}
                    </select>
                    {!showAllProjects && favoriteProjectIds.length > 0 && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75em', marginTop: '5px' }}>
                            目前只顯示 {favoriteProjectIds.length} 個常用 Project。
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button onClick={() => setIssueMode('existing')} style={{
                        flex: 1, padding: '9px', background: issueMode === 'existing' ? 'var(--primary)' : '#25252c'
                    }}>選擇既有 Issue</button>
                    <button onClick={() => setIssueMode('new')} style={{
                        flex: 1, padding: '9px', background: issueMode === 'new' ? '#22c55e' : '#25252c'
                    }}>直接建立新 Issue</button>
                </div>

                {issueMode === 'existing' ? (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Issue（可留空，直接記在 Project）</label>
                        <select value={issueId} onChange={event => setIssueId(event.target.value ? Number(event.target.value) : '')}
                            style={fieldStyle} disabled={!projectId || loadingIssues}>
                            <option value="">{loadingIssues ? '讀取 Issue 中…' : '不指定 Issue'}</option>
                            {issues.map(issue => <option key={issue.id} value={issue.id}>#{issue.id} · {issue.subject}</option>)}
                        </select>
                    </div>
                ) : (
                    <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '10px', background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.16)' }}>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={labelStyle}>新 Issue 名稱 *</label>
                            <input value={newIssueSubject} onChange={event => setNewIssueSubject(event.target.value)}
                                placeholder="例如：Customer weekly sync" style={fieldStyle} disabled={!projectId} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={labelStyle}>HW Version *</label>
                                <input value={hwVersion} onChange={event => setHwVersion(event.target.value)} style={fieldStyle} placeholder="N/A" />
                            </div>
                            <div>
                                <label style={labelStyle}>FW Version *</label>
                                <input value={fwVersion} onChange={event => setFwVersion(event.target.value)} style={fieldStyle} placeholder="N/A" />
                            </div>
                            <div>
                                <label style={labelStyle}>Issue Finder *</label>
                                <input value={issueFinder} onChange={event => setIssueFinder(event.target.value)} style={fieldStyle} placeholder="FW&SW RD" />
                            </div>
                            <div>
                                <label style={labelStyle}>Bug Create After MP *</label>
                                <select value={bugCreateAfterMp} onChange={event => setBugCreateAfterMp(event.target.value)} style={fieldStyle}>
                                    <option value="0">No</option>
                                    <option value="1">Yes</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75em', marginTop: '8px' }}>
                            這些值會記住並沿用到下一次建立 Issue。
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                        <label style={labelStyle}>開始時間</label>
                        <input type="time" value={startTime} onChange={event => {
                            const value = event.target.value;
                            setStartTime(value);
                            setEndTime(endTimeFromWorkingHours(value, hours));
                        }} style={fieldStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>結束時間</label>
                        <input type="time" value={endTime} onChange={event => {
                            const value = event.target.value;
                            setEndTime(value);
                            const nextHours = workingHoursBetween(startTime, value);
                            if (nextHours > 0) setHours(nextHours);
                        }} style={fieldStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>工時 *</label>
                        <input type="number" min="0.25" max="24" step="0.25" value={hours}
                            onChange={event => {
                                const value = Number(event.target.value);
                                setHours(value);
                                setEndTime(endTimeFromWorkingHours(startTime, value));
                            }} style={fieldStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Activity *</label>
                        <select value={activityId} onChange={event => setActivityId(Number(event.target.value))} style={fieldStyle}>
                            {activityList.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>工作內容 / Comments</label>
                    <input value={comments} onChange={event => setComments(event.target.value)} style={fieldStyle}
                        placeholder="會寫入 Redmine 工時說明" />
                </div>

                <div style={{ margin: '-6px 0 18px', color: 'var(--text-secondary)', fontSize: '0.76em' }}>
                    RD Function Team 將固定使用 <strong style={{ color: '#c4b5fd' }}>SW_OS/BSP</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    {isEditMode ? <button onClick={handleDelete} style={{ background: '#7f1d1d' }}>刪除</button> : <span />}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #555' }}>取消</button>
                        <button onClick={handleSave} disabled={saving || !projectId} style={{
                            background: saving || !projectId ? '#444' : 'var(--accent-gradient)', minWidth: '120px'
                        }}>{saving ? '處理中…' : issueMode === 'new' ? '建立並登錄' : '儲存工時'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeEntryModal;
