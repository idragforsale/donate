import { useEffect, useRef, useState, useMemo } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "./api";

const DONATE_URL = `${window.location.origin}/donate`;

// ---- Countdown hook ----
function useCountdown(item) {
  const [remaining, setRemaining] = useState(null);
  const startRef = useRef(null);
  const durRef   = useRef(null);

  useEffect(() => {
    if (!item) { setRemaining(null); return; }
    startRef.current = Date.now();
    durRef.current   = (item.duration_sec || 10) * 1000;

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      setRemaining(Math.max(0, Math.ceil((durRef.current - elapsed) / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [item?.id]); // reset when new item

  return remaining;
}

// ---- Confetti (tier 4) ----
function ConfettiRain() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id:       i,
        left:     `${(i * 1.67) % 100}%`,
        delay:    `${(i * 0.05) % 3}s`,
        duration: `${2.5 + (i % 5) * 0.3}s`,
        color:    ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#e91e8c","#ff9f43"][i % 6],
      })),
    []
  );
  return (
    <div className="confetti-wrap" aria-hidden>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left:              p.left,
            animationDelay:    p.delay,
            animationDuration: p.duration,
            background:        p.color,
          }}
        />
      ))}
    </div>
  );
}

// ---- Image URL helper ----
function resolveImg(url) {
  if (!url) return "https://dummyimage.com/400x400/111/fff&text=♥";
  return url.startsWith("/uploads/") ? `${API_BASE}${url}` : url;
}

// ================================================================
export default function Display() {
  const [online, setOnline] = useState(false);
  const [now,    setNow]    = useState(null);
  const [next,   setNext]   = useState([]);
  const socketRef = useRef(null);

  const params  = new URLSearchParams(window.location.search);
  const venueId = Number(params.get("venue") || 1);

  const remaining = useCountdown(now);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(DONATE_URL)}&bgcolor=000000&color=ffffff&format=png`;

  useEffect(() => {
    // Fetch current state on mount
    fetch(`${API_BASE}/display/now?venue_id=${venueId}`)
      .then((r) => r.json())
      .then((d) => { setNow(d.now || null); setNext(d.next || []); })
      .catch(() => {});

    const s = io(API_BASE, { transports: ["websocket","polling"], reconnection: true });
    socketRef.current = s;

    s.on("connect",       () => { setOnline(true);  s.emit("joinDisplay", { venue_id: venueId }); });
    s.on("disconnect",    () => setOnline(false));
    s.on("connect_error", () => setOnline(false));
    s.on("nowPlaying", ({ now, next }) => { setNow(now || null); setNext(next || []); });

    return () => { s.off(); s.close(); };
  }, [venueId]);

  const effect = now?.effect || "none";

  return (
    <div className="display-root">
      {/* Confetti overlay for tier 4 */}
      {effect === "confetti" && now && <ConfettiRain />}

      {/* Connection status dot */}
      <div className={`status-dot ${online ? "dot-online" : "dot-offline"}`} />

      {now ? (
        /* ── Split layout: left = caption/links, right = image ── */
        <div className={`display-split anim-in effect-bg-${effect}`}>

          {/* LEFT HALF — name, message, socials, queue, QR */}
          <div className="split-left">
            <div className="split-left-top">
              <div className={`now-name effect-text-${effect}`}>{now.display_name}</div>
              {now.message && <div className="now-msg">"{now.message}"</div>}
              <div className="now-socials">
                {now.ig     && <span className="social-tag">📸 {now.ig}</span>}
                {now.fb     && <span className="social-tag">👤 {now.fb}</span>}
                {now.tiktok && <span className="social-tag">🎵 {now.tiktok}</span>}
              </div>
            </div>

            <div className="split-left-bottom">
              {next.length > 0 && (
                <div className="display-queue">
                  <div className="queue-label">ถัดไป</div>
                  <div className="queue-list">
                    {next.slice(0, 5).map((item, i) => (
                      <div key={item.id} className="queue-item">
                        <span className="queue-item-num">#{i + 1}</span>
                        <img
                          src={resolveImg(item.image_url)}
                          alt={item.display_name}
                          className="queue-item-img"
                          onError={(e) => { e.target.src = "https://dummyimage.com/40x40/222/fff&text=♥"; }}
                        />
                        <span className="queue-item-name">{item.display_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="donate-qr">
                <img src={qrUrl} alt="QR Donate" className="qr-img" />
                <div className="qr-label">สแกนเพื่อ Donate</div>
              </div>
            </div>
          </div>

          {/* RIGHT HALF — image + countdown */}
          <div className="split-right">
            <div className={`now-img-wrap effect-img-${effect}`}>
              <img
                key={now.id}
                src={resolveImg(now.image_url)}
                alt={now.display_name}
                className="now-img"
                onError={(e) => { e.target.src = "https://dummyimage.com/400x400/111/fff&text=♥"; }}
              />
            </div>
            {remaining !== null && (
              <div className="countdown">{remaining}s</div>
            )}
          </div>
        </div>

      ) : (
        <div className="display-idle">
          <div className="idle-icon">💝</div>
          <div className="idle-text">รอ Donation...</div>
          <div className="donate-qr" style={{ marginTop: "2rem" }}>
            <img src={qrUrl} alt="QR Donate" className="qr-img" />
            <div className="qr-label">สแกนเพื่อ Donate</div>
          </div>
        </div>
      )}
    </div>
  );
}
