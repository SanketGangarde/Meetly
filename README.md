# Meetly 🎥

> A real-time video conferencing web application — your own lightweight Zoom clone.

Built with **React 19**, **Node.js / Express 5**, **Socket.IO**, and **WebRTC** for peer-to-peer video calls, with user authentication backed by **MongoDB**.

---

## ✨ Features

- 🔐 **User Authentication** — Register & login with secure bcrypt-hashed passwords
- 🏠 **Lobby System** — Preview your camera/mic before joining a meeting
- 📹 **Real-time Video Calls** — Peer-to-peer WebRTC video & audio
- 🔌 **Socket.IO Signaling** — Reliable WebRTC offer/answer/ICE exchange
- 🛡️ **Protected Routes** — Meetings restricted to authenticated users
- 📱 **Responsive UI** — Clean, modern interface built with MUI + custom CSS

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7 |
| Styling | MUI v9, Custom CSS |
| Backend | Node.js, Express 5 |
| Real-time | Socket.IO v4 |
| Video | WebRTC (native browser API) |
| Database | MongoDB (Mongoose 9) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- A MongoDB Atlas cluster (or local MongoDB)

### 1. Clone the repo
```bash
git clone https://github.com/SanketGangarde/Meetly.git
cd Meetly
```

### 2. Configure environment variables

**Root** (for backend):
```bash
cp .env.example .env
# Edit .env and fill in your MongoDB credentials
```

**Frontend:**
```bash
cp frontend/.env.example frontend/.env
# Edit frontend/.env if your backend runs on a different port
```

### 3. Install dependencies
```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 4. Run in development mode

Open two terminals:

```bash
# Terminal 1 — Backend (runs on port 3000)
cd backend
npm run dev

# Terminal 2 — Frontend (runs on port 5173)
cd frontend
npm run dev
```

Open your browser at **http://localhost:5173**

---

## 📂 Project Structure

```
Meetly/
├── .env.example          # Root env template (MongoDB credentials)
├── backend/
│   └── src/
│       ├── server.js         # Express + Socket.IO entry point
│       ├── controllers/
│       │   ├── userController.js   # Register/login logic
│       │   └── socketManager.js    # WebRTC signaling events
│       ├── models/               # Mongoose schemas
│       └── routes/
│           └── users.routes.js
└── frontend/
    ├── .env.example          # Frontend env template
    └── src/
        ├── App.jsx               # Routes definition
        ├── contexts/
        │   └── authContext.jsx   # Auth state & API calls
        ├── components/
        │   └── ProtectedRoute.jsx
        └── pages/
            ├── landing.jsx       # Home / landing page
            ├── authentication.jsx # Login & Register
            └── videoMeet.jsx     # Video meeting room (WebRTC)
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request

---

## 📄 License

MIT © [Sanket Gangarde](https://github.com/SanketGangarde)
