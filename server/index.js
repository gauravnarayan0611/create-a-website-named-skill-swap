import cors from "cors";
import express from "express";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { existsSync, readFileSync, promises as fs } from "fs";
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "data.json");
const app = express();

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    process.env[key.trim()] ||= valueParts.join("=").trim();
  }
}

loadLocalEnv();

const PORT = process.env.PORT || 5000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@skillswap.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "skill-swap-local-secret";
const ROLE_CREDENTIALS = {
  student: {
    email: process.env.STUDENT_EMAIL || "student@skillswap.ai",
    password: process.env.STUDENT_PASSWORD || "student123"
  },
  mentor: {
    email: process.env.MENTOR_EMAIL || "mentor@skillswap.ai",
    password: process.env.MENTOR_PASSWORD || "mentor123",
    mentorId: process.env.MENTOR_ID || "m1"
  }
};
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/skill_swap_Ai";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || new URL(MONGODB_URI).pathname.slice(1) || "skill_swap_Ai";
let mongoClient;
let mongoDb;
let mongoConnectionError = "";

const paymentPlans = {
  starter: {
    id: "starter",
    name: "Starter mentoring call",
    amount: 3900,
    displayAmount: 39,
    description: "One focused 30 minute mentor session"
  },
  project: {
    id: "project",
    name: "Project help session",
    amount: 11900,
    displayAmount: 119,
    description: "One 75 minute project guidance session"
  },
  premium: {
    id: "premium",
    name: "Premium skill sprint",
    amount: 24900,
    displayAmount: 249,
    description: "Two sessions with learning roadmap support"
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin not allowed."));
  }
}));
app.use(express.json());

async function getMongoDb() {
  if (!MONGODB_URI) return null;
  if (mongoDb) return mongoDb;
  try {
    mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGODB_DB_NAME);
    mongoConnectionError = "";
    await seedMongoFromJsonIfEmpty(mongoDb);
    return mongoDb;
  } catch (error) {
    mongoConnectionError = error.message;
    console.warn(`MongoDB connection failed: ${error.message}`);
    return null;
  }
}

async function seedMongoFromJsonIfEmpty(db) {
  const mentorCount = await db.collection("mentors").countDocuments();
  const requestCount = await db.collection("requests").countDocuments();
  const paymentCount = await db.collection("payments").countDocuments();
  if (mentorCount || requestCount || paymentCount) return;

  const raw = await fs.readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  if (data.mentors?.length) await db.collection("mentors").insertMany(data.mentors);
  if (data.requests?.length) await db.collection("requests").insertMany(data.requests);
  if (data.payments?.length) await db.collection("payments").insertMany(data.payments);
}

async function readData() {
  const db = await getMongoDb();
  if (db) {
    const mongoData = await Promise.all([
      db.collection("mentors").find({}, { projection: { _id: 0 } }).toArray(),
      db.collection("requests").find({}, { projection: { _id: 0 } }).toArray(),
      db.collection("payments").find({}, { projection: { _id: 0 } }).toArray()
    ]);

    return {
      mentors: mongoData[0],
      requests: mongoData[1],
      payments: mongoData[2]
    };
  }

  const raw = await fs.readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  data.mentors ||= [];
  data.requests ||= [];
  data.payments ||= [];
  return data;
}

