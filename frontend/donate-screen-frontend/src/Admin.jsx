import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "./api";

const VENUE_ID = 1;
const POLL_MS  = 3000;

function resolveImg(url) {
  if (!url) return "https://dummyimage.com/80x80/333/fff&text=?";
  return url.startsWith("/uploads/") ? `${API_BASE}${url}` : url;
}

const EFFECT_LABEL = { none: "", glow: "✨ Glow", spotlight: "👑 Spotlight", confetti: "💎 Confetti" };

const STATUS_LABEL = {
  PENDING:  { text: "รออนุมัติ", cls: "status-tag-pending"  },
  QUEUED:   { text: "ในคิว",     cls: "status-tag-queued"   },
  PLAYING:  { text: "กำลังเล่น", cls: "status-tag-playing"  },
  DONE:     { text: "เสร็จแล้ว", cls: "status-tag-done"     },
  REJECTED: { text: "ปฏิเสธ",   cls: "status-tag-rejected" },
};

function fmtDate(str) {
  if (!str) return "-";
  const d = new Date(str);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short" })
    + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function Admin() {
  const [tab,          setTab]         = useState("pending");
  const [pending,      setPending]     = useState([]);
  const [queue,        setQueue]       = useState([]);
  const [now,          setNow]         = useState(null);
  const [revenue,      setRevenue]     = useState(null);
  const [history,      setHistory]     = useState([]);
  const [loading,      setLoading]     = useState(false);
  const [autoApprove,  setAutoApprove] = useState(false);
  const [settingsSaved,setSettingsSaved]= useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [pendingRes, displayRes] = await Promise.all([
        fetch(`${API_BASE}/donations?venue_id=${VENUE_ID}&status=PENDING`).then((r) => r.json()),
        fetch(`${API_BASE}/queue?venue_id=${VENUE_ID}`).then((r) => r.json()),
      ]);
      setPending(pendingRes.donations || []);
      setNow(displayRes.now || null);
      setQueue(displayRes.next || []);
    } catch {}
  }, []);

  const fetchRevenue = useCallback(async () => {
    try {
      const d = await fetch(`${API_BASE}/admin/revenue?venue_id=${VENUE_ID}`).then((r) => r.json());
      setRevenue(d);
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const d = await fetch(`${API_BASE}/donations?venue_id=${VENUE_ID}&status=ALL&limit=100`).then((r) => r.json());
      setHistory(d.donations || []);
    } catch {}
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const d = await fetch(`${API_BASE}/admin/settings?venue_id=${VENUE_ID}`).then((r) => r.json());
      setAutoApprove(d.settings?.autoApprove ?? false);
    } catch {}
  }, []);

  async function saveAutoApprove(val) {
    setAutoApprove(val);
    await fetch(`${API_BASE}/admin/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venue_id: VENUE_ID, autoApprove: val }),
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (tab === "revenue") fetchRevenue();
    if (tab === "history") fetchHistory();
  }, [tab, fetchRevenue, fetchHistory]);

  async function approve(donation) {
    setLoading(true);
    await fetch(`${API_BASE}/queue/approveById`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: donation.id, venue_id: VENUE_ID }),
    });
    await fetchAll();
    setLoading(false);
  }

  async function reject(donation) {
    setLoading(true);
    await fetch(`${API_BASE}/donations/${donation.id}`, { method: "DELETE" });
    await fetchAll();
    setLoading(false);
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <span className="admin-badge">Venue {VENUE_ID}</span>
        {now && <span className="admin-badge live-badge">🔴 LIVE: {now.display_name}</span>}
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`tab-btn ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
          รออนุมัติ {pending.length > 0 && <span className="tab-count">{pending.length}</span>}
        </button>
        <button className={`tab-btn ${tab === "queue" ? "active" : ""}`} onClick={() => setTab("queue")}>
          คิว {queue.length > 0 && <span className="tab-count">{queue.length}</span>}
        </button>
        <button className={`tab-btn ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          ประวัติ
        </button>
        <button className={`tab-btn ${tab === "revenue"  ? "active" : ""}`} onClick={() => setTab("revenue")}>
          รายได้
        </button>
        <button className={`tab-btn ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
          ⚙️ ตั้งค่า
        </button>
      </div>

      {/* ====== TAB: PENDING ====== */}
      {tab === "pending" && (
        <div className="admin-content">
          {pending.length === 0 ? (
            <p className="empty-msg">ไม่มีรายการรออนุมัติ 🎉</p>
          ) : (
            pending.map((d) => (
              <div key={d.id} className="admin-card pending-card">
                <div className="card-top">
                  <img src={resolveImg(d.image_url)} alt={d.display_name} className="card-thumb"
                    onError={(e) => { e.target.src = "https://dummyimage.com/80x80/333/fff&text=?"; }} />
                  <div className="card-info">
                    <div className="card-name">{d.display_name}</div>
                    {d.message && <div className="card-msg">"{d.message}"</div>}
                    <div className="card-socials">
                      {d.ig     && <span>📸 {d.ig}</span>}
                      {d.fb     && <span>👤 {d.fb}</span>}
                      {d.tiktok && <span>🎵 {d.tiktok}</span>}
                    </div>
                    <div className="card-meta">
                      <span className={`pkg-badge-sm tier-${d.tier}`}>{d.package_name}</span>
                      <span>฿{d.amount}</span>
                      <span>⏱ {d.duration_sec} วิ</span>
                      {d.effect !== "none" && <span className="effect-label">{EFFECT_LABEL[d.effect]}</span>}
                      <span className="card-time">{fmtDate(d.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="card-actions">
                  <button className="btn-approve" onClick={() => approve(d)} disabled={loading}>✅ Approve</button>
                  <button className="btn-reject"  onClick={() => reject(d)}  disabled={loading}>❌ Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ====== TAB: QUEUE ====== */}
      {tab === "queue" && (
        <div className="admin-content">
          <h3 className="section-label">Now Playing</h3>
          {now ? (
            <div className="admin-card now-card">
              <img src={resolveImg(now.image_url)} alt={now.display_name} className="card-thumb"
                onError={(e) => { e.target.src = "https://dummyimage.com/80x80/333/fff&text=?"; }} />
              <div className="card-info">
                <div className="card-name">{now.display_name}</div>
                {now.message && <div className="card-msg">"{now.message}"</div>}
                <div className="card-meta">
                  <span className={`pkg-badge-sm tier-${now.tier}`}>{now.package_name}</span>
                  <span>⏱ {now.duration_sec} วิ</span>
                  {now.effect !== "none" && <span className="effect-label">{EFFECT_LABEL[now.effect]}</span>}
                </div>
              </div>
            </div>
          ) : (
            <p className="empty-msg">ว่างอยู่</p>
          )}

          <h3 className="section-label" style={{ marginTop: "1.5rem" }}>คิวถัดไป ({queue.length})</h3>
          {queue.length === 0 ? (
            <p className="empty-msg">ไม่มีในคิว</p>
          ) : (
            queue.map((d, i) => (
              <div key={d.id} className="admin-card queue-card">
                <span className="queue-num">#{i + 1}</span>
                <img src={resolveImg(d.image_url)} alt={d.display_name} className="card-thumb-sm"
                  onError={(e) => { e.target.src = "https://dummyimage.com/60x60/333/fff&text=?"; }} />
                <div className="card-info">
                  <div className="card-name">{d.display_name}</div>
                  <div className="card-meta">
                    <span className={`pkg-badge-sm tier-${d.tier}`}>{d.package_name}</span>
                    <span>⏱ {d.duration_sec} วิ</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ====== TAB: HISTORY ====== */}
      {tab === "history" && (
        <div className="admin-content">
          <div className="history-toolbar">
            <span className="section-label">ประวัติทั้งหมด ({history.length} รายการ)</span>
            <button className="btn-refresh" onClick={fetchHistory}>🔄 รีเฟรช</button>
          </div>

          {history.length === 0 ? (
            <p className="empty-msg">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>รูป</th>
                    <th>ชื่อ</th>
                    <th>ข้อความ</th>
                    <th>แพ็กเกจ</th>
                    <th>ยอด</th>
                    <th>สถานะ</th>
                    <th>เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((d) => {
                    const st = STATUS_LABEL[d.status] || { text: d.status, cls: "" };
                    return (
                      <tr key={d.id}>
                        <td>
                          <img src={resolveImg(d.image_url)} alt={d.display_name} className="history-thumb"
                            onError={(e) => { e.target.src = "https://dummyimage.com/40x40/333/fff&text=?"; }} />
                        </td>
                        <td>
                          <div className="history-name">{d.display_name}</div>
                          <div className="history-social">
                            {d.ig && <span>📸{d.ig}</span>}
                            {d.fb && <span>👤{d.fb}</span>}
                            {d.tiktok && <span>🎵{d.tiktok}</span>}
                          </div>
                        </td>
                        <td className="history-msg">{d.message || "-"}</td>
                        <td><span className={`pkg-badge-sm tier-${d.tier}`}>{d.package_name}</span></td>
                        <td className="history-amount">฿{d.amount}</td>
                        <td><span className={`status-tag ${st.cls}`}>{st.text}</span></td>
                        <td className="history-time">{fmtDate(d.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====== TAB: REVENUE ====== */}
      {tab === "revenue" && (
        <div className="admin-content">
          {!revenue ? (
            <p className="empty-msg">กำลังโหลด...</p>
          ) : (
            <>
              <div className="revenue-cards">
                <div className="revenue-card">
                  <div className="revenue-label">วันนี้</div>
                  <div className="revenue-amount">฿{(revenue.today?.total || 0).toLocaleString()}</div>
                  <div className="revenue-count">{revenue.today?.count || 0} รายการ</div>
                </div>
                <div className="revenue-card">
                  <div className="revenue-label">เดือนนี้</div>
                  <div className="revenue-amount">฿{(revenue.month?.total || 0).toLocaleString()}</div>
                  <div className="revenue-count">{revenue.month?.count || 0} รายการ</div>
                </div>
              </div>

              <h3 className="section-label" style={{ marginTop: "1.5rem" }}>แยกตามแพ็กเกจ (เดือนนี้)</h3>
              {(revenue.by_package || []).length === 0 ? (
                <p className="empty-msg">ยังไม่มีข้อมูล</p>
              ) : (
                <table className="revenue-table">
                  <thead>
                    <tr><th>แพ็กเกจ</th><th>จำนวน</th><th>รายได้</th></tr>
                  </thead>
                  <tbody>
                    {revenue.by_package.map((p) => (
                      <tr key={p.name}>
                        <td><span className={`pkg-badge-sm tier-${p.tier}`}>{p.name}</span></td>
                        <td>{p.count} รายการ</td>
                        <td>฿{Number(p.total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
          <button className="btn-refresh" onClick={fetchRevenue} style={{ marginTop: "1rem" }}>🔄 รีเฟรช</button>
        </div>
      )}

      {/* ====== TAB: SETTINGS ====== */}
      {tab === "settings" && (
        <div className="admin-content">
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-info">
                <div className="settings-title">อนุมัติอัตโนมัติ</div>
                <div className="settings-desc">
                  เมื่อเปิด donation ที่ส่งมาจะเข้าคิวทันทีโดยไม่ต้องรอ Admin กด Approve
                </div>
              </div>
              <button
                className={`toggle-btn ${autoApprove ? "toggle-on" : "toggle-off"}`}
                onClick={() => saveAutoApprove(!autoApprove)}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            <div className={`settings-status ${autoApprove ? "status-open" : "status-closed"}`}>
              {autoApprove ? "🟢 เปิดอยู่ — Donation เข้าคิวอัตโนมัติ" : "🔴 ปิดอยู่ — Admin ต้อง Approve ทุกรายการ"}
            </div>
            {settingsSaved && <div className="settings-saved">✅ บันทึกแล้ว</div>}
          </div>
        </div>
      )}
    </div>
  );
}
