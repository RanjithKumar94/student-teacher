import React, { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import {
  BookOpen,
  MessageCircle,
  Activity,
  FolderOpen,
  Camera,
  ChevronUp,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Send,
  Clock,
  Mic,
  X,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Pencil,
  Trophy,
  ImagePlus,
  GraduationCap,
  Users,
  Plus,
  Loader2,
  Sparkles,
  Bot,
  ClipboardList,
} from "lucide-react";

/* ---------------------------------------------------------
   TOKENS
   Chalkboard green  #2B3A32   Paper cream  #F5EFDC
   Chalk yellow       #E8B94A   Ink blue     #3B5BA5
   Marker coral       #D64545   Slate text   #3A3F38
--------------------------------------------------------- */

const QUOTES = [
  "Small steps, read daily, become big leaps.",
  "Every question you ask makes you smarter than yesterday.",
  "Mistakes are proof you're trying — keep going.",
  "Consistency beats cramming, every single time.",
  "Your effort today is tomorrow's confidence.",
];

const SEED_ASSIGNMENTS = [
  { id: "a1", subject: "Mathematics", title: "Quadratic equations — Q1 to Q10", due: "Tomorrow" },
  { id: "a2", subject: "Science", title: "Lab report: states of matter", due: "In 3 days" },
  { id: "a3", subject: "English", title: "Essay: my favourite book", due: "Friday" },
];

const SEED_THREADS = [
  {
    id: "t1",
    subject: "Physics",
    author: "Rohan",
    question: "Why does ice float on water instead of sinking?",
    comments: [{ author: "Meera", text: "I think it's less dense somehow?", teacher: false }],
  },
];

const SEED_MATERIAL = [
  { id: "m1", subject: "Mathematics", title: "Algebra Basics", teacher: "", body: "Covers linear equations, factoring, and an intro to quadratics with worked examples." },
  {
    id: "m2",
    subject: "Biology",
    title: "Cell Structure and Function",
    teacher: "",
    body: `All living things are made of cells — the basic unit of life. There are two main types: plant cells and animal cells.

Every cell has a CELL MEMBRANE, a thin outer layer that controls what enters and leaves the cell. Inside is the CYTOPLASM, a jelly-like substance where most of the cell's activities happen.

The NUCLEUS is the control centre of the cell. It contains DNA, which holds the instructions for how the cell grows, works, and reproduces.

MITOCHONDRIA are the "powerhouses" of the cell — they break down food to release energy the cell can use. Cells that need a lot of energy, like muscle cells, have many mitochondria.

Plant cells have three extra features animal cells don't have:
- A CELL WALL, a rigid outer layer that gives the cell shape and support.
- A large CENTRAL VACUOLE, which stores water and helps keep the cell firm.
- CHLOROPLASTS, which contain chlorophyll and allow the plant to make its own food through photosynthesis, using sunlight, water, and carbon dioxide to produce glucose and oxygen.

A simple way to remember the difference: plant cells are like a house with walls, a water tank, and solar panels — animal cells have none of those, just the membrane, nucleus, and mitochondria.`,
  },
];

/* ---------------- shared storage: one Firestore doc, synced live ----------------
   All students + the teacher read/write classroom/shared. onSnapshot means any
   change (a submitted assignment, a new forum post, a test score) appears on
   every open device within a second or two, no refresh needed. */
const CLASS_DOC = doc(db, "classroom", "shared");

async function ensureClassDoc() {
  const snap = await getDoc(CLASS_DOC);
  if (!snap.exists()) {
    await setDoc(CLASS_DOC, {
      assignments: SEED_ASSIGNMENTS,
      submissions: {},
      threads: SEED_THREADS,
      material: SEED_MATERIAL,
      testResults: [],
    });
  }
}

async function patchClassDoc(partial) {
  try {
    await setDoc(CLASS_DOC, partial, { merge: true });
  } catch (err) {
    console.error("Failed to save to Firestore:", err);
  }
}

/* ---------------- identity: per-device, stored locally (no login yet) ---------------- */
function loadIdentity() {
  try {
    const raw = localStorage.getItem("identity");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveIdentityLocal(value) {
  try {
    if (value) localStorage.setItem("identity", JSON.stringify(value));
    else localStorage.removeItem("identity");
  } catch {
    /* best effort */
  }
}

const MENU_ITEMS = [
  { id: "assignments", label: "Assignments", icon: BookOpen, color: "#3B5BA5" },
  { id: "corner", label: "Student's Corner", icon: MessageCircle, color: "#E8B94A" },
  { id: "activity", label: "My Activity", icon: Activity, color: "#5B8C5A" },
  { id: "material", label: "Study Material", icon: FolderOpen, color: "#B06AC7" },
  { id: "test", label: "Online Test", icon: Camera, color: "#D64545" },
];

export default function App() {
  const [booting, setBooting] = useState(true);
  const [identity, setIdentity] = useState(null); // { role: 'student'|'teacher', name }
  const [screen, setScreen] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  const [assignments, setAssignments] = useState(SEED_ASSIGNMENTS);
  const [submissions, setSubmissions] = useState({}); // key: `${assignmentId}__${studentName}`
  const [threads, setThreads] = useState(SEED_THREADS);
  const [material, setMaterial] = useState(SEED_MATERIAL);
  const [testResults, setTestResults] = useState([]); // [{ id, studentName, docId, docTitle, subject, score, total, at }]

  // identity is local to this device — loaded once, no network needed
  useEffect(() => {
    setIdentity(loadIdentity());
  }, []);

  // classroom data is shared — one Firestore doc, live-synced to every open device
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      await ensureClassDoc();
      unsub = onSnapshot(CLASS_DOC, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setAssignments(data.assignments || SEED_ASSIGNMENTS);
          setSubmissions(data.submissions || {});
          setThreads(data.threads || SEED_THREADS);
          setMaterial(data.material || SEED_MATERIAL);
          setTestResults(data.testResults || []);
        }
        setBooting(false);
      }, (err) => {
        console.error("Firestore listener error:", err);
        setBooting(false);
      });
    })();
    return () => unsub();
  }, []);

  // optimistic local update + write-through to Firestore; onSnapshot above
  // confirms it and pushes the same change to every other open device
  const updateAssignments = (next) => { setAssignments(next); patchClassDoc({ assignments: next }); };
  const updateSubmissions = (next) => { setSubmissions(next); patchClassDoc({ submissions: next }); };
  const updateThreads = (next) => { setThreads(next); patchClassDoc({ threads: next }); };
  const updateMaterial = (next) => { setMaterial(next); patchClassDoc({ material: next }); };
  const updateTestResults = (next) => { setTestResults(next); patchClassDoc({ testResults: next }); };

  const onIdentitySet = (id) => {
    setIdentity(id);
    saveIdentityLocal(id);
  };

  const switchRole = () => {
    setIdentity(null);
    saveIdentityLocal(null);
    setScreen("home");
  };

  const go = (id) => { setMenuOpen(false); setScreen(id); };

  if (booting) {
    return (
      <Frame>
        <div className="h-full w-full flex items-center justify-center bg-[#2B3A32]">
          <Loader2 size={28} className="text-[#E8B94A] animate-spin" />
        </div>
      </Frame>
    );
  }

  if (!identity) {
    return (
      <Frame>
        <RoleGate onDone={onIdentitySet} />
      </Frame>
    );
  }

  const ctx = { identity, assignments, updateAssignments, submissions, updateSubmissions, threads, updateThreads, material, updateMaterial, testResults, updateTestResults, switchRole };

  return (
    <Frame>
      {screen === "home" && <Home quote={quote} menuOpen={menuOpen} setMenuOpen={setMenuOpen} go={go} {...ctx} />}
      {screen === "assignments" && <Assignments onBack={() => go("home")} {...ctx} />}
      {screen === "corner" && <StudentCorner onBack={() => go("home")} {...ctx} />}
      {screen === "activity" && <MyActivity onBack={() => go("home")} {...ctx} />}
      {screen === "material" && <StudyMaterial onBack={() => go("home")} {...ctx} />}
      {screen === "test" && <OnlineTest onBack={() => go("home")} {...ctx} />}
    </Frame>
  );
}