async function writeData(data) {
  const db = await getMongoDb();
  if (db) {
    const collections = [
      ["mentors", data.mentors || []],
      ["requests", data.requests || []],
      ["payments", data.payments || []]
    ];

    for (const [collectionName, documents] of collections) {
      const collection = db.collection(collectionName);
      await collection.deleteMany({});
      if (documents.length) {
        await collection.insertMany(documents);
      }
    }
    return;
  }

  await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function scoreMentor(mentor, query) {
  const skill = normalize(query.skill);
  const college = normalize(query.college);
  const mode = normalize(query.mode);
  let score = mentor.rating * 8;

  if (skill && mentor.skills.some((item) => normalize(item).includes(skill) || skill.includes(normalize(item)))) {
    score += 45;
  }
  if (college && normalize(mentor.college).includes(college)) {
    score += 20;
  }
  if (mode && normalize(mentor.mode) === mode) {
    score += 10;
  }
  score += Math.min(mentor.sessionsCompleted, 80) / 4;
  return Math.round(score);
}

function createAdminToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    role: "admin",
    exp: Date.now() + 1000 * 60 * 60 * 8
  })).toString("base64url");
  const signature = createHmac("sha256", ADMIN_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function createRoleToken(email, role) {
  const payload = Buffer.from(JSON.stringify({
    email,
    role,
    exp: Date.now() + 1000 * 60 * 60 * 8
  })).toString("base64url");
  const signature = createHmac("sha256", ADMIN_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = createHmac("sha256", ADMIN_SECRET).update(payload).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (decoded.role !== "admin" || decoded.exp < Date.now()) return null ;
  return decoded;
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const admin = verifyAdminToken(token);
  if (!admin) {
    return res.status(401).json({ message: "Admin login required." });
  }
  req.admin = admin;
  next();
}

function createRazorpayAuthHeader() {
  const token = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature || !RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

app.get("/api/health", async (_req, res) => {
  const db = await getMongoDb();
  res.json({
    ok: true,
    name: "Skill Swap AI API",
    database: db ? "mongodb" : "json-file",
    mongoConfigured: Boolean(MONGODB_URI),
    mongoDatabase: MONGODB_DB_NAME,
    mongoError: db ? "" : mongoConnectionError
  });
});

app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({
      token: createAdminToken(email),
      admin: { email, role: "admin" }
    });
  }
  res.status(401).json({ message: "Invalid admin email or password." });
});

app.post("/api/auth/login", (req, res) => {
  const { role, email, password } = req.body;
  const normalizedRole = normalize(role);
  const normalizedEmail = normalize(email);
  const credentials = normalizedRole === "admin"
    ? { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    : ROLE_CREDENTIALS[normalizedRole];

  if (!credentials || normalizedEmail !== normalize(credentials.email) || password !== credentials.password) {
    return res.status(401).json({ message: `Invalid ${normalizedRole || "user"} email or password.` });
  }

  res.json({
    token: createRoleToken(credentials.email, normalizedRole),
    user: { email: credentials.email, role: normalizedRole, mentorId: credentials.mentorId || "" }
  });
});

app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
  const data = await readData();
  const openRequests = data.requests.filter((request) => request.status === "Open").length;
  const skills = new Set(data.mentors.flatMap((mentor) => mentor.skills.map(normalize)));

  res.json({
    stats: {
      mentors: data.mentors.length,
      requests: data.requests.length,
      openRequests,
      skills: skills.size,
      payments: data.payments.length,
      paidRevenue: data.payments
        .filter((payment) => payment.status === "paid")
        .reduce((sum, payment) => sum + payment.amount, 0)
    },
    mentors: data.mentors,
    requests: data.requests,
    payments: data.payments
  });
});

app.get("/api/payments/config", (_req, res) => {
  res.json({
    gateway: "razorpay",
    ready: Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET),
    keyId: RAZORPAY_KEY_ID,
    plans: Object.values(paymentPlans)
  });
});

app.get("/api/mentors", async (req, res) => {
  const data = await readData();
  const skill = normalize(req.query.skill);
  const college = normalize(req.query.college);
  const mode = normalize(req.query.mode);

  const mentors = data.mentors
    .filter((mentor) => {
      const skillMatch = !skill || mentor.skills.some((item) => normalize(item).includes(skill));
      const collegeMatch = !college || normalize(mentor.college).includes(college);
      const modeMatch = !mode || normalize(mentor.mode) === mode;
      return skillMatch && collegeMatch && modeMatch;
    })
    .map((mentor) => ({
      ...mentor,
      aiScore: scoreMentor(mentor, req.query),
      paidClasses: data.payments.filter((payment) => payment.status === "paid" && payment.mentorId === mentor.id).length
    }))
    .sort((a, b) => b.aiScore - a.aiScore);

  res.json(mentors);
});

