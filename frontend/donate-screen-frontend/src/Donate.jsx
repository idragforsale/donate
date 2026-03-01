import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "./api";

const VENUE_ID = 1;
const MAX_MSG  = 40;

const TIER_ICONS   = { 1: "🔥", 2: "🔥🔥", 3: "👑", 4: "💎" };
const EFFECT_LABEL = { none: "", glow: "✨ Glow", spotlight: "👑 Spotlight", confetti: "💎 Confetti" };

// ---- Step 4: poll queue position ----
function useQueuePoll(donationId) {
  const [info, setInfo] = useState({ status: "PENDING", queue_position: null });

  const poll = useCallback(async () => {
    if (!donationId) return;
    try {
      const r = await fetch(`${API_BASE}/donations/${donationId}`);
      const d = await r.json();
      setInfo({
        status:         d.donation?.queue_status || d.donation?.status || "PENDING",
        queue_position: d.queue_position,
      });
    } catch {}
  }, [donationId]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [poll]);

  return info;
}

// ---- Step indicator ----
function StepBar({ step }) {
  const steps = ["เลือกแพ็กเกจ", "กรอกข้อมูล", "ดูตัวอย่าง", "ส่ง Donate"];
  return (
    <div className="step-bar">
      {steps.map((label, i) => {
        const n = i + 1;
        const active    = n === step;
        const completed = n < step;
        return (
          <div key={n} className={`step-item ${active ? "step-active" : ""} ${completed ? "step-done" : ""}`}>
            <div className="step-circle">{completed ? "✓" : n}</div>
            <div className="step-label">{label}</div>
            {i < steps.length - 1 && <div className="step-line" />}
          </div>
        );
      })}
    </div>
  );
}

// ---- Preview card (simulate TV display) ----
function PreviewCard({ form, imagePreview, selectedPkg }) {
  const effect = selectedPkg?.effect || "none";
  return (
    <div className={`preview-screen effect-bg-${effect}`}>
      <div className="preview-label">ตัวอย่างบนจอ TV</div>
      <div className={`preview-img-wrap effect-img-${effect}`}>
        {imagePreview
          ? <img src={imagePreview} alt="preview" className="preview-img" />
          : <div className="preview-img-placeholder">📷</div>
        }
      </div>
      <div className={`preview-name effect-text-${effect}`}>
        {form.display_name || "ชื่อของคุณ"}
      </div>
      {form.message && <div className="preview-msg">"{form.message}"</div>}
      <div className="preview-socials">
        {form.ig     && <span className="social-tag">📸 {form.ig}</span>}
        {form.fb     && <span className="social-tag">👤 {form.fb}</span>}
        {form.tiktok && <span className="social-tag">🎵 {form.tiktok}</span>}
      </div>
      {effect !== "none" && (
        <div className="preview-effect-badge">{EFFECT_LABEL[effect]}</div>
      )}
    </div>
  );
}

