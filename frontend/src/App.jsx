import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/landing';
import Authentication from './pages/authentication';
import { AuthProvider } from './contexts/authContext';
import { MeetProvider } from './contexts/meetContext.jsx';
import { VideoMeetComponent } from './pages/videoMeet';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/dashboard';
function App() {



  return (
    <Router>
      <AuthProvider>
        <MeetProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Authentication />} />
            <Route path="/meet/:id" element={<ProtectedRoute><VideoMeetComponent /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          </Routes>
        </MeetProvider>
      </AuthProvider>
    </Router>
  )

}

export default App
