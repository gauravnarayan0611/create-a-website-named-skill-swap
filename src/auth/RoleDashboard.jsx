import React from "react";
import { ArrowLeft, BookOpen, CalendarClock, LogOut, MessageCircle, Search, Users } from "lucide-react";
import "./role-login.css";

export default function RoleDashboard({ session, mentors, requests, mentorRequests, paidCredits, onBack, onLogout, onRequestStatus }) {
  const isStudent = session.role === "student";
  const openRequests = requests.filter((request) => request.status === "Open").length;
  const activity = isStudent ? requests : mentorRequests;
  const attendedClasses = activity.filter((request) => request.status === "Completed").length;
  const credits = attendedClasses * 50 + paidCredits;

  return (
    <main className="role-dashboard-page">
      <header className="dashboard-header">
        <button className="dashboard-back" onClick={onBack} type="button">
          <ArrowLeft size={17} /> Back to Skill Swap
        </button>
        <button className="dashboard-logout" onClick={onLogout} type="button">
          <LogOut size={17} /> Log out
        </button>
      </header>

      <section className="dashboard-hero">
        <span className="panel-kicker">{isStudent ? "Student dashboard" : "Teacher dashboard"}</span>
        <h1>Welcome back, {session.email.split("@")[0]}.</h1>
        <p>
          {isStudent
            ? "Find the right mentor, track your learning requests, and keep your next session moving."
            : "Share your expertise, discover learners, and keep your teaching activity organized."}
        </p>
      </section>

      <section className="dashboard-stats">
        <div><Users size={21} /><strong>{mentors.length}</strong><span>Active mentors</span></div>
        <div><MessageCircle size={21} /><strong>{openRequests}</strong><span>Open requests</span></div>
        <div><BookOpen size={21} /><strong>18+</strong><span>Skill areas</span></div>
        <div><BookOpen size={21} /><strong>{credits}</strong><span>Credits earned</span></div>
      </section>

      <section className="dashboard-content">
        <div className="dashboard-card dashboard-actions-card">
          <span className="panel-kicker">{isStudent ? "Your next step" : "Your workspace"}</span>
          <h2>{isStudent ? "Start learning with a mentor" : "Grow the Skill Swap community"}</h2>
          <p>
            {isStudent
              ? "Search by skill, college, or learning mode and connect with a mentor who fits your goal."
              : "Keep your teaching profile visible and help students turn their ideas into real projects."}
          </p>
          <a className="dashboard-primary" href={isStudent ? "#mentors" : "#teach"} onClick={onBack}>
            {isStudent ? <Search size={17} /> : <Users size={17} />}
            {isStudent ? "Find a mentor" : "Open teaching profile"}
          </a>
        </div>

        <div className="dashboard-card">
          <span className="panel-kicker"><CalendarClock size={17} /> Recent activity</span>
          <h2>{isStudent ? "Learning requests" : "Learner requests"}</h2>
          <div className="dashboard-list">
            {activity.slice(0, 4).map((request) => (
              <div className="dashboard-list-item" key={request.id}>
                <strong>{request.skill}</strong>
                <span>{request.studentName} · {request.status}</span>
                {!isStudent && request.mentorStatus === "Pending" && (
                  <div className="request-actions">
                    <button onClick={() => onRequestStatus(request.id, "Accepted")} type="button">Accept</button>
                    <button onClick={() => onRequestStatus(request.id, "Declined")} type="button">Decline</button>
                  </div>
                )}
                {!isStudent && request.status === "Matched" && (
                  <div className="request-actions">
                    <button onClick={() => onRequestStatus(request.id, "Completed")} type="button">Mark class attended</button>
                  </div>
                )}
              </div>
            ))}
            {!activity.length && <p>No requests have been posted yet.</p>}
          </div>
          <div className="credits-note">
            <strong>{attendedClasses} {attendedClasses === 1 ? "class" : "classes"} attended</strong>
            <span>1 attended class = 50 credits</span>
          </div>
        </div>
      </section>
    </main>
  );
}