app.post("/api/mentors", async (req, res) => {
  const { name, role, college, skills, mode, bio, availability } = req.body;
  if (!name || !college || !skills) {
    return res.status(400).json({ message: "Name, college, and skills are required." });
  }

  const data = await readData();
  const mentor = {
    id: randomUUID(),
    name: String(name).trim(),
    role: role || "Student mentor",
    college: String(college).trim(),
    skills: Array.isArray(skills)
      ? skills.map(String).map((item) => item.trim()).filter(Boolean)
      : String(skills).split(",").map((item) => item.trim()).filter(Boolean),
    mode: mode || "Hybrid",
    bio: bio || "Happy to help college students learn this skill from basics.",
    availability: availability || "Weekends",
    rating: 4.7,
    sessionsCompleted: 0
  };

  data.mentors.unshift(mentor);
  await writeData(data);
  res.status(201).json(mentor);
});

app.get("/api/requests", async (_req, res) => {
  const data = await readData();
  res.json(data.requests);
});

app.post("/api/requests", async (req, res) => {
  const { studentName, college, skill, goal, level } = req.body;
  if (!studentName || !college || !skill) {
    return res.status(400).json({ message: "Student name, college, and skill are required." });
  }

  const data = await readData();
  const request = {
    id: randomUUID(),
    studentName: String(studentName).trim(),
    college: String(college).trim(),
    skill: String(skill).trim(),
    goal: goal || "I want to learn this skill with a mentor.",
    level: level || "Beginner",
    status: "Open",
    createdAt: new Date().toISOString()
  };

  data.requests.unshift(request);
  await writeData(data);
  res.status(201).json(request);
});

app.patch("/api/requests/:id/assign", async (req, res) => {
  const { mentorId } = req.body;
  const data = await readData();
  const request = data.requests.find((item) => item.id === req.params.id);
  const mentor = data.mentors.find((item) => item.id === mentorId);

  if (!request) return res.status(404).json({ message: "Learning request not found." });
  if (!mentor) return res.status(404).json({ message: "Mentor not found." });

  request.mentorId = mentor.id;
  request.mentorName = mentor.name;
  request.mentorStatus = "Pending";
  await writeData(data);
  res.json(request);
});

app.get("/api/mentor-requests", async (req, res) => {
  const data = await readData();
  res.json(data.requests.filter((request) => request.mentorId === req.query.mentorId));
});

app.patch("/api/mentor-requests/:id/status", async (req, res) => {
  const { status, mentorId } = req.body;
  if (!["Accepted", "Declined", "Completed"].includes(status)) {
    return res.status(400).json({ message: "Status must be Accepted, Declined, or Completed." });
  }

  const data = await readData();
  const request = data.requests.find((item) => item.id === req.params.id && item.mentorId === mentorId);
  if (!request) return res.status(404).json({ message: "Mentor request not found." });

  request.mentorStatus = status;
  request.status = status === "Accepted"
    ? "Matched"
    : status === "Completed"
      ? "Completed"
      : "Open";
  await writeData(data);
  res.json(request);
});

app.post("/api/match", async (req, res) => {
  const data = await readData();
  const matches = data.mentors
    .map((mentor) => ({
      ...mentor,
      aiScore: scoreMentor(mentor, req.body),
      reason: `Strong fit for ${req.body.skill || "your skill"} based on skills, college proximity, ratings, and availability.`
    }))
    .filter((mentor) => mentor.aiScore >= 35)
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 5);

  res.json({ matches });
});

