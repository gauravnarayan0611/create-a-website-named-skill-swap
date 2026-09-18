import React, { useState } from "react";
import { ArrowRight, GraduationCap, LockKeyhole, Sparkles, Users } from "lucide-react";
import "./role-login.css";

const roleOptions = [
  {
    id: "student",
    label: "Student",
    description: "Find mentors, post learning requests, and book sessions.",
    icon: GraduationCap
  },
  {
    id: "mentor",
    label: "Teacher",
    description: "Share your skills and manage your teaching profile.",
    icon: Users
  }
];

export default function RoleLogin({ session, onLogin }) {
  const [selectedRole, setSelectedRole] = useState(session?.role || "student");
  const role = roleOptions.find((option) => option.id === selectedRole) || roleOptions[0];
  const Icon = role.icon;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onLogin({
      role: selectedRole,
      email: form.get("email"),
      password: form.get("password")
    });
  }

  return (
    <section className="access-section" id="access">
      <div className="login-shell">
        <div className="login-brand">
          <span className="login-brand-mark"><Sparkles size={22} /></span>
          <span>Skill Swap</span>
        </div>

        <div className="login-card">
          <div className="login-card-heading">
            <span className="login-icon"><Icon size={21} /></span>
            <span className="login-eyebrow">Welcome back</span>
            <h1>Sign in</h1>
            <p>Continue learning, teaching, and growing with your Skill Swap community.</p>
          </div>

          <form className="role-login-form" onSubmit={handleSubmit}>
            <label>
              I am signing in as
              <span className="role-select-wrap">
                <Icon size={17} />
                <select
                  aria-label="Choose your Skill Swap role"
                  name="role"
                  onChange={(event) => setSelectedRole(event.target.value)}
                  value={selectedRole}
                >
                  {roleOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </span>
            </label>

            <label>
              Email
              <input autoComplete="email" name="email" required type="email" placeholder="you@example.com" />
            </label>

            <label>
              Password
              <input autoComplete="current-password" name="password" required type="password" placeholder="Enter your password" />
            </label>

            <div className="login-options">
              <label className="remember-option">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <a href="#access">Forgot password?</a>
            </div>

            <button className="login-submit" type="submit">
              Sign in as {role.label}
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="login-divider"><span>secure access</span></div>
          <p className="login-helper"><LockKeyhole size={15} /> Your account role takes you to the right dashboard.</p>
          <p className="login-demo">Demo: {role.id}@skillswap.ai / {role.id}123</p>
        </div>
      </div>
    </section>
  );
}
