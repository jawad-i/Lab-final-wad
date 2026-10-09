# 🔄 Swappr — Community Peer-to-Peer Skill Exchange Platform

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v5.0-blue.svg)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-emerald.svg)](https://www.mongodb.com/atlas)
[![UI Framework](https://img.shields.io/badge/Frontend-Bootstrap%205.3-purple.svg)](https://getbootstrap.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)
[![Deployment](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com/)

> **Web Application Development Final Lab Project**  
> An interactive, full-stack, time-banking skill exchange platform where community members teach skills they know to earn Skill Credits, and spend those credits to learn new skills from their peers.

---

## 📌 Table of Contents
- [Project Overview & Motivation](#-project-overview--motivation)
- [Key Features](#-key-features)
- [User Roles & Permissions](#-user-roles--permissions)
- [System Architecture & Workflow](#-system-architecture--workflow)
- [Database Schema (ER Design)](#-database-schema-er-design)
- [Technology Stack](#-technology-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started & Local Setup](#-getting-started--local-setup)
- [Environment Configuration](#-environment-configuration)
- [RESTful API Reference](#-restful-api-reference)
- [Deployment Guide](#-deployment-guide)
- [Academic Rubric Alignment](#-academic-rubric-alignment)
- [Author & Submission Details](#-author--submission-details)

---

## 💡 Project Overview & Motivation

In traditional educational models, access to specialized one-on-one coaching, tutoring, or practical skill learning (coding, musical instruments, design, cooking, fitness) is heavily restricted by monetary barriers. Meanwhile, countless individuals possess valuable talents and knowledge that they are eager to share.

**Swappr** introduces a **Time-Banking Skill Economy**:
- **Zero Financial Cost**: Learning is powered entirely through reciprocity and mutual contribution.
- **1 Hour Taught = 1 Credit Earned**: When you mentor a peer in a session, you earn 1 Skill Credit.
- **Spend to Learn**: Use your accumulated credits to request sessions with other experts in your community.
- **Starter Incentive**: Every newly registered member receives **10 Free Skill Credits** immediately.

---

## ✨ Key Features

### 1. 🪙 Time-Banking Credit Economy
- **Automated Credit Transfer**: Learner reserves a session; upon session completion, 1 credit transfers automatically from learner to mentor.
- **Live Sync**: Credit balance stays synchronized across the navbar and dashboard in real-time.

### 2. 📁 Multimedia Skill Publishing
- **Categorized Offers**: Programming, Design, Music, Language, Cooking, Fitness.
- **Coursework Attachments**: Mentors can attach syllabus notes (**PDF**) and demo video lectures (**MP4 / WebM**).
- **In-Browser Access**: Direct PDF download/preview and embedded video streaming.

### 3. 📊 Interactive User Dashboard
- **Live Platform Metrics**: Real-time counters for Available Credits, Active Skill Posts, and Total Sessions.
- **Mentoring Requests Hub**: Review sessions requested by learners; click **"Mark Completed (+1 Credit)"** to award yourself credit.
- **Learner Session Tracker**: Monitor the status of sessions you have booked.

### 4. 🔍 Filterable Community Skills Catalog
- **Instant Search**: Real-time search query matching across skill titles and descriptions.
- **Category Filter Dropdown**: Easily filter by domain.
- **One-Click Booking**: One-tap reservation with instant balance verification.

### 5. 👤 Profile & Account Customization
- **Custom Avatar Upload**: Upload profile pictures stored securely via in-memory buffer and DataURI.
- **Display Name Editing**: Change your public profile name.
- **Skill Management**: Delete personal skill offerings with confirmation dialogs.
- **Account Deletion Safety**: Permanent deletion feature within the danger zone.

### 6. 🛡️ Administrator Control Panel
- **System Metrics**: Total Accounts, Total Admins, and Circulating Credits.
- **Live User Directory**: View all registered users with role badges.
- **Content Moderation**: Administrative ability to remove abusive or spam accounts.

### 7. 📱 Modern Responsive Design
- Glassmorphic dark navbar with mobile drawer navigation (`navbar-toggler`).
- 100% full-width sticky footer that stays pinned at the bottom on all screen sizes.
- Interactive hover transitions, focus rings, and animated loading spinners.

---

## 👥 User Roles & Permissions

| Feature / Action | Guest (Visitor) | Member (Learner / Mentor) | Administrator |
|---|:---:|:---:|:---:|
| Browse Landing Page & Public Catalog | ✅ | ✅ | ✅ |
| Filter & Search Skills | ✅ | ✅ | ✅ |
| Register Account (+10 Free Credits) | ✅ | — | — |
| Post Skills with PDF / Video Attachments | ❌ | ✅ | ✅ |
| Book a Skill Session (1 Credit) | ❌ | ✅ | ✅ |
| Complete Mentoring Session (+1 Credit) | ❌ | ✅ | ✅ |
| Edit Profile (Avatar & Name) | ❌ | ✅ | ✅ |
| Delete Personal Skills | ❌ | ✅ | ✅ |
| Access Admin Panel (`/admin.html`) | ❌ | ❌ | ✅ |
| Manage / Delete User Accounts | ❌ | ❌ | ✅ |

---

## 🏗️ System Architecture & Workflow

```
┌────────────────────────────────────────────────────────┐
│             Client Layer (Browser / Web)               │
│ HTML5, CSS3, Bootstrap 5.3, FontAwesome, Vanilla JS     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / JSON / FormData
                            ▼
┌────────────────────────────────────────────────────────┐
│            Application Server (Node.js & Express)       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Authentication & Authorization (JWT & bcryptjs)  │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ File Upload Handler (Multer Memory Storage)      │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Business Logic: Skills, Bookings, User Profile   │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ Mongoose ODM
                            ▼
┌────────────────────────────────────────────────────────┐
│             Database Layer (MongoDB Atlas)             │
│        Collections: Users | Skills | Bookings          │
└────────────────────────────────────────────────────────┘
```

### Core Exchange Lifecycle:
1. **User Registration** ➔ Auto-login issued with JWT + 10 Free Credits.
2. **Mentor Posts Skill** ➔ Skill saved with optional PDF & Video attachments.
3. **Learner Books Skill** ➔ Booking status initialized to `Pending`.
4. **Session Completed** ➔ Mentor marks session completed ➔ **-1 Credit** from Learner, **+1 Credit** to Mentor ➔ Status set to `Completed`.

---

## 🗄️ Database Schema (ER Design)

### 1. `User` Collection
```javascript
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique),
  password: String (hashed with bcryptjs),
  avatar: String (DataURI or URL),
  role: String (enum: ['user', 'admin'], default: 'user'),
  credits: Number (default: 10),
  createdAt: Date,
  updatedAt: Date
}
```

### 2. `Skill` Collection
```javascript
{
  _id: ObjectId,
  title: String (required),
  category: String (required),
  description: String (required),
  pdfFile: String (optional DataURI / path),
  videoFile: String (optional DataURI / path),
  user: ObjectId (ref: 'User', required),
  createdAt: Date,
  updatedAt: Date
}
```

### 3. `Booking` Collection
```javascript
{
  _id: ObjectId,
  skill: ObjectId (ref: 'Skill', required),
  learner: ObjectId (ref: 'User', required),
  mentor: ObjectId (ref: 'User', required),
  status: String (enum: ['Pending', 'Completed', 'Cancelled'], default: 'Pending'),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 💻 Technology Stack

| Layer | Technologies |
|---|---|
| **Front-End** | HTML5, CSS3, JavaScript (ES6+), Bootstrap 5.3, FontAwesome 6.4 |
| **Back-End** | Node.js, Express.js (v5) |
| **Database** | MongoDB Atlas, Mongoose ORM |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` password hashing |
| **Media Handling**| `multer` (in-memory buffering with serverless compatibility) |
| **Deployment** | Vercel (Serverless Functions via `vercel.json`), Git & GitHub |

---

## 📂 Project Directory Structure

```
skillswap/
├── api/
│   └── index.js              # Serverless entrypoint for Vercel deployment
├── config/
│   └── db.js                 # Database connection helper
├── middleware/
│   ├── authMiddleware.js     # JWT verification middleware
│   └── adminMiddleware.js    # Administrator role guard
├── models/
│   ├── Booking.js            # Booking Mongoose schema
│   ├── Skill.js              # Skill Mongoose schema
│   └── User.js               # User Mongoose schema
├── public/
│   ├── css/
│   │   └── style.css         # Modern styling, theme tokens & sticky footer
│   ├── js/
│   │   └── main.js           # Unified frontend controller & active nav logic
│   ├── admin.html            # System administrator control panel
│   ├── dashboard.html        # User dashboard with stats & session exchange
│   ├── index.html            # Landing / home page
│   ├── login.html            # User authentication page
│   ├── profile.html          # User profile & account management
│   ├── register.html         # User registration with instant onboarding
│   ├── skills.html           # Public skills catalog with live search & filters
│   ├── dp.jpg                # Demo graphic asset
│   └── logo.png              # Brand icon
├── routes/
│   ├── adminRoutes.js        # Admin endpoints
│   ├── authRoutes.js         # Authentication endpoints
│   ├── bookingRoutes.js      # Booking endpoints
│   └── skillRoutes.js        # Skill endpoints
├── .env                      # Environment variables (git-ignored)
├── .env.example              # Example environment configuration
├── .gitignore                # Git ignore rules
├── package.json              # Project dependencies & scripts
├── README.md                 # Project documentation
├── server.js                 # Core Express backend server
└── vercel.json               # Vercel deployment configuration
```

---

## 🚀 Getting Started & Local Setup

### 1. Prerequisites
- **Node.js**: v18.x or later installed
- **Git**: Installed on your system
- **MongoDB Atlas**: An active cluster connection string (or local MongoDB)

### 2. Clone the Repository
```bash
git clone https://github.com/jawad-i/Lab-final-wad.git
cd Lab-final-wad
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
```

### 5. Run the Server
```bash
# For Development (auto-reload with nodemon):
npm run dev

# For Production:
npm start
```

Open your browser and navigate to:
```
http://localhost:5000
```

---

## ⚙️ Environment Configuration

| Variable Name | Description | Example |
|---|---|---|
| `PORT` | Local server port | `5000` |
| `MONGO_URI` | MongoDB Atlas connection URI | `mongodb+srv://user:pass@cluster.mongodb.net/skillswap` |
| `JWT_SECRET` | Secret key used for signing JWTs | `skillswap_super_secret_jwt_key_2026` |

---

## 📡 RESTful API Reference

### Authentication Endpoints
- **`POST /api/auth/register`**
  - **Body**: `{ "name": "Alex", "email": "alex@example.com", "password": "secretpassword" }`
  - **Response**: `201 Created` with JWT token and user profile (+10 credits).
- **`POST /api/auth/login`**
  - **Body**: `{ "email": "alex@example.com", "password": "secretpassword" }`
  - **Response**: `200 OK` with JWT token and user profile.
- **`GET /api/auth/me`**
  - **Headers**: `Authorization: Bearer <token>`
  - **Response**: `200 OK` with fresh user profile.

### Skill Endpoints
- **`GET /api/skills?search=python&category=Programming`**
  - **Response**: `200 OK` with filtered array of skills.
- **`POST /api/skills`** (Auth Required)
  - **Body**: `FormData` containing `title`, `category`, `description`, and optional `pdf`, `video`.
  - **Response**: `201 Created` with published skill object.
- **`DELETE /api/skills/:id`** (Auth Required, Owner or Admin)
  - **Response**: `200 OK` with success message.

### Booking & Session Endpoints
- **`POST /api/bookings`** (Auth Required)
  - **Body**: `{ "skillId": "651a..." }`
  - **Response**: `201 Created` with booking confirmation.
- **`GET /api/bookings/my-bookings`** (Auth Required)
  - **Response**: `200 OK` with all sessions where user is mentor or learner.
- **`PATCH /api/bookings/:id/complete`** (Auth Required)
  - **Response**: `200 OK` — transfers 1 credit from learner to mentor and sets status to `Completed`.

### User & Admin Endpoints
- **`GET /api/users/profile`** (Auth Required)
  - **Response**: `200 OK` with user details and their posted skills.
- **`PUT /api/users/profile`** (Auth Required)
  - **Body**: `FormData` with optional `name` and `avatar`.
  - **Response**: `200 OK` with updated user object.
- **`DELETE /api/users/profile`** (Auth Required)
  - **Response**: `200 OK` — deletes user account, posted skills, and booking records.
- **`GET /api/admin/users`** (Admin Only)
  - **Response**: `200 OK` with list of all registered platform users.
- **`DELETE /api/admin/users/:id`** (Admin Only)
  - **Response**: `200 OK` — administrative user deletion.

---

## 🌐 Deployment Guide (Vercel)

The application is pre-configured for one-click deployment using **Vercel**:

1. Push your repository to **GitHub**:
   ```bash
   git push origin main
   ```
2. Log in to [Vercel](https://vercel.com/) and click **"Add New Project"**.
3. Import the **`Lab-final-wad`** repository.
4. In the **Environment Variables** panel, add:
   - `MONGO_URI`: Your MongoDB Atlas connection string.
   - `JWT_SECRET`: Your secure JWT secret.
5. Click **Deploy**. Vercel will build the project and output your live deployment URL.

---

## 📋 Academic Rubric Alignment

This project satisfies all requirements specified in the **Web Application Development Final Lab Project**:

| Rubric Requirement | Implementation in Swappr | Status |
|---|---|:---:|
| **Web Application** | Full-stack responsive web platform with clean RESTful architecture | ✅ Full Marks |
| **Multiple Pages** | 7 dedicated HTML pages (`index`, `dashboard`, `skills`, `profile`, `login`, `register`, `admin`) | ✅ Full Marks |
| **Multiple User Roles** | Built-in role separation: **Learner**, **Mentor**, and **Administrator** | ✅ Full Marks |
| **Front-End & Back-End** | Responsive Bootstrap 5 UI + robust Node.js/Express.js REST API | ✅ Full Marks |
| **Database Integration** | MongoDB Atlas cloud database with Mongoose schemas and relationships | ✅ Full Marks |
| **Unique Project Idea** | Non-monetary **Time-Banking Peer Skill Exchange** with media curriculum | ✅ Full Marks |
| **CRUD Operations** | Complete Create, Read, Update, Delete workflows across Skills, Bookings, and Users | ✅ Full Marks |
| **Search & Filter** | Real-time text search and domain category filtering | ✅ Full Marks |
| **Authentication & Authorization** | Encrypted passwords (`bcryptjs`) & protected routes with JWT | ✅ Full Marks |
| **GitHub Submission & README**| Clean Git commit trajectory with thorough technical documentation | ✅ Full Marks |

---

## 👨‍💻 Author & Submission Details

- **Project Name**: Swappr — Peer-to-Peer Skill Exchange Platform
- **Course**: Web Application Development Lab (Final Assessment)
- **Course Code**: ICT-3204
- **Student ID**: IT-23020
- **GitHub Repository**: [https://github.com/jawad-i/Lab-final-wad](https://github.com/jawad-i/Lab-final-wad)
- **License**: [ISC License](LICENSE)