app.post("/api/payments/create-order", async (req, res) => {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({
      message: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable real payments."
    });
  }

  const { planId, customerName, customerEmail, customerPhone, skill, mentorId } = req.body;
  const plan = paymentPlans[planId];
  if (!plan) {
    return res.status(400).json({ message: "Invalid payment plan." });
  };
  if (!customerName || !customerEmail || !customerPhone) {
    return res.status(400).json({ message: "Name, email, and phone are required for payment." });
  }

  let order;
  try {
    const receipt = `skill_${Date.now()}`.slice(0, 40);
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: createRazorpayAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: "INR",
        receipt,
        notes: {
          planId: plan.id,
          planName: plan.name,
          skill: skill || "Skill Swap AI session",
          mentorId: mentorId || "",
          customerEmail
        }
      })
    });

    const responseText = await response.text();
    try {
      order = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        message: "Razorpay returned a non-JSON response.",
        details: responseText.slice(0, 300)
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        message: "Could not create Razorpay order.",
        details: order
      });
    }
  } catch (error) {
    console.error("Razorpay request failed:", error);
    return res.status(502).json({ message: "Could not connect to Razorpay." });
  }

  const data = await readData();
  const payment = {
    id: randomUUID(),
    gateway: "razorpay",
    orderId: order.id,
    paymentId: "",
    planId: plan.id,
    planName: plan.name,
    amount: plan.amount,
    currency: "INR",
    customerName: String(customerName).trim(),
    customerEmail: String(customerEmail).trim(),
    customerPhone: String(customerPhone).trim(),
    skill: skill || "Skill Swap AI session",
    mentorId: mentorId || "",
    requestId: req.body.requestId || "",
    status: "created",
    createdAt: new Date().toISOString(),
    paidAt: ""
  };
  data.payments.unshift(payment);
  await writeData(data);

  res.status(201).json({
    success:true,
    keyId: RAZORPAY_KEY_ID,
    order,
    plan,
    customer: {
      name: payment.customerName,
      email: payment.customerEmail,
      phone: payment.customerPhone
    }
  });
});



// This runs on Node.js — Buffer is available here, and secrets stay hidden
app.post("/api/payments/verify", async (req, res) => {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature
  } = req.body;

  if (!verifyRazorpaySignature({ orderId, paymentId, signature })) {
    return res.status(400).json({ message: "Payment verification failed." });
  }

  const data = await readData();
  const payment = data.payments.find((item) => item.orderId === orderId);
  if (!payment) {
    return res.status(404).json({ message: "Payment order not found." });
  }

  payment.paymentId = paymentId;
  payment.status = "paid";
  payment.paidAt = new Date().toISOString();
  if (payment.requestId) {
    const request = data.requests.find((item) => item.id === payment.requestId);
    if (request) request.paymentStatus = "paid";
  }
  await writeData(data);

  res.json({ message: "Payment verified successfully.", payment });
});

app.get("/api/credits", async (req, res) => {
  const data = await readData();
  const paidPayments = data.payments.filter((payment) => payment.status === "paid");
  const paidClasses = req.query.role === "mentor"
    ? paidPayments.filter((payment) => payment.mentorId === req.query.mentorId).length
    : paidPayments.filter((payment) => normalize(payment.customerEmail) === normalize(req.query.email)).length;
  res.json({ paidClasses, credits: paidClasses * 50 });
});

app.delete("/api/admin/mentors/:id", requireAdmin, async (req, res) => {
  const data = await readData();
  const originalCount = data.mentors.length;
  data.mentors = data.mentors.filter((mentor) => mentor.id !== req.params.id);

  if (data.mentors.length === originalCount) {
    return res.status(404).json({ message: "Mentor not found." });
  }

  await writeData(data);
  res.json({ message: "Mentor deleted." });
});

app.patch("/api/admin/requests/:id/close", requireAdmin, async (req, res) => {
  const data = await readData();
  const request = data.requests.find((item) => item.id === req.params.id);

  if (!request) {
    return res.status(404).json({ message: "Request not found." });
  }

  request.status = "Closed";
  await writeData(data);
  res.json(request);
});

app.use(express.static(path.join(__dirname, "..", "dist")));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found." });
  }
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Skill Swap AI API running at http://localhost:${PORT}`);
});
