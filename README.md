# Swappr - Community Peer-to-Peer Skill Exchange Platform

**Swappr** is a full-stack, time-banking skill exchange platform designed to empower local communities and learners to share knowledge without monetary transactions. Members teach skills they know to earn Skill Credits, and spend those credits to learn new skills from their peers.

---

## 🌟 Key Features

1. **Time-Banking Credit Economy**:
   - New members receive **10 Free Skill Credits** upon registration.
   - Requesting a skill session reserves credits.
   - When the mentor marks the session completed, 1 Skill Credit is seamlessly transferred from learner to mentor.

2. **Multimedia Skill Offers**:
   - Offer skills across categories: *Programming, Design, Music, Language, Cooking, Fitness*.
   - Attach syllabus/curriculum notes (**PDF**) and demo walkthroughs (**Video MP4/WebM**).
   - In-browser PDF access and native video streaming.

3. **Complete Interactive Dashboard**:
   - Live metrics: Available Credits, Skills Offered, Total Sessions.
   - Mentoring session management: View requests for your skills and confirm completions to earn credits.
   - Learning session tracking: View upcoming booked sessions.

4. **Public & Filterable Skills Catalog**:
   - Live search by keyword or title.
   - Multi-category filtering.
   - One-click booking with credit verification.

5. **Profile & Account Management**:
   - Custom profile avatar upload.
   - Update display name.
   - Manage your posted skills or delete them with confirmation.
   - Account deletion safety controls.

6. **Administrative Control Panel**:
   - Real-time directory of all platform users.
   - Role badges, circulating credit metrics, and moderation tools.

7. **Production-Ready & Responsive**:
   - Modern glassmorphic dark navbar with mobile drawer navigation.
   - Sticky full-width footer on every page.
   - Serverless-compatible database connection pooling (ideal for Vercel and traditional servers alike).

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js (v5)
- **Database**: MongoDB Atlas with Mongoose ORM
- **Authentication**: JWT (JSON Web Tokens) & bcryptjs password hashing
- **File Processing**: Multer memory storage with DataURI encoding
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, Bootstrap 5.3, FontAwesome 6.4

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- MongoDB Atlas cluster or local MongoDB instance

### 2. Installation
```bash
# Clone the repository
git clone <repository-url>
cd skillswap

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
```

### 4. Running Locally
```bash
# Start in development mode with nodemon
npm run dev

# Or start in production mode
npm start
```
Visit the application in your browser at `http://localhost:5000`.

---

## 📡 Core API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user & receive 10 credits | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | No |
| `GET` | `/api/auth/me` | Retrieve currently authenticated user | Yes |
| `GET` | `/api/skills` | List all skills with search & category filters | No |
| `POST` | `/api/skills` | Post a new skill offer with PDF/video attachments | Yes |
| `DELETE`| `/api/skills/:id` | Delete a skill offer (owner or admin) | Yes |
| `POST` | `/api/bookings` | Book a skill session using 1 credit | Yes |
| `GET` | `/api/bookings/my-bookings` | List user's booked & requested sessions | Yes |
| `PATCH`| `/api/bookings/:id/complete`| Mark session complete & transfer credit | Yes |
| `GET` | `/api/users/profile` | Get profile details & user's skills | Yes |
| `PUT` | `/api/users/profile` | Update avatar & display name | Yes |
| `DELETE`| `/api/users/profile` | Permanently delete user account | Yes |
| `GET` | `/api/admin/users` | List all users for administration | Admin Only |
| `DELETE`| `/api/admin/users/:id` | Moderation: Delete user account | Admin Only |

---

## 📄 License
This project is licensed under the ISC License.