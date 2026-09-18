// import(".env").config();
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  BrainCircuit,
  CalendarClock,
  CheckCircle,
  CreditCard,
  GraduationCap,
  IndianRupee,
  LogOut,
  Lock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users
} from "lucide-react";
import "./styles.css";
import RoleLogin from "./auth/RoleLogin";
import RoleDashboard from "./auth/RoleDashboard";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const FALLBACK_PAYMENT_PLANS = [
  {
    id: "starter",
    name: "Starter mentoring call",
    amount: 3900,
    displayAmount: 39,
    description: "One focused 30 minute mentor session"
  },
  {
    id: "project",
    name: "Project help session",
    amount: 11900,
    displayAmount: 119,
    description: "One 75 minute project guidance session"
  },
  {
    id: "premium",
    name: "Premium skill sprint",
    amount: 24900,
    displayAmount: 249,
    description: "Two sessions with learning roadmap support"
  }
];

function App() {
  const [mentors, setMentors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState({ skill: "", college: "", mode: "" });
  const [learnerForm, setLearnerForm] = useState({
    studentName: "",
    college: "",
    skill: "",
    level: "Beginner",
    goal: ""
  });
  const [mentorForm, setMentorForm] = useState({
    name: "",
    role: "",
    college: "",
    skills: "",
    mode: "Online",
    availability: "",
    bio: ""
  });
  const [adminLogin, setAdminLogin] = useState({ email: "admin@skillswap.ai", password: "" });
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("skillSwapAdminToken") || "");
  const [adminData, setAdminData] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState({ ready: false, plans: FALLBACK_PAYMENT_PLANS, keyId: "" });
  const [paymentForm, setPaymentForm] = useState({
    planId: "project",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    skill: "",
    mentorId: "",
    requestId: ""
  });
  const [paymentStatus, setPaymentStatus] = useState("");
  const [aiMatches, setAiMatches] = useState([]);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [latestRequestId, setLatestRequestId] = useState("");
  const [mentorRequests, setMentorRequests] = useState([]);
  const [paidCredits, setPaidCredits] = useState(0);
  const [notice, setNotice] = useState("");
  const [roleSession, setRoleSession] = useState(() => {
    const stored = localStorage.getItem("skillSwapRoleSession");
    return stored ? JSON.parse(stored) : null;
  });

  async function loadMentors(activeFilters = filters) {
    const params = new URLSearchParams();
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await fetch(`${API}/api/mentors?${params}`);
    setMentors(await response.json());
  }

  async function loadRequests() {
    const response = await fetch(`${API}/api/requests`);
    setRequests(await response.json());
  }

  async function loadPaymentConfig() {
    const response = await fetch(`${API}/api/payments/config`);
    const config = await response.json();
    setPaymentConfig({
      ...config,
      plans: config.plans?.length ? config.plans : FALLBACK_PAYMENT_PLANS
    });
  };

  async function loadAdminDashboard(token = adminToken) {
    if (!token) return;
    const response = await fetch(`${API}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      localStorage.removeItem("skillSwapAdminToken");
      setAdminToken("");
      setAdminData(null);
      return;
    }

    setAdminData(await response.json());
  }

  useEffect(() => {
    loadMentors();
    loadRequests();
    loadPaymentConfig();
  }, []);

  useEffect(() => {
    if (adminToken) loadAdminDashboard(adminToken);
  }, [adminToken]);

  useEffect(() => {
    if (roleSession?.role !== "mentor" || !roleSession.mentorId) return;
    fetch(`${API}/api/mentor-requests?mentorId=${encodeURIComponent(roleSession.mentorId)}`)
      .then((response) => response.json())
      .then(setMentorRequests);
  }, [roleSession]);

  useEffect(() => {
    if (!roleSession?.token) return;
    const query = roleSession.role === "mentor"
      ? `role=mentor&mentorId=${encodeURIComponent(roleSession.mentorId || "")}`
      : `role=student&email=${encodeURIComponent(roleSession.email)}`;
    fetch(`${API}/api/credits?${query}`)
      .then((response) => response.json())
      .then((data) => setPaidCredits(data.credits || 0));
  }, [roleSession]);

  const stats = useMemo(
    () => [
      { label: "Active mentors", value: mentors.length || 4, icon: Users },
      { label: "Open requests", value: requests.filter((request) => request.status === "Open").length || 2, icon: MessageCircle },
      { label: "Skill areas", value: "18+", icon: BookOpen }
    ],
    [mentors, requests]
  );

  async function handleSearch(event) {
    event.preventDefault();
    await loadMentors(filters);
  }

  async function handleLearnerSubmit(event) {
    event.preventDefault();
    const response = await fetch(`${API}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(learnerForm)
    });
    if (!response.ok) return setNotice("Please fill student name, college, and skill.");
    const createdRequest = await response.json();
    setLatestRequestId(createdRequest.id);
    setLearnerForm({ studentName: "", college: "", skill: "", level: "Beginner", goal: "" });
    setNotice("Learning request posted. AI is finding the best mentors now.");
    await loadRequests();
    await getAiMatches(learnerForm);
    await loadAdminDashboard();
  }

  async function handleMentorSubmit(event) {
    event.preventDefault();
    const response = await fetch(`${API}/api/mentors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mentorForm)
    });
    if (!response.ok) return setNotice("Please fill mentor name, college, and skills.");
    setMentorForm({ name: "", role: "", college: "", skills: "", mode: "Online", availability: "", bio: "" });
    setNotice("Mentor profile added to Skill Swap AI.");
    await loadMentors();
    await loadAdminDashboard();
  }

  async function getAiMatches(payload = learnerForm) {
    const response = await fetch(`${API}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill: payload.skill, college: payload.college, mode: filters.mode })
    });
    const data = await response.json();
    setAiMatches(data.matches);
  }

  async function handleMentorSelect(mentor) {
    setSelectedMentor(mentor);
    if (!latestRequestId) {
      setNotice("Please post your learning request first, then select this mentor.");
      return;
    }
    setPaymentForm((current) => ({ ...current, mentorId: mentor.id, requestId: latestRequestId }));

    const response = await fetch(`${API}/api/requests/${latestRequestId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId: mentor.id })
    });
    if (!response.ok) {
      setNotice("Mentor selection could not be saved. Please try again.");
      return;
    }
    setNotice(`${mentor.name} has received your mentoring request.`);
  }

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    setPaymentStatus("");

    if (!paymentConfig.ready) {
      setPaymentStatus("Payment gateway is safe-disabled until Razorpay keys are added on the backend.");
      return;
    }

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setPaymentStatus("Could not load Razorpay Checkout. Please check your connection.");
      return;
    }

    try {
      const orderResponse = await fetch(`${API}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm)
      });
      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        setPaymentStatus(orderData.message || "Could not create payment order.");
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Skill Swap AI",
        description: orderData.plan.name,
        order_id: orderData.order.id,
        prefill: {
          name: paymentForm.customerName,
          email: paymentForm.customerEmail,
          contact: paymentForm.customerPhone
        },
        notes: {
          skill: paymentForm.skill,
          plan: paymentForm.planId
        },
        theme: {
          color: "#113f36"
        },
        handler: async (response) => {
          const verifyResponse = await fetch(`${API}/api/payments/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response)
          });
          const verifyData = await verifyResponse.json();
          if (!verifyResponse.ok) {
            setPaymentStatus(verifyData.message || "Payment verification failed.");
            return;
          }
          setPaymentStatus("Payment verified. Your mentoring session is booked.");
          await loadAdminDashboard();
        }
      };

      const checkout = new window.Razorpay(options);
      checkout.on("payment.failed", () => {
        setPaymentStatus("Payment failed or was cancelled. No booking was marked as paid.");
      });
      checkout.open();
    } catch (error) {
      console.error("Payment request failed:", error);
      setPaymentStatus("Could not connect to the payment server. Start the backend on port 5000 and try again.");
    }
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    const response = await fetch(`${API}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminLogin)
    });

    if (!response.ok) {
      return setNotice("Admin login failed. Check email and password.");
    }

    const data = await response.json();
    localStorage.setItem("skillSwapAdminToken", data.token);
    setAdminToken(data.token);
    setNotice("Admin login successful.");
    await loadAdminDashboard(data.token);
  }

  async function handleRoleLogin({ role, email, password, selectOnly }) {
    if (selectOnly) {
      setRoleSession((current) => current?.role === role ? current : { role });
      return;
    }

    const response = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.message || "Login failed. Check your email and password.");
      return;
    }

    const nextSession = {
      token: data.token,
      role: data.user.role,
      email: data.user.email,
      mentorId: data.user.mentorId,
      view: "main"
    };
    localStorage.setItem("skillSwapRoleSession", JSON.stringify(nextSession));
    setRoleSession(nextSession);
    setNotice(`${data.user.role[0].toUpperCase()}${data.user.role.slice(1)} login successful.`);
  }

  function handleRoleLogout() {
    localStorage.removeItem("skillSwapRoleSession");
    setRoleSession(null);
    setNotice("Logged out successfully.");
  }

  function handleDashboardBack() {
    const nextSession = { ...roleSession, view: "main" };
    localStorage.setItem("skillSwapRoleSession", JSON.stringify(nextSession));
    setRoleSession(nextSession);
  }

  async function handleMentorRequestStatus(requestId, status) {
    const response = await fetch(`${API}/api/mentor-requests/${requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId: roleSession.mentorId, status })
    });
    if (!response.ok) {
      setNotice("Could not update this request. Please try again.");
      return;
    }
    const updated = await response.json();
    setMentorRequests((current) => current.map((request) => request.id === updated.id ? updated : request));
    setNotice(`Request ${status.toLowerCase()} successfully.`);
  }

  if (roleSession?.token && roleSession.view !== "main") {
    return (
      <RoleDashboard
        mentors={mentors}
        onBack={handleDashboardBack}
        onLogout={handleRoleLogout}
        onRequestStatus={handleMentorRequestStatus}
        requests={requests}
        mentorRequests={mentorRequests}
        paidCredits={paidCredits}
        session={roleSession}
      />
    );
  }

  if (!roleSession?.token) {
    return (
      <>
        {notice && <div className="notice login-notice">{notice}</div>}
        <RoleLogin session={roleSession} onLogin={handleRoleLogin} />
      </>
    );
  }

  function handleAdminLogout() {
    localStorage.removeItem("skillSwapAdminToken");
    setAdminToken("");
    setAdminData(null);
    setNotice("Admin logged out.");
  }

  async function deleteMentor(id) {
    const response = await fetch(`${API}/api/admin/mentors/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!response.ok) return setNotice("Could not delete mentor. Please login again.");
    setNotice("Mentor deleted by admin.");
    await loadMentors();
    await loadAdminDashboard();
  }

  async function closeRequest(id) {
    const response = await fetch(`${API}/api/admin/requests/${id}/close`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!response.ok) return setNotice("Could not close request. Please login again.");
    setNotice("Learning request closed.");
    await loadRequests();
    await loadAdminDashboard();
  }

  return (
    <main>
      <nav className="topbar">
        <a className="brand" href="#home" aria-label="Skill Swap AI home">
          <span className="brand-mark"><BrainCircuit size={22} /></span>
          Skill Swap AI
        </a>
        <div className="nav-links">
          <a href="#mentors">Mentors</a>
          <a href="#learn">Learn</a>
          <a href="#teach">Teach</a>
          <a href="#payments">Payments</a>
          <button className="nav-logout" onClick={handleRoleLogout} type="button">
            Log out
          </button>
          <a href="#admin">Admin</a>
        </div>
      </nav>

      <section className="hero" id="home">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={16} /> AI powered campus skill exchange</span>
          <h1>Skill Swap AI</h1>
          <p>
            A platform where seniors, skilled students, and mentors from any college can teach students who want to learn.
          </p>
          <div className="hero-actions">
            <a className="primary-btn" href="#learn"><Search size={18} /> Find a mentor</a>
            <a className="secondary-btn" href="#teach"><Plus size={18} /> Teach a skill</a>
          </div>
        </div>
        <div className="hero-panel" aria-label="AI matching preview">
          <div className="match-card featured">
            <span>AI match</span>
            <strong>React project mentor</strong>
            <p>Best fit based on skill, college, availability, and rating.</p>
          </div>
          <div className="orbit-grid">
            <span>Python</span>
            <span>UI Design</span>
            <span>APIs</span>
            <span>Web-dev</span>
            <span>SQL</span>
            <span>ML</span>
            <span>AI-DS</span>
            <span>CyberSecurity</span>
          </div>
        </div>
      </section>

      <section className="stats-row" aria-label="Platform statistics">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div className="stat" key={item.label}>
              <Icon size={22} />
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          );
        })}
      </section>

      {notice && <div className="notice">{notice}</div>}

      <section className="workspace">
        <div className="section-heading" id="mentors">
          <span><GraduationCap size={18} /> Discover mentors</span>
          <h2>Search seniors and students from any college</h2>
        </div>

        <form className="search-bar" onSubmit={handleSearch}>
          <label>
            Skill
            <input value={filters.skill} onChange={(e) => setFilters({ ...filters, skill: e.target.value })} placeholder="React, Python, Figma" />
          </label>
          <label>
            College
            <input value={filters.college} onChange={(e) => setFilters({ ...filters, college: e.target.value })} placeholder="Any college" />
          </label>
          <label>
            Mode
            <select value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value })}>
              <option value="">Any</option>
              <option>Online</option>
              <option>Offline</option>
              <option>Hybrid</option>
            </select>
          </label>
          <button type="submit"><Search size={18} /> Search</button>
        </form>

        <div className="mentor-grid">
        {mentors.map((mentor) => (
          <MentorCard
            key={mentor.id}
            mentor={mentor}
            onSelect={handleMentorSelect}
            selected={selectedMentor?.id === mentor.id}
          />
        ))}
        </div>
      </section>

      <section className="split-section">
        <form className="form-panel" id="learn" onSubmit={handleLearnerSubmit}>
          <span className="panel-kicker"><Sparkles size={17} /> Learn a skill</span>
          <h2>Post what you want to learn</h2>
          <input required value={learnerForm.studentName} onChange={(e) => setLearnerForm({ ...learnerForm, studentName: e.target.value })} placeholder="Your name" />
          <input required value={learnerForm.college} onChange={(e) => setLearnerForm({ ...learnerForm, college: e.target.value })} placeholder="Your college" />
          <input required value={learnerForm.skill} onChange={(e) => setLearnerForm({ ...learnerForm, skill: e.target.value })} placeholder="Skill you want to learn" />
          <select value={learnerForm.level} onChange={(e) => setLearnerForm({ ...learnerForm, level: e.target.value })}>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
          <textarea value={learnerForm.goal} onChange={(e) => setLearnerForm({ ...learnerForm, goal: e.target.value })} placeholder="Learning goal or project need" />
          <button type="submit"><BrainCircuit size={18} /> Post and match</button>
        </form>

        <div className="requests-panel">
          <div className="panel-title">
            <h2>Latest learning requests</h2>
            <button onClick={() => getAiMatches()}><Sparkles size={17} /> AI match</button>
          </div>
          {requests.slice(0, 4).map((request) => (
            <div className="request-item" key={request.id}>
              <strong>{request.skill}</strong>
              <span>{request.studentName} · {request.college} · {request.status}</span>
              <p>{request.goal}</p>
            </div>
          ))}
          {aiMatches.length > 0 && (
            <div className="ai-box">
              <strong>Choose your best-fit mentor</strong>
              {aiMatches.map((mentor) => (
                <div className="ai-match" key={mentor.id}>
                  <span>{mentor.name} · {mentor.aiScore}% fit</span>
                  <button
                    className={selectedMentor?.id === mentor.id ? "selected-match" : ""}
                    onClick={() => handleMentorSelect(mentor)}
                    type="button"
                  >
                    {selectedMentor?.id === mentor.id ? "Selected" : "Select mentor"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {selectedMentor && (
            <div className="selected-mentor">
              <CheckCircle size={20} />
              <div>
                <strong>Mentor selected: {selectedMentor.name}</strong>
                <span>{selectedMentor.role} · {selectedMentor.college}</span>
              </div>
              <a href="#payments">Book a session</a>
            </div>
          )}
        </div>
      </section>

      <section className="teach-section" id="teach">
        <form className="form-panel wide" onSubmit={handleMentorSubmit}>
          <span className="panel-kicker"><Users size={17} /> Teach a skill</span>
          <h2>Create mentor profile</h2>
          <div className="form-grid">
            <input required value={mentorForm.name} onChange={(e) => setMentorForm({ ...mentorForm, name: e.target.value })} placeholder="Your name" />
            <input value={mentorForm.role} onChange={(e) => setMentorForm({ ...mentorForm, role: e.target.value })} placeholder="Senior, student, faculty, developer" />
            <input required value={mentorForm.college} onChange={(e) => setMentorForm({ ...mentorForm, college: e.target.value })} placeholder="College name" />
            <input required value={mentorForm.skills} onChange={(e) => setMentorForm({ ...mentorForm, skills: e.target.value })} placeholder="Skills, comma separated" />
            <select value={mentorForm.mode} onChange={(e) => setMentorForm({ ...mentorForm, mode: e.target.value })}>
              <option>Online</option>
              <option>Offline</option>
              <option>Hybrid</option>
            </select>
            <input value={mentorForm.availability} onChange={(e) => setMentorForm({ ...mentorForm, availability: e.target.value })} placeholder="Availability" />
          </div>
          <textarea value={mentorForm.bio} onChange={(e) => setMentorForm({ ...mentorForm, bio: e.target.value })} placeholder="Short mentor bio" />
          <button type="submit"><Plus size={18} /> Add mentor</button>
        </form>
      </section>

      <section className="payment-section" id="payments">
        <div className="section-heading">
          <span><Lock size={18} /> Secure payment gateway</span>
          <h2>Book paid mentoring safely</h2>
        </div>

        <div className="payment-layout">
          <div className="payment-plans">
            {paymentConfig.plans.map((plan) => (
              <button
                className={paymentForm.planId === plan.id ? "plan-card active" : "plan-card"}
                key={plan.id}
                onClick={() => setPaymentForm({ ...paymentForm, planId: plan.id })}
                type="button"
              >
                <span>{plan.name}</span>
                <strong><IndianRupee size={22} /> {plan.displayAmount}</strong>
                <small>{plan.description}</small>
              </button>
            ))}
          </div>

          <form className="form-panel payment-form" onSubmit={handlePaymentSubmit}>
            <span className="panel-kicker"><CreditCard size={17} /> Razorpay checkout</span>
            <h2>Pay for a session</h2>
            <input required value={paymentForm.customerName} onChange={(e) => setPaymentForm({ ...paymentForm, customerName: e.target.value })} placeholder="Student name" />
            <input required type="email" value={paymentForm.customerEmail} onChange={(e) => setPaymentForm({ ...paymentForm, customerEmail: e.target.value })} placeholder="Email address" />
            <input required value={paymentForm.customerPhone} onChange={(e) => setPaymentForm({ ...paymentForm, customerPhone: e.target.value })} placeholder="Phone number" />
            <input value={paymentForm.skill} onChange={(e) => setPaymentForm({ ...paymentForm, skill: e.target.value })} placeholder="Skill or mentor session topic" />
            <button type="submit"><Lock size={18} /> Pay securely</button>
            {!paymentConfig.ready && (
              <p className="gateway-warning">
                Razorpay is not configured yet. Add backend keys to enable real payments.
              </p>
            )}
            {paymentStatus && <p className="payment-status">{paymentStatus}</p>}
          </form>
        </div>
      </section>

      <section className="admin-section" id="admin">
        <div className="section-heading">
          <span><ShieldCheck size={18} /> Owner area</span>
          <h2>Admin dashboard</h2>
        </div>

        {!adminToken ? (
          <form className="form-panel admin-login" onSubmit={handleAdminLogin}>
            <input required type="email" value={adminLogin.email} onChange={(e) => setAdminLogin({ ...adminLogin, email: e.target.value })} placeholder="Admin email" />
            <input required type="password" value={adminLogin.password} onChange={(e) => setAdminLogin({ ...adminLogin, password: e.target.value })} placeholder="Admin password" />
            <button type="submit"><ShieldCheck size={18} /> Login as admin</button>
          </form>
        ) : (
          <div className="admin-dashboard">
            <div className="admin-actions">
              <strong>You are logged in as admin</strong>
              <button onClick={handleAdminLogout}><LogOut size={17} /> Logout</button>
            </div>

            <div className="admin-stats">
              <div><strong>{adminData?.stats.mentors || 0}</strong><span>Total mentors</span></div>
              <div><strong>{adminData?.stats.requests || 0}</strong><span>Total requests</span></div>
              <div><strong>{adminData?.stats.openRequests || 0}</strong><span>Open requests</span></div>
              <div><strong>{adminData?.stats.skills || 0}</strong><span>Skills listed</span></div>
              <div><strong>{adminData?.stats.payments || 0}</strong><span>Payments</span></div>
              <div><strong>₹{Math.round((adminData?.stats.paidRevenue || 0) / 100)}</strong><span>Paid revenue</span></div>
            </div>

            <div className="admin-grid">
              <AdminPanel title="Manage mentors">
                {adminData?.mentors.map((mentor) => (
                  <div className="admin-item" key={mentor.id}>
                    <div>
                      <strong>{mentor.name}</strong>
                      <span>{mentor.college} · {mentor.skills.join(", ")}</span>
                    </div>
                    <button className="danger-btn" onClick={() => deleteMentor(mentor.id)}><Trash2 size={16} /> Delete</button>
                  </div>
                ))}
              </AdminPanel>

              <AdminPanel title="Manage requests">
                {adminData?.requests.map((request) => (
                  <div className="admin-item" key={request.id}>
                    <div>
                      <strong>{request.skill}</strong>
                      <span>{request.studentName} · {request.college} · {request.status}</span>
                    </div>
                    {request.status === "Open" && (
                      <button onClick={() => closeRequest(request.id)}><CheckCircle size={16} /> Close</button>
                    )}
                  </div>
                ))}
              </AdminPanel>

              <AdminPanel title="Payment history">
                {adminData?.payments?.length ? adminData.payments.map((payment) => (
                  <div className="admin-item" key={payment.id}>
                    <div>
                      <strong>{payment.planName}</strong>
                      <span>{payment.customerName} · ₹{payment.amount / 100} · {payment.status}</span>
                    </div>
                  </div>
                )) : (
                  <div className="admin-item">
                    <div>
                      <strong>No payments yet</strong>
                      <span>Verified payments will appear here.</span>
                    </div>
                  </div>
                )}
              </AdminPanel>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function AdminPanel({ title, children }) {
  return (
    <div className="admin-panel">
      <h3>{title}</h3>
      <div className="admin-list">{children}</div>
    </div>
  );
}

function MentorCard({ mentor, onSelect, selected }) {
  return (
    <article className="mentor-card">
      <div className="card-top">
        <div>
          <h3>{mentor.name}</h3>
          <span>{mentor.role}</span>
        </div>
        <div className="score"><Sparkles size={14} /> {mentor.aiScore || 92}</div>
      </div>
      <p>{mentor.bio}</p>
      <div className="chips">
        {mentor.skills.map((skill) => <span key={skill}>{skill}</span>)}
      </div>
      <div className="meta-row">
        <span><GraduationCap size={15} /> {mentor.college}</span>
        <span><CalendarClock size={15} /> {mentor.availability}</span>
        <span><Star size={15} /> {mentor.rating}</span>
        <span><CreditCard size={15} /> {(mentor.paidClasses || 0) * 50} credits earned</span>
      </div>
      <button className={selected ? "card-button selected-card-button" : "card-button"} onClick={() => onSelect(mentor)} type="button">
        {selected ? <CheckCircle size={17} /> : <MessageCircle size={17} />}
        {selected ? "Mentor selected" : "Select this mentor"}
      </button>
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
