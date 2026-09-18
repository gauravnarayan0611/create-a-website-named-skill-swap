# Skill Swap AI

Skill Swap AI is a full-stack campus skill exchange platform. Seniors, skilled students, or mentors from any college can list what they teach, and learners can post what they want to learn.

## Features

- React frontend built with Vite
- Express backend API
- Mentor search by skill, college, and learning mode
- Learner request posting
- Mentor profile creation
- Admin login and dashboard
- Admin mentor deletion and request closing
- Razorpay payment gateway integration
- Server-side payment order creation and signature verification
- Optional MongoDB database connection
- AI-style matching endpoint that ranks mentors by skill fit, college proximity, rating, and availability
- Local JSON data store for quick development

## Run Locally

```bash
npm install
npm run dev
```

Frontend: `http://127.0.0.1:5173`  
Backend API: `http://localhost:5000`

## MongoDB Setup

MongoDB code is in [server/index.js](server/index.js). Add your MongoDB connection details in a `.env` file at the project root:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/skill_swap_Ai
MONGODB_DB_NAME=skill_swap_Ai
```

When `MONGODB_URI` exists, the backend saves mentors, requests, and payments in MongoDB collections:

- `mentors`
- `requests`
- `payments`

When `MONGODB_URI` is missing, the app uses `server/data.json` for local testing.

For local MongoDB, start MongoDB on your computer first. In MongoDB Compass, connect to:

```text
mongodb://127.0.0.1:27017
```

Then open database:

```text
skill_swap_Ai
```

## Admin Login

Default local admin:

```text
Email: admin@skillswap.ai
Password: admin123
```

Change these before hosting by setting environment variables:

```bash
ADMIN_EMAIL=admin@gaurav6859skillswap.ai
ADMIN_PASSWORD=admingaurav1q2w3e4r.in
ADMIN_SECRET=my-1st-webskill-swap-in--@#$%.in-random-api-?.com

# ADMIN_EMAIL=your@email.com
# ADMIN_PASSWORD=your-strong-password
# ADMIN_SECRET=your-long-secret
```

## Razorpay Payments

Real payments stay disabled until Razorpay keys are configured on the backend.

Create Razorpay API keys from the Razorpay Dashboard, then set:

```bash
RAZORPAY_KEY_ID=rzp_test_T9KD4U1acLVUmY
RAZORPAY_KEY_SECRET=MCiwTCWuM47DGuizGbq0FpQV
# RAZORPAY_KEY_ID=rzp_test_your_key_id
# RAZORPAY_KEY_SECRET=your_key_secret
```

Security notes:

- The frontend only receives the Razorpay Key ID.
- The Razorpay Key Secret stays only on the backend.
- Payment amount is selected by backend plan ID, not trusted from the browser.
- Successful payments are saved only after backend signature verification.

## API Routes

- `GET /api/health`
- `POST /api/admin/login`
- `GET /api/admin/dashboard`
- `DELETE /api/admin/mentors/:id`
- `PATCH /api/admin/requests/:id/close`
- `GET /api/payments/config`
- `POST /api/payments/create-order`
- `POST /api/payments/verify`
- `GET /api/mentors?skill=React&college=Delhi&mode=Online`
- `POST /api/mentors`
- `GET /api/requests`
- `POST /api/requests`
- `POST /api/match`