// ========================================================
export default function Donate() {
  const [step,        setStep]        = useState(1);
  const [packages,    setPackages]    = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [form,        setForm]        = useState({ display_name: "", message: "", ig: "", fb: "", tiktok: "" });
  const [imageFile,   setImageFile]   = useState(null);
  const [imagePreview,setImagePreview]= useState("");
  const [donationId,  setDonationId]  = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");

  const { status, queue_position } = useQueuePoll(donationId);

  useEffect(() => {
    fetch(`${API_BASE}/packages?venue_id=${VENUE_ID}`)
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => {});
  }, []);

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function resetAll() {
    setStep(1); setSelectedPkg(null); setDonationId(null); setError("");
    setForm({ display_name: "", message: "", ig: "", fb: "", tiktok: "" });
    setImageFile(null); setImagePreview("");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res  = await fetch(`${API_BASE}/donations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue_id: VENUE_ID, package_id: selectedPkg.id, ...form }),
      });
      const data = await res.json();
      if (!data.ok) { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); setSubmitting(false); return; }

      const id = data.donation.id;
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        await fetch(`${API_BASE}/donations/${id}/upload`, { method: "POST", body: fd });
      }

      setDonationId(id);
      setStep(4);
    } catch {
      setError("ไม่สามารถเชื่อมต่อ server ได้");
    }
    setSubmitting(false);
  }

  // ===== STEP 1: Package selection =====
  if (step === 1) return (
    <div className="donate-page">
      <div className="donate-card">
        <h1>💝 Donate</h1>
        <p className="donate-subtitle">เลือกแพ็กเกจที่ต้องการ</p>
        <StepBar step={1} />
        {packages.length === 0 && <p className="empty-msg" style={{ marginTop: "1rem" }}>กำลังโหลด...</p>}
        <div className="package-grid">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              className={`pkg-card tier-${pkg.tier}`}
              onClick={() => { setSelectedPkg(pkg); setStep(2); }}
            >
              <div className="pkg-icon">{TIER_ICONS[pkg.tier] || "🔥"}</div>
              <div className="pkg-name">{pkg.name}</div>
              <div className="pkg-price">฿{pkg.price}</div>
              <div className="pkg-dur">แสดง {pkg.duration_sec} วินาที</div>
              {pkg.effect !== "none" && <div className="pkg-badge">มีเอฟเฟกต์พิเศษ</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ===== STEP 2: Fill info + upload =====
  if (step === 2) return (
    <div className="donate-page">
      <div className="donate-card">
        <button className="btn-back" onClick={() => setStep(1)}>← กลับ</button>
        <StepBar step={2} />

        <div className={`pkg-selected-bar tier-${selectedPkg.tier}`} style={{ marginTop: "1rem" }}>
          {TIER_ICONS[selectedPkg.tier]} {selectedPkg.name} · ฿{selectedPkg.price} · {selectedPkg.duration_sec} วิ
        </div>

        {error && <div className="alert alert-error">❌ {error}</div>}

        <form
          className="donate-form"
          onSubmit={(e) => { e.preventDefault(); if (form.display_name.trim()) setStep(3); }}
        >
          <div className="form-group">
            <label>รูปภาพ</label>
            <div className="upload-area" onClick={() => document.getElementById("imgInput").click()}>
              {imagePreview
                ? <img src={imagePreview} alt="preview" className="img-preview" />
                : <div className="upload-placeholder">📷 กดเพื่อเลือกรูป</div>
              }
            </div>
            <input id="imgInput" type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
          </div>

          <div className="form-group">
            <label>ชื่อที่แสดงบนจอ *</label>
            <input
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              placeholder="ชื่อ / Nickname" required maxLength={50}
            />
          </div>

          <div className="form-group">
            <label>ข้อความ ({form.message.length}/{MAX_MSG} ตัวอักษร)</label>
            <input
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value.slice(0, MAX_MSG) }))}
              placeholder="ข้อความสั้นๆ ที่อยากฝาก..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Instagram</label>
              <input value={form.ig} onChange={(e) => setForm((f) => ({ ...f, ig: e.target.value }))} placeholder="@username" />
            </div>
            <div className="form-group">
              <label>TikTok</label>
              <input value={form.tiktok} onChange={(e) => setForm((f) => ({ ...f, tiktok: e.target.value }))} placeholder="@username" />
            </div>
          </div>

          <div className="form-group">
            <label>Facebook</label>
            <input value={form.fb} onChange={(e) => setForm((f) => ({ ...f, fb: e.target.value }))} placeholder="ชื่อ Facebook" />
          </div>

          <button type="submit" className="btn-submit" disabled={!form.display_name.trim()}>
            ดูตัวอย่าง →
          </button>
        </form>
      </div>
    </div>
  );

  // ===== STEP 3: Preview =====
  if (step === 3) return (
    <div className="donate-page">
      <div className="donate-card">
        <button className="btn-back" onClick={() => setStep(2)}>← แก้ไขข้อมูล</button>
        <StepBar step={3} />

        <p className="donate-subtitle" style={{ marginTop: "1rem" }}>
          นี่คือสิ่งที่จะขึ้นบนจอ TV — ตรวจสอบให้ถูกต้องก่อนส่งนะครับ
        </p>

        <PreviewCard form={form} imagePreview={imagePreview} selectedPkg={selectedPkg} />

        <div className="preview-meta">
          <span className={`pkg-badge-sm tier-${selectedPkg.tier}`}>{selectedPkg.name}</span>
          <span>฿{selectedPkg.price}</span>
          <span>⏱ แสดง {selectedPkg.duration_sec} วินาที</span>
          {selectedPkg.effect !== "none" && (
            <span className="effect-label">{EFFECT_LABEL[selectedPkg.effect]}</span>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: "1rem" }}>❌ {error}</div>}

        <button
          className="btn-submit"
          style={{ marginTop: "1rem" }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "กำลังส่ง..." : "💝 ยืนยัน ส่ง Donate!"}
        </button>
      </div>
    </div>
  );

  // ===== STEP 4: Queue position =====
  return (
    <div className="donate-page">
      <div className="donate-card step3-card">
        <StepBar step={4} />
        <div className="step3-icon" style={{ marginTop: "1rem" }}>🎉</div>
        <h2>ส่งเรียบร้อยแล้ว!</h2>

        {status === "PLAYING" && (
          <div className="queue-status status-playing">
            <div className="status-dot-big dot-red" />
            <div>
              <div className="status-title">กำลังแสดงบนจอตอนนี้!</div>
              <div className="status-sub">คุณอยู่บนจอเลย 🔴 LIVE</div>
            </div>
          </div>
        )}
        {status === "WAITING" && queue_position !== null && (
          <div className="queue-status status-waiting">
            <div className="queue-position-num">{queue_position}</div>
            <div>
              <div className="status-title">ในคิว</div>
              <div className="status-sub">รออีก {queue_position} คิวก่อนขึ้นจอ</div>
            </div>
          </div>
        )}
        {status === "PENDING" && (
          <div className="queue-status status-pending">
            <div className="status-spinner">⏳</div>
            <div>
              <div className="status-title">รอ Admin อนุมัติ</div>
              <div className="status-sub">หน้าจอนี้จะอัปเดตอัตโนมัติ</div>
            </div>
          </div>
        )}
        {status === "QUEUED" && (
          <div className="queue-status status-waiting">
            <div className="status-spinner">✅</div>
            <div>
              <div className="status-title">อนุมัติแล้ว! อยู่ในคิว</div>
              <div className="status-sub">เดี๋ยวจะขึ้นจอ รอสักครู่นะครับ</div>
            </div>
          </div>
        )}
        {status === "DONE" && (
          <div className="queue-status status-done">
            <div>✅</div>
            <div>
              <div className="status-title">แสดงเสร็จแล้ว!</div>
              <div className="status-sub">ขอบคุณที่ Donate ครับ 🙏</div>
            </div>
          </div>
        )}

        <button className="btn-submit" onClick={resetAll} style={{ marginTop: "1.5rem" }}>
          💝 Donate อีกครั้ง
        </button>
      </div>
    </div>
  );
}