/* ---------------- app shell ----------------
   Full-screen on an actual phone; shows a phone-frame mockup on desktop
   so it's easy to preview while developing. */
function Frame({ children }) {
  return (
    <div className="min-h-screen w-full bg-[#F5EFDC] sm:bg-[#20281f] sm:flex sm:items-center sm:justify-center sm:p-6 font-sans">
      <div className="relative w-full h-screen sm:w-[390px] sm:h-[820px] sm:rounded-[2.5rem] sm:border-[10px] sm:border-[#111813] sm:shadow-2xl overflow-hidden bg-[#F5EFDC]">
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#111813] rounded-b-2xl z-30" />
        <div className="w-full h-full overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- ROLE GATE ---------------- */
function RoleGate({ onDone }) {
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");

  const submit = () => {
    if (!name.trim() || !role) return;
    onDone({ role, name: name.trim() });
  };

  return (
    <div className="h-full w-full bg-[#2B3A32] chalk-texture flex flex-col justify-center px-8">
      <p className="text-[#E8B94A] font-mono text-xs tracking-widest uppercase text-center">Welcome</p>
      <h1 className="font-display text-[#F5EFDC] text-3xl leading-tight mt-1 text-center">Who's opening the app?</h1>

      <div className="flex gap-3 mt-8">
        <button
          onClick={() => setRole("student")}
          className={`flex-1 flex flex-col items-center gap-2 rounded-2xl py-5 border-2 transition-colors ${
            role === "student" ? "bg-[#E8B94A] border-[#E8B94A]" : "bg-[#F5EFDC]/5 border-[#F5EFDC]/15"
          }`}
        >
          <GraduationCap size={26} className={role === "student" ? "text-[#2B3A32]" : "text-[#F5EFDC]/70"} />
          <span className={`font-sans font-semibold text-sm ${role === "student" ? "text-[#2B3A32]" : "text-[#F5EFDC]/70"}`}>Student</span>
        </button>
        <button
          onClick={() => setRole("teacher")}
          className={`flex-1 flex flex-col items-center gap-2 rounded-2xl py-5 border-2 transition-colors ${
            role === "teacher" ? "bg-[#E8B94A] border-[#E8B94A]" : "bg-[#F5EFDC]/5 border-[#F5EFDC]/15"
          }`}
        >
          <Users size={26} className={role === "teacher" ? "text-[#2B3A32]" : "text-[#F5EFDC]/70"} />
          <span className={`font-sans font-semibold text-sm ${role === "teacher" ? "text-[#2B3A32]" : "text-[#F5EFDC]/70"}`}>Teacher</span>
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="mt-6 w-full rounded-xl bg-[#F5EFDC]/10 border border-[#F5EFDC]/20 px-4 py-3 text-[#F5EFDC] placeholder-[#F5EFDC]/40 font-sans outline-none focus:border-[#E8B94A]"
      />

      <button
        onClick={submit}
        disabled={!name.trim() || !role}
        className="mt-4 w-full bg-[#E8B94A] disabled:opacity-30 text-[#2B3A32] font-sans font-semibold py-3.5 rounded-full active:scale-[0.98] transition-transform"
      >
        Continue
      </button>
      <p className="text-center text-[#F5EFDC]/40 text-xs font-mono mt-4">
        Everyone using this link shares the same class — no password yet, this is a pilot.
      </p>
    </div>
  );
}

/* ---------------- HOME ---------------- */
function Home({ quote, menuOpen, setMenuOpen, go, identity, assignments, submissions, threads, material, switchRole }) {
  const isTeacher = identity.role === "teacher";
  const myPending = isTeacher
    ? assignments.length
    : assignments.filter((a) => {
        const s = submissions[`${a.id}__${identity.name}`];
        return !s || s.status === "pending";
      }).length;
  const waitingReview = Object.values(submissions).filter((s) => s.status === "submitted").length;

  const items = MENU_ITEMS.map((item) => {
    if (item.id === "assignments") {
      return { ...item, sub: isTeacher ? `${waitingReview} waiting review` : `${myPending} pending` };
    }
    if (item.id === "corner") return { ...item, sub: `${threads.length} doubts posted` };
    if (item.id === "material") return { ...item, sub: `${material.length} documents` };
    if (item.id === "activity") return { ...item, sub: isTeacher ? "Class overview" : "View your time" };
    if (item.id === "test") return { ...item, sub: "Coming soon" };
    return item;
  });

  return (
    <div className="relative h-full w-full bg-[#2B3A32] chalk-texture flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto" onClick={() => menuOpen && setMenuOpen(false)}>
        {!menuOpen ? (
          <div className="h-full flex flex-col rise-in">
            <div className="pt-14 px-7 flex items-start justify-between">
              <div>
                <p className="text-[#E8B94A] font-mono text-xs tracking-widest uppercase">Good morning</p>
                <h1 className="font-display text-[#F5EFDC] text-3xl leading-tight mt-1">
                  {isTeacher ? `Hi, ${identity.name}` : `Ready to learn, ${identity.name}?`}
                </h1>
              </div>
              <button onClick={(e) => { e.stopPropagation(); switchRole(); }} className="text-[10px] font-mono text-[#F5EFDC]/40 mt-2">
                switch
              </button>
            </div>
            <div className="px-7">
              <div className="mt-6 border-l-2 border-[#E8B94A] pl-4 py-1">
                <p className="font-display italic text-[#F5EFDC]/90 text-lg leading-snug">
                  {isTeacher ? `"${waitingReview} submissions are waiting for your review."` : `"${quote}"`}
                </p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center px-10">
              <div className="w-full aspect-square max-h-[260px] rounded-3xl border border-[#F5EFDC]/15 flex flex-col items-center justify-center gap-3">
                <Pencil size={40} className="text-[#E8B94A]" strokeWidth={1.5} />
                <p className="text-[#F5EFDC]/50 text-sm font-mono">{isTeacher ? "Class of 30 · pilot" : "Day 12 streak — keep it up"}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-14 px-7 pb-6 rise-in">
            <p className="text-[#E8B94A] font-mono text-xs tracking-widest uppercase">Choose where to start</p>
            <h1 className="font-display text-[#F5EFDC] text-3xl leading-tight mt-1">
              {isTeacher ? "What needs you today" : "Let's get learning"}
            </h1>
            <div className="mt-7 flex flex-col gap-3">
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={(e) => { e.stopPropagation(); go(item.id); }}
                    style={{ animationDelay: `${i * 45}ms` }}
                    className="rise-in opacity-0 flex items-center gap-4 bg-[#F5EFDC] rounded-2xl px-4 py-3 shadow-lg text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.color + "22" }}>
                      <Icon size={20} color={item.color} strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <p className="font-sans font-semibold text-[#2B3A32] text-[15px]">{item.label}</p>
                      <p className="font-mono text-[11px] text-[#2B3A32]/50">{item.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 pb-8 pt-3 flex justify-center flex-shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 bg-[#E8B94A] text-[#2B3A32] font-sans font-semibold px-8 py-4 rounded-full shadow-xl active:scale-95 transition-transform"
        >
          {menuOpen ? "Close" : isTeacher ? "Open Class Tools" : "Start Learning"}
          <ChevronUp size={18} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
    </div>
  );
}

/* ---------------- shared header ---------------- */
function ScreenHeader({ title, onBack }) {
  return (
    <div className="sticky top-0 bg-[#F5EFDC] pt-12 pb-4 px-6 flex items-center gap-3 border-b border-[#2B3A32]/10 z-10">
      <button onClick={onBack} className="p-1 -ml-1 active:opacity-60">
        <ArrowLeft size={22} className="text-[#2B3A32]" />
      </button>
      <h2 className="font-display text-xl text-[#2B3A32]">{title}</h2>
    </div>
  );
}

/* ---------------- ASSIGNMENTS ---------------- */
function Assignments({ onBack, identity, assignments, updateAssignments, submissions, updateSubmissions }) {
  const isTeacher = identity.role === "teacher";
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ subject: "", title: "", due: "" });
  const [showForm, setShowForm] = useState(false);

  const addAssignment = () => {
    if (!form.title.trim() || !form.subject.trim()) return;
    const next = [{ id: "a" + Date.now(), subject: form.subject, title: form.title, due: form.due || "This week" }, ...assignments];
    updateAssignments(next);
    setForm({ subject: "", title: "", due: "" });
    setShowForm(false);
  };

  const mySubKey = (assignmentId) => `${assignmentId}__${identity.name}`;

  const attachPhoto = (assignmentId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const key = mySubKey(assignmentId);
      const next = { ...submissions, [key]: { ...(submissions[key] || {}), photo: e.target.result, status: "pending", studentName: identity.name } };
      updateSubmissions(next);
    };
    reader.readAsDataURL(file);
  };

  const submitAssignment = (assignmentId) => {
    const key = mySubKey(assignmentId);
    const next = { ...submissions, [key]: { ...(submissions[key] || {}), status: "submitted", studentName: identity.name, submittedAt: Date.now() } };
    updateSubmissions(next);
    setOpenId(null);
  };

  const reviewSubmission = (assignmentId, studentName, decision) => {
    const key = `${assignmentId}__${studentName}`;
    const next = { ...submissions, [key]: { ...submissions[key], status: decision } };
    updateSubmissions(next);
  };

  if (isTeacher) {
    return (
      <div className="min-h-full bg-[#F5EFDC] pb-10">
        <ScreenHeader title="Assignments" onBack={onBack} />
        <div className="px-6 pt-4">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="w-full flex items-center justify-center gap-2 bg-[#3B5BA5] text-white font-sans font-semibold text-sm py-3 rounded-xl active:scale-[0.98] transition-transform"
          >
            <Plus size={16} /> New assignment
          </button>
          {showForm && (
            <div className="mt-3 bg-white rounded-2xl border border-[#2B3A32]/10 p-4 flex flex-col gap-2.5">
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" className="rounded-lg border border-[#2B3A32]/15 px-3 py-2 text-sm outline-none" />
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Assignment title" className="rounded-lg border border-[#2B3A32]/15 px-3 py-2 text-sm outline-none" />
              <input value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} placeholder="Due (e.g. Friday)" className="rounded-lg border border-[#2B3A32]/15 px-3 py-2 text-sm outline-none" />
              <button onClick={addAssignment} className="bg-[#2B3A32] text-[#F5EFDC] font-sans font-semibold text-sm py-2.5 rounded-lg active:scale-[0.98] transition-transform">Post to class</button>
            </div>
          )}
        </div>

        <div className="px-6 mt-5 flex flex-col gap-3">
          {assignments.map((a) => {
            const subs = Object.entries(submissions).filter(([k]) => k.startsWith(a.id + "__"));
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-[#2B3A32]/10 overflow-hidden">
                <button className="w-full text-left p-4" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-[#3B5BA5]">{a.subject}</p>
                  <p className="font-sans text-[15px] text-[#2B3A32] mt-1">{a.title}</p>
                  <p className="font-mono text-[11px] text-[#2B3A32]/50 mt-1">
                    Due {a.due} · {subs.filter(([, v]) => v.status === "submitted").length} waiting review
                  </p>
                </button>
                {openId === a.id && (
                  <div className="border-t border-[#2B3A32]/10 px-4 py-3 bg-[#F5EFDC]/50 flex flex-col gap-3">
                    {subs.length === 0 && <p className="text-xs font-sans text-[#2B3A32]/50">No submissions yet.</p>}
                    {subs.map(([key, v]) => (
                      <div key={key} className="flex items-center gap-3">
                        {v.photo && <img src={v.photo} className="w-12 h-12 rounded-lg object-cover border border-[#2B3A32]/15" />}
                        <div className="flex-1">
                          <p className="text-sm font-sans font-medium text-[#2B3A32]">{v.studentName}</p>
                          <p className="text-[11px] font-mono text-[#2B3A32]/50 capitalize">{v.status}</p>
                        </div>
                        {v.status === "submitted" && (
                          <div className="flex gap-1.5">
                            <button onClick={() => reviewSubmission(a.id, v.studentName, "approved")} className="bg-[#5B8C5A] text-white text-xs font-sans font-semibold px-2.5 py-1.5 rounded-lg">Approve</button>
                            <button onClick={() => reviewSubmission(a.id, v.studentName, "pending")} className="bg-[#D64545]/10 text-[#D64545] text-xs font-sans font-semibold px-2.5 py-1.5 rounded-lg">Send back</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // student view
  return (
    <div className="min-h-full bg-[#F5EFDC] pb-10">
      <ScreenHeader title="Assignments to do" onBack={onBack} />
      <div className="px-6 mt-4 flex flex-col gap-3">
        {assignments.map((a) => {
          const sub = submissions[mySubKey(a.id)];
          const status = sub?.status || "pending";
          const meta = {
            pending: { icon: Circle, color: "#2B3A32", faint: true, label: "Not submitted" },
            submitted: { icon: Clock, color: "#E8B94A", label: "Waiting for teacher review" },
            approved: { icon: CheckCircle2, color: "#5B8C5A", label: "Approved" },
          }[status];
          const StatusIcon = meta.icon;
          return (
            <div key={a.id} className="bg-white rounded-2xl border border-[#2B3A32]/10 overflow-hidden">
              <button className="w-full flex items-start gap-3 text-left p-4" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                <StatusIcon size={22} className="flex-shrink-0 mt-0.5" style={{ color: meta.faint ? "#2B3A3255" : meta.color }} />
                <div className="flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-[#3B5BA5]">{a.subject}</p>
                  <p className={`font-sans text-[15px] ${status === "approved" ? "line-through text-[#2B3A32]/40" : "text-[#2B3A32]"}`}>{a.title}</p>
                  <p className="font-mono text-[11px] text-[#2B3A32]/50 mt-1">Due {a.due} · {meta.label}</p>
                </div>
              </button>
              {openId === a.id && status === "pending" && (
                <div className="border-t border-[#2B3A32]/10 px-4 py-3.5 bg-[#F5EFDC]/50">
                  <p className="text-xs font-sans text-[#2B3A32]/60 mb-2.5">Attach a photo of your completed work for proof (optional), then submit.</p>
                  {sub?.photo ? (
                    <img src={sub.photo} className="w-24 h-24 object-cover rounded-lg border border-[#2B3A32]/15 mb-3" />
                  ) : (
                    <label className="flex items-center gap-2 w-fit text-[#3B5BA5] text-sm font-sans font-medium mb-3 cursor-pointer">
                      <ImagePlus size={16} /> Attach photo
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => attachPhoto(a.id, e.target.files?.[0])} />
                    </label>
                  )}
                  <button onClick={() => submitAssignment(a.id)} className="w-full bg-[#3B5BA5] text-white font-sans font-semibold text-sm py-2.5 rounded-xl active:scale-[0.98] transition-transform">
                    Submit assignment
                  </button>
                </div>
              )}
              {openId === a.id && status !== "pending" && sub?.photo && (
                <div className="border-t border-[#2B3A32]/10 px-4 py-3.5 bg-[#F5EFDC]/50">
                  <p className="text-xs font-sans text-[#2B3A32]/60 mb-2">Your submitted proof:</p>
                  <img src={sub.photo} className="w-24 h-24 object-cover rounded-lg border border-[#2B3A32]/15" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- STUDENT'S CORNER ---------------- */
function StudentCorner({ onBack, identity, threads, updateThreads }) {
  const isTeacher = identity.role === "teacher";
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState("");
  const [newQ, setNewQ] = useState("");

  const addComment = (id) => {
    if (!draft.trim()) return;
    const next = threads.map((t) =>
      t.id === id ? { ...t, comments: [...t.comments, { author: identity.name, text: draft, teacher: isTeacher }] } : t
    );
    updateThreads(next);
    setDraft("");
  };

  const postQuestion = () => {
    if (!newQ.trim()) return;
    const next = [{ id: "t" + Date.now(), subject: "General", author: identity.name, question: newQ, comments: [] }, ...threads];
    updateThreads(next);
    setNewQ("");
  };

  return (
    <div className="min-h-full bg-[#F5EFDC] pb-10">
      <ScreenHeader title="Student's Corner" onBack={onBack} />

      <div className="px-6 pt-5">
        <div className="bg-white rounded-2xl border border-[#2B3A32]/10 p-4">
          <p className="font-sans font-semibold text-[#2B3A32] text-[15px] mb-2.5">{isTeacher ? "Post an announcement or doubt" : "Post a new doubt"}</p>
          <textarea
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            placeholder="Type here..."
            rows={2}
            className="w-full rounded-xl border border-[#2B3A32]/15 bg-[#F5EFDC]/40 px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#3B5BA5] resize-none"
          />
          <button onClick={postQuestion} className="mt-2.5 w-full flex items-center justify-center gap-2 bg-[#3B5BA5] text-white font-sans font-semibold text-sm py-2.5 rounded-xl active:scale-[0.98] transition-transform">
            <Send size={16} /> Post
          </button>
        </div>
      </div>

      <p className="px-6 pt-6 pb-1 font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/45">{threads.length} posted</p>

      <div className="px-6 mt-2 flex flex-col gap-3">
        {threads.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-[#2B3A32]/10 overflow-hidden">
            <button className="w-full text-left p-4" onClick={() => setOpenId(openId === t.id ? null : t.id)}>
              <p className="font-mono text-[10px] uppercase tracking-wide text-[#B06AC7]">{t.subject} · {t.author}</p>
              <p className="font-sans text-[15px] text-[#2B3A32] mt-1">{t.question}</p>
              <p className="font-mono text-[11px] text-[#2B3A32]/45 mt-1.5">{t.comments.length} replies</p>
            </button>
            {openId === t.id && (
              <div className="border-t border-[#2B3A32]/10 px-4 py-3 bg-[#F5EFDC]/60 flex flex-col gap-2.5">
                {t.comments.map((c, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${c.teacher ? "bg-[#E8B94A] text-[#2B3A32]" : "bg-[#2B3A32]/10 text-[#2B3A32]/70"}`}>{c.author}</div>
                    <p className="text-sm font-sans text-[#2B3A32]/85 flex-1">{c.text}</p>
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a reply..." className="flex-1 rounded-lg border border-[#2B3A32]/15 bg-white px-3 py-2 text-sm outline-none" />
                  <button onClick={() => addComment(t.id)} className="text-[#3B5BA5] active:scale-95 transition-transform"><Send size={17} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- STUDY MATERIAL ---------------- */
function StudyMaterial({ onBack, identity, material, updateMaterial, testResults, updateTestResults }) {
  const isTeacher = identity.role === "teacher";
  const [view, setView] = useState("list"); // 'list' | 'doc' | 'tutor' | 'test'
  const [openDoc, setOpenDoc] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", title: "", body: "" });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("en");
  const scrollRef = useRef(null);

  // English + the 22 scheduled languages of India. Every value here MUST be
  // present so the tutor's instruction never contains "undefined".
  const LANGUAGES = [
    { code: "en", native: "English", instruction: "in English" },
    { code: "hi", native: "हिन्दी", instruction: "in Hindi (हिन्दी), using Devanagari script throughout" },
    { code: "bn", native: "বাংলা", instruction: "in Bengali (বাংলা), using Bengali script throughout" },
    { code: "te", native: "తెలుగు", instruction: "in Telugu (తెలుగు), using Telugu script throughout" },
    { code: "mr", native: "मराठी", instruction: "in Marathi (मराठी), using Devanagari script throughout" },
    { code: "ta", native: "தமிழ்", instruction: "in Tamil (தமிழ்), using Tamil script throughout" },
    { code: "gu", native: "ગુજરાતી", instruction: "in Gujarati (ગુજરાતી), using Gujarati script throughout" },
    { code: "ur", native: "اردو", instruction: "in Urdu (اردو), using Urdu/Nastaliq script throughout" },
    { code: "kn", native: "ಕನ್ನಡ", instruction: "in Kannada (ಕನ್ನಡ), using Kannada script throughout" },
    { code: "or", native: "ଓଡ଼ିଆ", instruction: "in Odia (ଓଡ଼ିଆ), using Odia script throughout" },
    { code: "ml", native: "മലയാളം", instruction: "in Malayalam (മലയാളം), using Malayalam script throughout" },
    { code: "pa", native: "ਪੰਜਾਬੀ", instruction: "in Punjabi (ਪੰਜਾਬੀ), using Gurmukhi script throughout" },
    { code: "as", native: "অসমীয়া", instruction: "in Assamese (অসমীয়া), using Assamese script throughout" },
    { code: "mai", native: "मैथिली", instruction: "in Maithili (मैथिली), using Devanagari script throughout" },
    { code: "sa", native: "संस्कृतम्", instruction: "in Sanskrit (संस्कृतम्), using Devanagari script throughout" },
    { code: "ne", native: "नेपाली", instruction: "in Nepali (नेपाली), using Devanagari script throughout" },
    { code: "ks", native: "کٲشُر", instruction: "in Kashmiri (کٲشُر), using its standard script throughout" },
    { code: "kok", native: "कोंकणी", instruction: "in Konkani (कोंकणी), using Devanagari script throughout" },
    { code: "sd", native: "سنڌي", instruction: "in Sindhi (سنڌي), using its standard script throughout" },
    { code: "doi", native: "डोगरी", instruction: "in Dogri (डोगरी), using Devanagari script throughout" },
    { code: "mni", native: "মৈতৈলোন্", instruction: "in Manipuri/Meitei (মৈতৈলোন্), using Meitei script throughout" },
    { code: "brx", native: "बड़ो", instruction: "in Bodo (बड़ो), using Devanagari script throughout" },
    { code: "sat", native: "ᱥᱟᱱᱛᱟᱲᱤ", instruction: "in Santali (ᱥᱟᱱᱛᱟᱲᱤ), using Ol Chiki script throughout" },
  ];
  const currentLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const addMaterial = () => {
    if (!form.title.trim()) return;
    const next = [{ id: "m" + Date.now(), subject: form.subject || "General", title: form.title, teacher: identity.name, body: form.body }, ...material];
    updateMaterial(next);
    setForm({ subject: "", title: "", body: "" });
    setShowForm(false);
  };

  const openDocument = (d) => {
    setOpenDoc(d);
    setMessages([]);
    setQuiz(null);
    setQuizError(null);
    setQuizSubmitted(false);
    setView("doc");
  };

  const ask = async () => {
    const question = input.trim();
    if (!question || loading) return;
    const nextMessages = [...messages, { role: "user", text: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      // ⚠️ NOTE FOR DEPLOYMENT: this calls api.anthropic.com directly from
      // the browser, which only works inside Claude's own artifact preview
      // (it injects a key for you there). Once deployed for real, this call
      // will fail — see the "AI Tutor in production" section of README.md
      // for how to route it through a small backend function instead.
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `You are a patient, encouraging AI tutor helping a student named ${identity.name} understand a specific piece of study material titled "${openDoc.title}" (${openDoc.subject}). Teach only from the material below — don't go beyond it unless asked to relate it to something. Explain simply, use small examples, and occasionally check understanding with a short question. Keep answers brief and appropriate for a school student.\n\nIMPORTANT: Reply ${currentLang.instruction}, regardless of what language the material below is written in or what language the student's question uses. Do not ask the student what language they want — always answer directly in that language.\n\nMATERIAL:\n${openDoc.body}`,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.type === "error") {
        const errMsg = data?.error?.message || `Request failed (status ${response.status})`;
        setMessages((cur) => [...cur, { role: "assistant", text: `⚠️ Tutor error: ${errMsg}` }]);
        return;
      }
      const text = (data.content || []).map((b) => b.text || "").join("\n").trim();
      setMessages((cur) => [...cur, { role: "assistant", text: text || "⚠️ The tutor returned an empty response — try rephrasing your question." }]);
    } catch (err) {
      setMessages((cur) => [...cur, { role: "assistant", text: `⚠️ Couldn't reach the tutor: ${err.message || "network error"}. Check your connection and try again.` }]);
    } finally {
      setLoading(false);
    }
  };

  /* ---- MOCK TEST ---- */
  const [quiz, setQuiz] = useState(null); // { questions: [...] }
  const [quizError, setQuizError] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [answers, setAnswers] = useState([]); // selected option index per question, null if unanswered
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const generateQuiz = async () => {
    setQuizLoading(true);
    setQuizError(null);
    setQuiz(null);
    setQuizSubmitted(false);
    try {
      // ⚠️ Same deployment note as the tutor above — see README.md.
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: `You create short mock tests for school students based only on the study material given to you. Generate exactly 5 multiple-choice questions that test understanding of the material below — don't introduce facts that aren't in it. Each question must have exactly 4 options with exactly one correct answer, plus a short one-sentence explanation of why that answer is correct.\n\nWrite every question, option, and explanation ${currentLang.instruction}.\n\nReply with ONLY valid JSON, no markdown code fences, no extra text before or after, in exactly this shape:\n{"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}\n\nMATERIAL (${openDoc.title} — ${openDoc.subject}):\n${openDoc.body}`,
          messages: [{ role: "user", content: "Generate the mock test now." }],
        }),
      });
      const data = await response.json();
      if (!response.ok || data.type === "error") {
        setQuizError(data?.error?.message || `Request failed (status ${response.status})`);
        return;
      }
      const raw = (data.content || []).map((b) => b.text || "").join("").trim();
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.questions || !parsed.questions.length) throw new Error("No questions were generated.");
      setQuiz(parsed);
      setAnswers(new Array(parsed.questions.length).fill(null));
    } catch (err) {
      setQuizError(err.message?.includes("JSON") ? "The tutor's response wasn't in the expected format — try generating again." : (err.message || "Something went wrong generating the test."));
    } finally {
      setQuizLoading(false);
    }
  };

  const selectAnswer = (qIndex, optIndex) => {
    if (quizSubmitted) return;
    setAnswers((cur) => cur.map((a, i) => (i === qIndex ? optIndex : a)));
  };

  const score = quiz ? answers.reduce((s, a, i) => (a === quiz.questions[i].correctIndex ? s + 1 : s), 0) : 0;
  const allAnswered = quiz ? answers.every((a) => a !== null) : false;

  const submitTest = () => {
    setQuizSubmitted(true);
    const record = {
      id: "r" + Date.now(),
      studentName: identity.name,
      docId: openDoc.id,
      docTitle: openDoc.title,
      subject: openDoc.subject,
      score,
      total: quiz.questions.length,
      at: Date.now(),
    };
    updateTestResults([record, ...testResults]);
  };


  if (view === "tutor") {
    return (
      <div className="h-full bg-[#F5EFDC] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-12 pb-3 border-b border-[#2B3A32]/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#3B5BA5]/10 flex items-center justify-center"><Sparkles size={15} className="text-[#3B5BA5]" /></div>
            <div>
              <p className="font-sans font-semibold text-[#2B3A32] text-sm leading-tight">AI Tutor</p>
              <p className="font-mono text-[10px] text-[#2B3A32]/45 leading-tight">{openDoc.title}</p>
            </div>
          </div>
          <button onClick={() => setView("doc")} className="w-8 h-8 rounded-full bg-[#2B3A32]/5 flex items-center justify-center active:scale-90 transition-transform">
            <X size={17} className="text-[#2B3A32]/70" />
          </button>
        </div>

        <div className="px-5 pt-3 flex-shrink-0">
          <label className="flex items-center gap-2 bg-[#2B3A32]/5 rounded-xl px-3 py-2 w-fit">
            <span className="text-xs font-mono text-[#2B3A32]/45">Answer in</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-transparent text-sm font-sans font-medium text-[#2B3A32] outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.native}</option>
              ))}
            </select>
          </label>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-4">
          {messages.length === 0 && (
            <div className="flex items-start gap-2 bg-[#3B5BA5]/8 rounded-xl p-3">
              <Bot size={16} className="text-[#3B5BA5] flex-shrink-0 mt-0.5" />
              <p className="text-sm font-sans text-[#2B3A32]/75">Ask me anything about "{openDoc.title}" — I'll teach only from this material.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm font-sans ${m.role === "user" ? "self-end bg-[#2B3A32] text-[#F5EFDC]" : "self-start bg-white border border-[#2B3A32]/10 text-[#2B3A32]"}`}>
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="self-start flex items-center gap-2 bg-white border border-[#2B3A32]/10 rounded-xl px-3 py-2">
              <Loader2 size={14} className="animate-spin text-[#3B5BA5]" />
              <span className="text-xs font-mono text-[#2B3A32]/50">thinking...</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-8 pt-2 flex-shrink-0 border-t border-[#2B3A32]/10">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask a question..."
            className="flex-1 rounded-xl border border-[#2B3A32]/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#3B5BA5]"
          />
          <button onClick={ask} disabled={loading} className="bg-[#3B5BA5] disabled:opacity-40 text-white rounded-xl px-3.5 active:scale-95 transition-transform">
            <Send size={17} />
          </button>
        </div>
      </div>
    );
  }

  /* ---- SINGLE DOCUMENT — full screen, normal flow ---- */
  if (view === "doc") {
    return (
      <div className="min-h-full bg-[#F5EFDC] pb-24 flex flex-col">
        <ScreenHeader title={openDoc.subject} onBack={() => setView("list")} />
        <div className="px-6 pt-4 flex-1">
          <h3 className="font-display text-2xl text-[#2B3A32]">{openDoc.title}</h3>
          <p className="font-sans text-sm text-[#2B3A32]/80 mt-3 leading-relaxed">{openDoc.body}</p>
        </div>
        <div className="px-6 pt-4 flex-shrink-0 flex flex-col gap-2.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/40 mb-0.5">Need help with this?</p>
          <button
            onClick={() => setView("tutor")}
            className="w-full flex items-center justify-center gap-2 bg-[#3B5BA5] text-white font-sans text-[15px] font-semibold py-3.5 rounded-full shadow-lg active:scale-95 transition-transform"
          >
            <span className="text-base">👋</span> Ask the AI Tutor
          </button>
          <button
            onClick={() => { setView("test"); if (!quiz) generateQuiz(); }}
            className="w-full flex items-center justify-center gap-2 bg-[#2B3A32] text-white font-sans text-[15px] font-semibold py-3.5 rounded-full shadow-lg active:scale-95 transition-transform"
          >
            <ClipboardList size={17} /> Take a Mock Test
          </button>
        </div>
      </div>
    );
  }

  /* ---- MOCK TEST — full screen, normal flow ---- */
  if (view === "test") {
    return (
      <div className="min-h-full bg-[#F5EFDC] pb-10 flex flex-col">
        <ScreenHeader title={`Mock Test · ${openDoc.title}`} onBack={() => setView("doc")} />

        {!quizSubmitted && (
          <div className="px-6 pt-4 flex-shrink-0">
            <label className="flex items-center gap-2 bg-white border border-[#2B3A32]/10 rounded-xl px-3 py-2 w-fit">
              <span className="text-xs font-mono text-[#2B3A32]/45">Language</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="bg-transparent text-sm font-sans font-medium text-[#2B3A32] outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.native}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {quizLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <Loader2 size={26} className="text-[#3B5BA5] animate-spin" />
            <p className="text-sm font-sans text-[#2B3A32]/60">Building your test from "{openDoc.title}"...</p>
          </div>
        )}

        {!quizLoading && quizError && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <AlertTriangle size={26} className="text-[#D64545]" />
            <p className="text-sm font-sans text-[#2B3A32]/70">{quizError}</p>
            <button onClick={generateQuiz} className="mt-2 bg-[#3B5BA5] text-white font-sans font-semibold text-sm px-5 py-2.5 rounded-full active:scale-95 transition-transform">
              Try again
            </button>
          </div>
        )}

        {!quizLoading && !quizError && quiz && !quizSubmitted && (
          <div className="px-6 pt-4 flex flex-col gap-5">
            {quiz.questions.map((q, qi) => (
              <div key={qi} className="bg-white rounded-2xl border border-[#2B3A32]/10 p-4">
                <p className="font-mono text-[10px] uppercase text-[#2B3A32]/40">Question {qi + 1} of {quiz.questions.length}</p>
                <p className="font-sans font-medium text-[#2B3A32] text-[15px] mt-1">{q.question}</p>
                <div className="flex flex-col gap-2 mt-3">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(qi, oi)}
                      className={`text-left rounded-xl px-3.5 py-2.5 text-sm font-sans border transition-colors ${
                        answers[qi] === oi ? "bg-[#3B5BA5] border-[#3B5BA5] text-white" : "bg-[#F5EFDC]/60 border-[#2B3A32]/10 text-[#2B3A32]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={submitTest}
              disabled={!allAnswered}
              className="w-full bg-[#2B3A32] disabled:opacity-30 text-[#F5EFDC] font-sans font-semibold py-3.5 rounded-full active:scale-[0.98] transition-transform"
            >
              {allAnswered ? "Submit test" : `Answer all ${quiz.questions.length} questions to submit`}
            </button>
          </div>
        )}

        {!quizLoading && quiz && quizSubmitted && (
          <div className="px-6 pt-4 flex flex-col gap-4">
            <div className="bg-[#2B3A32] rounded-2xl p-5 text-center">
              <p className="font-mono text-[10px] uppercase tracking-wide text-[#E8B94A]">Your score</p>
              <p className="font-display text-4xl text-[#F5EFDC] mt-1">{score} / {quiz.questions.length}</p>
            </div>
            {quiz.questions.map((q, qi) => {
              const correct = answers[qi] === q.correctIndex;
              return (
                <div key={qi} className="bg-white rounded-2xl border border-[#2B3A32]/10 p-4">
                  <div className="flex items-start gap-2">
                    {correct ? <CheckCircle2 size={18} className="text-[#5B8C5A] flex-shrink-0 mt-0.5" /> : <X size={18} className="text-[#D64545] flex-shrink-0 mt-0.5" />}
                    <p className="font-sans font-medium text-[#2B3A32] text-[15px]">{q.question}</p>
                  </div>
                  <p className="text-sm font-sans text-[#2B3A32]/70 mt-2 ml-6">
                    Correct answer: <span className="font-semibold text-[#2B3A32]">{q.options[q.correctIndex]}</span>
                  </p>
                  <p className="text-xs font-sans text-[#2B3A32]/55 mt-1 ml-6 leading-relaxed">{q.explanation}</p>
                </div>
              );
            })}
            <button onClick={generateQuiz} className="w-full bg-[#3B5BA5] text-white font-sans font-semibold py-3.5 rounded-full active:scale-[0.98] transition-transform">
              Generate a new test
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ---- LIST — default view ---- */
  return (
    <div className="min-h-full bg-[#F5EFDC] pb-10">
      <ScreenHeader title="Study Material" onBack={onBack} />

      {isTeacher && (
        <div className="px-6 pt-4">
          <button onClick={() => setShowForm((v) => !v)} className="w-full flex items-center justify-center gap-2 bg-[#3B5BA5] text-white font-sans font-semibold text-sm py-3 rounded-xl active:scale-[0.98] transition-transform">
            <Plus size={16} /> Add study material
          </button>
          {showForm && (
            <div className="mt-3 bg-white rounded-2xl border border-[#2B3A32]/10 p-4 flex flex-col gap-2.5">
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" className="rounded-lg border border-[#2B3A32]/15 px-3 py-2 text-sm outline-none" />
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded-lg border border-[#2B3A32]/15 px-3 py-2 text-sm outline-none" />
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Paste the material's content here (this is what the AI tutor will teach from)" rows={4} className="rounded-lg border border-[#2B3A32]/15 px-3 py-2 text-sm outline-none resize-none" />
              <button onClick={addMaterial} className="bg-[#2B3A32] text-[#F5EFDC] font-sans font-semibold text-sm py-2.5 rounded-lg active:scale-[0.98] transition-transform">Share with class</button>
            </div>
          )}
        </div>
      )}

      <div className="px-6 mt-4 flex flex-col gap-3">
        {material.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl border border-[#2B3A32]/10 p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#3B5BA5]/10 flex items-center justify-center flex-shrink-0"><FileText size={18} className="text-[#3B5BA5]" /></div>
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/45">{d.subject}{d.teacher ? ` · ${d.teacher}` : ""}</p>
              <p className="font-sans font-semibold text-[#2B3A32] text-[15px] mt-0.5">{d.title}</p>
              <button onClick={() => openDocument(d)} className="text-[#3B5BA5] text-sm font-sans font-medium mt-1.5">View document</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- MY ACTIVITY ---------------- */
function MyActivity({ onBack, identity, assignments, submissions, testResults }) {
  const isTeacher = identity.role === "teacher";

  if (isTeacher) {
    const total = assignments.length;
    const approved = Object.values(submissions).filter((s) => s.status === "approved").length;
    const submitted = Object.values(submissions).filter((s) => s.status === "submitted").length;

    // Sample data — real detection needs native screen-time permissions, planned post-pilot.
    const lateNightFlags = [
      { name: "Rohan", window: "11:40 PM – 1:15 AM" },
      { name: "Ishaan", window: "12:20 AM – 2:00 AM" },
    ];

    return (
      <div className="min-h-full bg-[#F5EFDC] pb-10">
        <ScreenHeader title="Class Overview" onBack={onBack} />

        <div className="px-6 pt-5">
          <div className="rounded-2xl bg-[#D64545]/10 border border-[#D64545]/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-[#D64545]" />
              <p className="font-sans font-semibold text-[#2B3A32] text-sm">Late-night phone activity</p>
            </div>
            <p className="font-sans text-xs text-[#2B3A32]/60 leading-relaxed mb-3">
              Flagged when a student's phone was active between 10 PM–5 AM. This shows the device was in use, not confirmed sleep loss — worth a gentle check-in, not an assumption.
            </p>
            {lateNightFlags.length === 0 ? (
              <p className="text-xs font-sans text-[#2B3A32]/50">No flags this week.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {lateNightFlags.map((f) => (
                  <div key={f.name} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5">
                    <span className="font-sans text-sm font-medium text-[#2B3A32]">{f.name}</span>
                    <span className="font-mono text-[11px] text-[#D64545]">{f.window}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pt-5 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-[#2B3A32]/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/45">Assignments posted</p>
            <p className="font-display text-2xl text-[#2B3A32] mt-1">{total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#2B3A32]/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/45">Waiting for your review</p>
            <p className="font-display text-2xl text-[#E8B94A] mt-1">{submitted}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#2B3A32]/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/45">Approved this term</p>
            <p className="font-display text-2xl text-[#5B8C5A] mt-1">{approved}</p>
          </div>
        </div>

        <div className="px-6 pt-6">
          <p className="font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/45 mb-3">Mock test scores</p>
          {testResults.length === 0 ? (
            <p className="text-sm font-sans text-[#2B3A32]/50">No mock tests taken yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {testResults.map((r) => {
                const pct = Math.round((r.score / r.total) * 100);
                const color = pct >= 70 ? "#5B8C5A" : pct >= 40 ? "#E8B94A" : "#D64545";
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-[#2B3A32]/10 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-sans font-semibold text-[#2B3A32] text-sm">{r.studentName}</p>
                      <p className="font-mono text-[11px] text-[#2B3A32]/45 mt-0.5">{r.subject} · {r.docTitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg" style={{ color }}>{r.score}/{r.total}</p>
                      <p className="font-mono text-[10px] text-[#2B3A32]/40">{new Date(r.at).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <p className="px-6 mt-6 text-xs font-sans text-[#2B3A32]/50 leading-relaxed">
          The late-night panel above uses sample data to show the concept — real per-student tracking needs native phone permissions we'll add once this stage proves out.
        </p>
      </div>
    );
  }

  const learningApps = [
    { name: "Assignments", minutes: 42, color: "#3B5BA5" },
    { name: "Study Material", minutes: 28, color: "#B06AC7" },
    { name: "Student's Corner", minutes: 15, color: "#E8B94A" },
  ];
  const otherApps = { name: "Other apps", minutes: 106, color: "#5B8C5A" };
  const learningMax = Math.max(...learningApps.map((a) => a.minutes));
  const learningTotal = learningApps.reduce((s, a) => s + a.minutes, 0);
  const total = learningTotal + otherApps.minutes;

  const myResults = testResults.filter((r) => r.studentName === identity.name);

  return (
    <div className="min-h-full bg-[#F5EFDC] pb-10">
      <ScreenHeader title="My Activity" onBack={onBack} />

      <div className="px-6 pt-5">
        <div className="rounded-2xl bg-[#2B3A32] p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8B94A]/15 flex items-center justify-center flex-shrink-0"><Trophy size={20} className="text-[#E8B94A]" /></div>
          <div>
            <p className="font-sans font-semibold text-[#F5EFDC] text-[15px]">You're this week's Student of the Week 🎉</p>
            <p className="font-sans text-xs text-[#F5EFDC]/65 mt-1 leading-relaxed">Based on assignments completed on time, doubts asked & answered, and a 5-day streak — not on how long you're in the app.</p>
          </div>
        </div>
      </div>

      {myResults.length > 0 && (
        <div className="px-6 pt-5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/45 mb-3">Your recent test scores</p>
          <div className="flex flex-col gap-2.5">
            {myResults.map((r) => {
              const pct = Math.round((r.score / r.total) * 100);
              const color = pct >= 70 ? "#5B8C5A" : pct >= 40 ? "#E8B94A" : "#D64545";
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-[#2B3A32]/10 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-sans font-semibold text-[#2B3A32] text-sm">{r.docTitle}</p>
                    <p className="font-mono text-[11px] text-[#2B3A32]/45 mt-0.5">{r.subject}</p>
                  </div>
                  <p className="font-display text-lg" style={{ color }}>{r.score}/{r.total}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-6 pt-5">
        <p className="font-mono text-xs text-[#2B3A32]/50">Today's screen time (sample data)</p>
        <p className="font-display text-3xl text-[#2B3A32]">{Math.floor(total / 60)}h {total % 60}m</p>
      </div>

      <div className="px-6 mt-6">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/45 mb-3">Learning · {Math.floor(learningTotal / 60)}h {learningTotal % 60}m</p>
        <div className="flex flex-col gap-4">
          {learningApps.map((a) => (
            <div key={a.name}>
              <div className="flex justify-between text-sm font-sans text-[#2B3A32] mb-1"><span>{a.name}</span><span className="font-mono text-[#2B3A32]/60">{a.minutes}m</span></div>
              <div className="w-full h-2.5 rounded-full bg-[#2B3A32]/8"><div className="h-full rounded-full" style={{ width: `${(a.minutes / learningMax) * 100}%`, backgroundColor: a.color }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 mt-7">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[#2B3A32]/45 mb-3">Rest of the day · {Math.floor(otherApps.minutes / 60)}h {otherApps.minutes % 60}m</p>
        <div>
          <div className="flex justify-between text-sm font-sans text-[#2B3A32] mb-1"><span>{otherApps.name}</span><span className="font-mono text-[#2B3A32]/60">{Math.floor(otherApps.minutes / 60)}h {otherApps.minutes % 60}m</span></div>
          <div className="w-full h-2.5 rounded-full bg-[#2B3A32]/8"><div className="h-full rounded-full" style={{ width: "100%", backgroundColor: otherApps.color }} /></div>
        </div>
      </div>
      <p className="px-6 mt-6 text-xs font-sans text-[#2B3A32]/50 leading-relaxed">
        This screen still uses sample numbers — real per-app tracking needs native phone permissions, planned for after the pilot.
      </p>
    </div>
  );
}

/* ---------------- ONLINE TEST (not part of pilot yet) ---------------- */
function OnlineTest({ onBack }) {
  return (
    <div className="min-h-full bg-[#2B3A32] flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#F5EFDC]/10 flex items-center justify-center mb-5">
        <Camera size={28} className="text-[#E8B94A]" />
      </div>
      <h3 className="font-display text-xl text-[#F5EFDC]">Coming soon</h3>
      <p className="font-sans text-sm text-[#F5EFDC]/70 mt-2 leading-relaxed">
        Live-monitored online tests are planned for after the pilot, once assignments and the forum are proven out.
      </p>
      <button onClick={onBack} className="mt-6 bg-[#E8B94A] text-[#2B3A32] font-sans font-semibold px-6 py-3 rounded-full active:scale-95 transition-transform">Back to home</button>
    </div>
  );
}
