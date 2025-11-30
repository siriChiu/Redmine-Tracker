import { useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardView from './components/DashboardView'
import PlannerView from './components/PlannerView'
import CalendarView from './components/CalendarView'
import ProjectsView from './components/ProjectsView'
import SettingsView from './components/SettingsView'
import './App.css'

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardView />} />
                    <Route path="planner" element={<PlannerView />} />
                    <Route path="calendar" element={<CalendarView />} />
                    <Route path="projects" element={<ProjectsView />} />
                    <Route path="settings" element={<SettingsView />} />
                </Route>
            </Routes>
        </Router>
    )
}

export default App
