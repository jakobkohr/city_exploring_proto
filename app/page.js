"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOCK_USERS } from "../lib/users";
import { synthesizeProfile, scoreRestaurants, DEFAULT_WEIGHTS } from "../lib/engine";
import { GoogleMap, useJsApiLoader, Marker, Circle, OverlayView } from "@react-google-maps/api";

// ── Constants ────────────────────────────────────────────────────────────────
const MODES = [
  { key:"all",       label:"✨ For You"  },
  { key:"trending",  label:"🔥 Trending" },
  { key:"hidden",    label:"💎 Hidden"   },
];

const PLACE_CATEGORIES = [
  { key:"food",      label:"🍽️ Food",      agentLabel:"restaurants",                      emoji:"🍽️" },
  { key:"sights",    label:"🏛️ Sights",    agentLabel:"tourist attractions and museums",   emoji:"🏛️" },
  { key:"parks",     label:"🌳 Parks",      agentLabel:"parks and outdoor spaces",          emoji:"🌳" },
  { key:"fitness",   label:"💪 Fitness",    agentLabel:"gyms and fitness centres",          emoji:"💪" },
  { key:"shopping",  label:"🛍️ Shopping",  agentLabel:"shopping destinations",             emoji:"🛍️" },
  { key:"nightlife", label:"🎵 Nightlife",  agentLabel:"bars and nightlife venues",         emoji:"🎵" },
];

// Weights for non-food categories: skip cuisine + price, focus on rating + distance
const NON_FOOD_WEIGHTS = { cuisine: 0, rating: 0.55, price: 0, distance: 0.45 };

// Maps cuisine_override types → Google Places keyword for nearbysearch
const CUISINE_KEYWORD = {
  italian_restaurant:       "italian pizza",
  pizza_restaurant:         "pizza",
  japanese_restaurant:      "japanese",
  sushi_restaurant:         "sushi",
  ramen_restaurant:         "ramen",
  cafe:                     "cafe brunch",
  breakfast_restaurant:     "breakfast brunch",
  vegan_restaurant:         "vegan vegetarian",
  vegetarian_restaurant:    "vegetarian",
  seafood_restaurant:       "seafood fish mariscos",
  spanish_restaurant:       "spanish tapas",
  steak_house:              "steak grill carn",
  mediterranean_restaurant: "mediterranean",
  french_restaurant:        "french",
};

// Mock social graph — friend connections per user persona
const SOCIAL_PROFILES = {
  "david@gmail.com":  { friends: [{ name:"Sofia", initials:"S", color:"#e8710a" }, { name:"Marc", initials:"M", color:"#188038" }] },
  "sofia@gmail.com":  { friends: [{ name:"David", initials:"D", color:"#1a73e8" }, { name:"Alex", initials:"A", color:"#34a853" }] },
  "marc@gmail.com":   { friends: [{ name:"David", initials:"D", color:"#1a73e8" }] },
  "alex@gmail.com":   { friends: [{ name:"Sofia", initials:"S", color:"#e8710a" }] },
};

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(145deg,#f0f4ff 0%,#e8f5e9 100%)", padding:24,
    }}>
      <motion.div
        initial={{ opacity:0, y:28 }} animate={{ opacity:1, y:0 }}
        transition={{ duration:0.5, ease:[0.22,1,0.36,1] }}
        style={{ width:"100%", maxWidth:380, background:"white", borderRadius:28,
          boxShadow:"0 12px 48px rgba(0,0,0,0.10)", padding:"40px 32px" }}
      >
        <div style={{ textAlign:"center", marginBottom:8 }}>
          <svg width="48" height="48" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M24 4C15.163 4 8 11.163 8 20c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z"/>
            <circle cx="24" cy="20" r="6" fill="white"/>
          </svg>
        </div>
        <h1 style={{ fontSize:24, fontWeight:700, textAlign:"center", color:"#202124", marginBottom:4 }}>
          Sign in to Maps
        </h1>
        <p style={{ fontSize:14, color:"#5f6368", textAlign:"center", marginBottom:28 }}>
          Use your Google Account
        </p>

        <div style={{ background:"#f0f4ff", border:"1px solid #c5d8ff", borderRadius:12,
          padding:"14px 16px", marginBottom:28, fontSize:13, color:"#3c4043", lineHeight:1.6 }}>
          <strong style={{ color:"#1a73e8" }}>🔒 Demo mode</strong><br/>
          This prototype simulates Google OAuth. Select a persona to see how the engine
          personalises recommendations based on your account activity.
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Object.values(MOCK_USERS).map((user, i) => (
            <motion.button key={user.email}
              initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }}
              transition={{ delay:0.1 + i*0.07 }}
              whileHover={{ scale:1.015, boxShadow:"0 4px 16px rgba(0,0,0,0.10)" }}
              whileTap={{ scale:0.98 }}
              onClick={() => onLogin(user.email)}
              style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px",
                border:"1px solid #dadce0", borderRadius:24, background:"white",
                cursor:"pointer", textAlign:"left", fontFamily:"'Google Sans',sans-serif",
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)", transition:"box-shadow 0.15s" }}
            >
              <div style={{ width:42, height:42, borderRadius:"50%", background:user.color,
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"white", fontWeight:700, fontSize:16, flexShrink:0 }}>
                {user.initials}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#202124" }}>{user.name}</div>
                <div style={{ fontSize:12, color:"#5f6368" }}>{user.neighborhood} · {user.tagline}</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </motion.button>
          ))}
        </div>

        <p style={{ fontSize:11, color:"#9aa0a6", textAlign:"center", marginTop:20, lineHeight:1.6 }}>
          In production, OAuth grants the engine access to your<br/>
          Maps reviews, saves, and location history.
        </p>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PLACE CARD
// ══════════════════════════════════════════════════════════════════════════════
function PlaceCard({ r, onFeedback, isSelected, placeCategory, onMouseEnter, onMouseLeave, socialData }) {
  const [expanded, setExpanded] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const [socialHovered, setSocialHovered] = useState(false);

  const price = r.price_level != null ? "€".repeat(r.price_level) : null;
  const rawType = (r.types?.[0] || "place").replace(/_restaurant$/,"").replace(/_/g," ");
  const typeLabel = rawType.charAt(0).toUpperCase() + rawType.slice(1);
  const distKm = ((r.distance_m || 0)/1000).toFixed(1);
  const matchColor = r.matchPct >= 78 ? "#188038" : r.matchPct >= 58 ? "#e37400" : "#5f6368";
  const catEmoji = PLACE_CATEGORIES.find(c => c.key === placeCategory)?.emoji || "🍽️";
  const isFood = !placeCategory || placeCategory === "food";

  const handleFb = (intent) => {
    setFeedbackGiven(intent);
    onFeedback(r.name, intent);
  };

  return (
    <motion.div layout initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
      transition={{ ease:[0.22,1,0.36,1] }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ background:"white", borderRadius:18, marginBottom:12, overflow:"hidden",
        boxShadow: isSelected
          ? "0 0 0 2.5px #1a73e8, 0 4px 20px rgba(26,115,232,0.22)"
          : "0 2px 10px rgba(0,0,0,0.09)",
        transition:"box-shadow 0.2s", cursor:"pointer" }}>

      {/* Photo with overlay badges */}
      <div style={{ position:"relative", height:140, background:"#f1f3f4", overflow:"hidden" }}>
        {r.photo_url
          ? <img src={r.photo_url} alt={r.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          : <div style={{ height:"100%", background:`linear-gradient(135deg, ${matchColor}22, ${matchColor}44)`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>
              {catEmoji}
            </div>
        }
        {/* Match % badge — top-right */}
        <motion.div initial={{ scale:0.7 }} animate={{ scale:1 }}
          transition={{ type:"spring", stiffness:400, damping:20 }}
          style={{ position:"absolute", top:8, right:8, background:matchColor, color:"white",
            borderRadius:20, padding:"3px 11px", fontSize:13, fontWeight:700,
            boxShadow:"0 1px 6px rgba(0,0,0,0.30)" }}>
          {r.matchPct}%
        </motion.div>
        {/* Social badge — top-left */}
        {socialData && (
          <div style={{ position:"absolute", top:8, left:8 }}
            onMouseEnter={() => setSocialHovered(true)}
            onMouseLeave={() => setSocialHovered(false)}>
            <SocialBubble social={socialData} isHovered={socialHovered}
              onHover={() => setSocialHovered(true)} onLeave={() => setSocialHovered(false)}/>
          </div>
        )}
      </div>

      <div style={{ padding:"14px 14px 12px" }}>
        {/* Name + type */}
        <div style={{ marginBottom:5 }}>
          <div style={{ fontSize:16, fontWeight:700, color:"#202124",
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {r.name}
          </div>
          <div style={{ fontSize:12, color:"#5f6368", marginTop:1 }}>
            {typeLabel}{price ? ` · ${price}` : ""} · {r.neighborhood}
          </div>
        </div>

        {/* Meta */}
        <div style={{ fontSize:12, color:"#3c4043", marginBottom:8 }}>
          ⭐ <strong>{r.rating}</strong>
          <span style={{ color:"#9aa0a6" }}> ({(r.reviews_count||0).toLocaleString()})</span>
          {" · "}
          <span style={{ color: r.open_now ? "#188038" : "#d93025", fontWeight:600 }}>
            {r.open_now ? "Open" : "Closed"}
          </span>
          {" · "}{distKm} km
        </div>

        {/* AI explanation */}
        {r.explanation ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            style={{ fontSize:13, color:"#3c4043", fontStyle:"italic", marginBottom:10,
              background:"#f8f9fa", borderRadius:10, padding:"8px 12px",
              borderLeft:"3px solid #1a73e8" }}>
            "{r.explanation}"
          </motion.div>
        ) : (
          <div style={{ fontSize:12, color:"#9aa0a6", marginBottom:10 }}>
            Generating personalised reason…
          </div>
        )}

        {/* Score breakdown */}
        <button onClick={() => setExpanded(e=>!e)}
          style={{ fontSize:12, color:"#1a73e8", background:"none", border:"none",
            cursor:"pointer", padding:0, marginBottom:8, fontFamily:"'Google Sans',sans-serif" }}>
          {expanded ? "▲ Hide scores" : "▼ Score breakdown"}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
              exit={{ height:0, opacity:0 }} style={{ overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8,
                background:"#f8f9fa", borderRadius:12, padding:"12px", marginBottom:10 }}>
                {[
                  isFood ? ["🍜 Cuisine",  r.cuisineScore, "#1a73e8"] : null,
                  ["⭐ Rating",   r.ratingScore,  "#fbbc04"],
                  isFood ? ["💰 Price",    r.priceScore,   "#188038"] : null,
                  ["📍 Distance", r.distScore,    "#ea4335"],
                ].filter(Boolean).map(([label, val, color]) => (
                  <div key={label}>
                    <div style={{ fontSize:11, color:"#5f6368", marginBottom:4 }}>{label}</div>
                    <div style={{ background:"#e8eaed", borderRadius:4, height:6, marginBottom:3 }}>
                      <motion.div initial={{ width:0 }} animate={{ width:`${val||0}%` }}
                        transition={{ duration:0.5 }}
                        style={{ background:color, borderRadius:4, height:6 }}/>
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:"#202124" }}>{val||0}/100</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback buttons */}
        {feedbackGiven ? (
          <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
            style={{ textAlign:"center", fontSize:13, color:"#5f6368", padding:"6px 0" }}>
            {feedbackGiven === "🔖" ? "🔖 Saved!" : feedbackGiven === "👍" ? "👍 Noted — improving your picks" : "👎 Removed from picks"}
          </motion.div>
        ) : (
          <div style={{ display:"flex", gap:7 }}>
            {[
              { intent:"👍", label:"Interested", bg:"#e6f4ea", color:"#188038" },
              { intent:"👎", label:"Not for me", bg:"#fce8e6", color:"#d93025" },
              { intent:"🔖", label:"Save",       bg:"#fef7e0", color:"#e37400" },
            ].map(({ intent, label, bg, color }) => (
              <motion.button key={intent} whileTap={{ scale:0.94 }} onClick={() => handleFb(intent)}
                style={{ flex:1, padding:"8px 0", borderRadius:20, border:"none",
                  background:bg, color, fontSize:12, fontWeight:600, cursor:"pointer",
                  fontFamily:"'Google Sans',sans-serif" }}>
                {intent} {label}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// YOU TAB
// ══════════════════════════════════════════════════════════════════════════════
function YouTab({ user, profile, history }) {
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const prevLen = useRef(0);

  useEffect(() => {
    if (history.length < 1 || history.length === prevLen.current) return;
    prevLen.current = history.length;
    setLoading(true);
    fetch("/api/summary", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ history, profile }),
    })
      .then(r => r.json())
      .then(d => { setSummary(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [history, profile]);

  const topAff = Object.entries(profile?.affinity || {})
    .sort((a,b) => b[1]-a[1]).slice(0,6);
  const saved  = history.filter(h => h.saved || h.intent === "🔖");

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <div style={{ width:50, height:50, borderRadius:"50%", background:user.color,
          display:"flex", alignItems:"center", justifyContent:"center",
          color:"white", fontWeight:700, fontSize:20 }}>{user.initials}</div>
        <div>
          <div style={{ fontSize:17, fontWeight:700, color:"#202124" }}>{user.name}</div>
          <div style={{ fontSize:13, color:"#5f6368" }}>{user.neighborhood} · {user.tagline}</div>
        </div>
      </div>

      {/* LLM Personality summary */}
      <SectionTitle>🧠 Your taste profile</SectionTitle>
      {loading && (
        <div style={{ fontSize:13, color:"#5f6368", marginBottom:12,
          background:"#f8f9fa", borderRadius:10, padding:"12px 14px" }}>
          Generating insights from your interactions…
        </div>
      )}
      {summary?.summary_text && (
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          style={{ background:"#f8f9fa", borderLeft:"4px solid #1a73e8",
            borderRadius:"0 12px 12px 0", padding:"14px 16px", fontSize:13,
            color:"#3c4043", lineHeight:1.7, marginBottom:10 }}>
          {summary.summary_text}
        </motion.div>
      )}
      {summary?.top_tags?.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
          {summary.top_tags.map(tag => (
            <span key={tag} style={{ background:"#e8f0fe", color:"#1a73e8",
              borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:600 }}>
              {tag}
            </span>
          ))}
        </div>
      )}
      {summary?.accuracy != null && (
        <div style={{ fontSize:13, color:"#5f6368", marginBottom:20 }}>
          Engine accuracy:{" "}
          <strong style={{ color: summary.accuracy >= 70 ? "#188038" : summary.accuracy >= 40 ? "#e37400" : "#d93025" }}>
            {summary.accuracy}%
          </strong> of recommendations accepted
        </div>
      )}
      {!history.length && (
        <div style={{ background:"#f8f9fa", borderRadius:12, padding:"14px 16px",
          fontSize:13, color:"#5f6368", marginBottom:20, lineHeight:1.6 }}>
          React to a few recommendations on the Explore tab to unlock your personalised insights.
        </div>
      )}

      {/* Affinity bars */}
      <SectionTitle>🍽️ Cuisine affinities</SectionTitle>
      {topAff.map(([cuisine, score], i) => {
        const raw = cuisine.replace(/_restaurant$/,"").replace(/_/g," ");
        const label = raw.charAt(0).toUpperCase() + raw.slice(1);
        const pct = Math.round(score * 100);
        return (
          <div key={cuisine} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
              <span style={{ color:"#3c4043" }}>{label}</span>
              <span style={{ color:"#5f6368", fontWeight:600 }}>{pct}%</span>
            </div>
            <div style={{ background:"#e8eaed", borderRadius:4, height:8 }}>
              <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }}
                transition={{ duration:0.6, delay:i*0.06, ease:[0.22,1,0.36,1] }}
                style={{ background:"#1a73e8", borderRadius:4, height:8 }}/>
            </div>
          </div>
        );
      })}

      {/* Fitness interests */}
      {(user?.fitness_interests || []).length > 0 && (
        <>
          <SectionTitle style={{ marginTop:20 }}>🏃 Active interests</SectionTitle>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
            {user.fitness_interests.map(interest => {
              const INTEREST_EMOJI = {
                "salsa dancing":"💃","bachata":"🎶","latin dance":"🕺",
                "boxing":"🥊","kickboxing":"🥊","pilates":"🧘",
                "open-water swimming":"🌊","padel":"🎾","cycling":"🚴",
                "crossfit":"🏋️","running":"🏃","yoga":"🧘",
              };
              const emoji = INTEREST_EMOJI[interest] || "⚡";
              const label = interest.charAt(0).toUpperCase() + interest.slice(1);
              return (
                <motion.div key={interest}
                  initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }}
                  transition={{ ease:[0.22,1,0.36,1] }}
                  style={{ background:"#e6f4ea", color:"#188038", borderRadius:20,
                    padding:"7px 14px", fontSize:13, fontWeight:600,
                    display:"flex", alignItems:"center", gap:6 }}>
                  <span>{emoji}</span>{label}
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Saved */}
      {saved.length > 0 && (
        <>
          <SectionTitle style={{ marginTop:20 }}>🔖 Saved places</SectionTitle>
          {saved.map((h, i) => (
            <div key={i} style={{ background:"#fef7e0", borderRadius:12, padding:"10px 14px",
              marginBottom:8, fontSize:13, color:"#202124", fontWeight:600 }}>
              {h.name}
              <span style={{ fontSize:12, color:"#9aa0a6", fontWeight:400, marginLeft:8 }}>{h.date}</span>
            </div>
          ))}
        </>
      )}

      {/* History */}
      <SectionTitle style={{ marginTop:20 }}>📋 Interaction history</SectionTitle>
      {!history.length
        ? <div style={{ fontSize:13, color:"#9aa0a6" }}>No interactions yet.</div>
        : [...history].reverse().map((h, i) => {
            const rawType = (h.types?.[0] || "restaurant").replace(/_restaurant$/,"").replace(/_/g," ");
            const tLabel  = rawType.charAt(0).toUpperCase() + rawType.slice(1);
            return (
              <div key={i} style={{ background:"white", borderRadius:12, padding:"12px 14px",
                marginBottom:8, boxShadow:"0 1px 4px rgba(0,0,0,0.07)",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#202124" }}>{h.name}
                    {(h.saved || h.intent === "🔖") && (
                      <span style={{ marginLeft:7, fontSize:11, background:"#fef7e0",
                        color:"#e37400", borderRadius:8, padding:"2px 7px" }}>🔖</span>
                    )}
                  </div>
                  <div style={{ fontSize:12, color:"#9aa0a6" }}>{tLabel} · {h.date}</div>
                </div>
                <div style={{ fontSize:24 }}>{h.intent}</div>
              </div>
            );
          })
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE TAB
// ══════════════════════════════════════════════════════════════════════════════
function PipelineTab({ user, profile, weights, prefLabel }) {
  const w = weights || DEFAULT_WEIGHTS;
  const totalReviews = Object.values(user?.reviewed_cuisines || {}).reduce((s,v)=>s+v.count,0);
  const totalVisits  = Object.values(user?.visited_types || {}).reduce((s,v)=>s+v,0);

  return (
    <div style={{ padding:"16px 16px 80px" }}>
      <SectionTitle>📡 Input signals</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
        {[["Reviews",totalReviews,"#1a73e8"],["Visits",totalVisits,"#188038"],
          ["Saved",user?.saved_places?.length||0,"#e37400"]].map(([label,val,color])=>(
          <div key={label} style={{ background:"white", borderRadius:14, padding:"14px 10px",
            textAlign:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize:26, fontWeight:700, color }}>{val}</div>
            <div style={{ fontSize:12, color:"#5f6368" }}>{label}</div>
          </div>
        ))}
      </div>

      <SectionTitle>
        ⚖️ Scoring weights
        {prefLabel && <span style={{ fontSize:11, color:"#1a73e8", fontWeight:400,
          background:"#e8f0fe", borderRadius:20, padding:"2px 9px", marginLeft:8 }}>
          ⚡ {prefLabel}
        </span>}
      </SectionTitle>
      <div style={{ background:"white", borderRadius:14, overflow:"hidden",
        boxShadow:"0 1px 4px rgba(0,0,0,0.08)", marginBottom:20 }}>
        {Object.entries(w).map(([k,v],i,arr)=>{
          const icons = { cuisine:"🍜", rating:"⭐", price:"💰", distance:"📍" };
          return (
            <div key={k} style={{ padding:"11px 16px",
              borderBottom: i<arr.length-1 ? "1px solid #f1f3f4" : "none" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                fontSize:13, marginBottom:5 }}>
                <span style={{ color:"#3c4043" }}>{icons[k]} {k.charAt(0).toUpperCase()+k.slice(1)}</span>
                <strong style={{ color:"#202124" }}>{Math.round(v*100)}%</strong>
              </div>
              <div style={{ background:"#f1f3f4", borderRadius:4, height:5 }}>
                <motion.div initial={{ width:0 }} animate={{ width:`${Math.round(v*100)}%` }}
                  transition={{ duration:0.5 }}
                  style={{ background:"#1a73e8", borderRadius:4, height:5 }}/>
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle>🤖 LLM features</SectionTitle>
      {[
        { n:1, title:"Per-card explanation", fn:"POST /api/explain",
          badge:null,
          desc:"gpt-4o-mini generates a personalized 1-sentence reason why each restaurant fits this user. Profile + restaurant metadata → tailored explanation text injected into the card." },
        { n:2, title:"Personality summary (You tab)", fn:"POST /api/summary",
          badge:"Non-straightforward",
          desc:"LLM receives structured interaction data (accepted/rejected/saved restaurants) and reasons over it to produce natural-language personality insights + descriptor tags. Output is parsed into structured fields, not displayed raw." },
        { n:3, title:"Free-text → scoring weights", fn:"POST /api/parse-pref",
          badge:"Non-straightforward · Tools pattern",
          desc:'User types "quiet spot for a business lunch" → LLM returns structured JSON that directly overwrites the scoring weights and filters. The recommendation algorithm runs differently on every subsequent call. LLM output feeds a downstream system.' },
      ].map(f => (
        <div key={f.n} style={{ background:"white", borderRadius:14, padding:16,
          marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:6, flexWrap:"wrap" }}>
            <span style={{ background:"#1a73e8", color:"white", borderRadius:20,
              width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:11, fontWeight:700, flexShrink:0 }}>{f.n}</span>
            <div style={{ fontSize:14, fontWeight:700, color:"#202124" }}>{f.title}</div>
            {f.badge && <span style={{ fontSize:10, background:"#e6f4ea", color:"#188038",
              borderRadius:20, padding:"2px 8px", fontWeight:600 }}>{f.badge}</span>}
          </div>
          <code style={{ fontSize:11, background:"#f1f3f4", borderRadius:6,
            padding:"3px 8px", color:"#1a73e8", display:"block", marginBottom:8 }}>
            {f.fn}
          </code>
          <div style={{ fontSize:12, color:"#5f6368", lineHeight:1.6 }}>{f.desc}</div>
        </div>
      ))}

      <SectionTitle style={{ marginTop:20 }}>🔐 Mock OAuth</SectionTitle>
      <div style={{ background:"white", borderRadius:14, padding:16,
        boxShadow:"0 1px 4px rgba(0,0,0,0.08)", fontSize:12, color:"#5f6368", lineHeight:1.7 }}>
        The login screen simulates a Google OAuth 2.0 flow with 3 pre-built personas.
        Each persona has a distinct review history, visit pattern, and saved-places list —
        representing data that would be fetched from Google's People API after a real OAuth grant.
        Swapping personas demonstrates how dramatically recommendations change,
        proving the engine is genuinely personalised. In production: replace <code style={{ background:"#f1f3f4",
          borderRadius:4, padding:"1px 5px", color:"#1a73e8" }}>MOCK_USERS</code> with
        a People API call using the OAuth access token.
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function SectionTitle({ children, style }) {
  return (
    <div style={{ fontSize:14, fontWeight:700, color:"#202124",
      margin:"0 0 10px", ...style }}>
      {children}
    </div>
  );
}

function Toast({ msg }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
          exit={{ opacity:0, y:16 }}
          style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
            background:"#202124", color:"white", borderRadius:20,
            padding:"9px 20px", fontSize:13, fontWeight:500, zIndex:100,
            whiteSpace:"nowrap", boxShadow:"0 4px 16px rgba(0,0,0,0.22)" }}>
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SOCIAL BUBBLE — shown on map pins and card photos
// ══════════════════════════════════════════════════════════════════════════════
function SocialBubble({ social, onHover, onLeave, isHovered }) {
  if (!social) return null;
  const isFriend = social.type === "friend";
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{ position:"relative", display:"inline-flex", alignItems:"center", cursor:"pointer" }}
    >
      <motion.div
        whileHover={{ scale:1.12 }}
        style={{
          width:28, height:28, borderRadius:"50%",
          background: isFriend ? social.color : "#5f6368",
          border:"2px solid white",
          display:"flex", alignItems:"center", justifyContent:"center",
          color:"white", fontSize:10, fontWeight:700,
          boxShadow:"0 2px 6px rgba(0,0,0,0.25)",
        }}
      >
        {isFriend ? social.initials : "👥"}
      </motion.div>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity:0, y:4, scale:0.9 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:4, scale:0.9 }}
            transition={{ duration:0.15 }}
            style={{
              position:"absolute", bottom:"calc(100% + 8px)", left:"50%",
              transform:"translateX(-50%)",
              background:"#202124", color:"white",
              borderRadius:10, padding:"6px 10px",
              fontSize:11, fontWeight:500, whiteSpace:"nowrap",
              zIndex:200, boxShadow:"0 4px 12px rgba(0,0,0,0.3)",
              pointerEvents:"none",
            }}
          >
            {isFriend
              ? `${social.name} visited · "Loved it"`
              : "Friends of friends liked this"
            }
            <div style={{
              position:"absolute", top:"100%", left:"50%",
              transform:"translateX(-50%)",
              width:0, height:0,
              borderLeft:"5px solid transparent",
              borderRight:"5px solid transparent",
              borderTop:"5px solid #202124",
            }}/>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Auth state ─────────────────────────────────────────────────────────────
  const [loggedIn,   setLoggedIn]   = useState(false);
  const [userEmail,  setUserEmail]  = useState(null);
  const [profile,    setProfile]    = useState(null);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [restaurants,    setRestaurants]    = useState([]);
  const [recs,           setRecs]           = useState([]);
  const [history,        setHistory]        = useState([]);
  const [excluded,       setExcluded]       = useState(new Set());
  const [loadingRecs,    setLoadingRecs]    = useState(false);

  // ── Controls ───────────────────────────────────────────────────────────────
  const [placeCategory,  setPlaceCategory]  = useState("food");
  const [mode,           setMode]           = useState("all");
  const [radius,         setRadius]         = useState(750);
  const [advanced,       setAdvanced]       = useState({});
  const [customWeights,  setCustomWeights]  = useState(null);
  const [prefLabel,      setPrefLabel]      = useState(null);
  const [prefInput,      setPrefInput]      = useState("");
  const [prefLoading,    setPrefLoading]    = useState(false);
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [noMatch,        setNoMatch]        = useState(false);
  const [noMatchQuery,   setNoMatchQuery]   = useState(null);
  const [priceFilterMismatch, setPriceFilterMismatch] = useState(false);
  const [vibeFilterMismatch,  setVibeFilterMismatch]  = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab,        setActiveTab]        = useState("explore");
  const [selectedRec,      setSelectedRec]      = useState(null);
  const [hoveredRec,       setHoveredRec]       = useState(null);
  const [hoveredSocialPin, setHoveredSocialPin] = useState(null);
  const [toastMsg,         setToastMsg]         = useState(null);
  const panelContentRef = useRef(null);
  const cardRefs        = useRef({});
  const agentModeRef     = useRef(false);
  const agentPicksRef    = useRef([]);
  const agentModeCtxRef  = useRef(null);
  const prefTextRef      = useRef("");

  // ── Map state ──────────────────────────────────────────────────────────────
  const [userLatLng, setUserLatLng] = useState(null);
  const mapRef = useRef(null);
  const BARCELONA = { lat: 41.3874, lng: 2.1686 };

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GMAPS_KEY || "",
  });

  const PERSONA_COORDS = {
    "david@gmail.com": { lat: 41.3910, lng: 2.1655 },
    "sofia@gmail.com": { lat: 41.4035, lng: 2.1536 },
    "marc@gmail.com":  { lat: 41.3762, lng: 2.1921 },
    "alex@gmail.com":  { lat: 41.4016, lng: 2.2006 },
  };

  useEffect(() => {
    if (userLatLng && mapRef.current) mapRef.current.panTo(userLatLng);
  }, [userLatLng]);

  useEffect(() => {
    if (!mapRef.current || !userLatLng || !recs.length || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(userLatLng);
    recs.forEach(r => { if (r.lat && r.lng) bounds.extend({ lat: r.lat, lng: r.lng }); });
    mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    const idle = mapRef.current.addListener("idle", () => {
      if (mapRef.current.getZoom() > 16) mapRef.current.setZoom(16);
      window.google.maps.event.removeListener(idle);
    });
  }, [recs, userLatLng]);

  const user = userEmail ? MOCK_USERS[userEmail] : null;

  // ── Login / logout ─────────────────────────────────────────────────────────
  const handleLogin = (email) => {
    const coords = PERSONA_COORDS[email] || BARCELONA;
    setUserEmail(email);
    setProfile(synthesizeProfile(MOCK_USERS[email]));
    setUserLatLng(coords);
    setLoggedIn(true);
    agentModeRef.current = false;
    agentModeCtxRef.current = null;
    agentPicksRef.current = [];
    prefTextRef.current = "";
    setPlaceCategory("food");
    setMode("all");
    setActiveTab("explore");
    setRadius(750);
    setRecs([]); setRestaurants([]); setHistory([]);
    setExcluded(new Set()); setCustomWeights(null); setPrefLabel(null); setAdvanced({});
    setNoMatch(false); setNoMatchQuery(null); setPriceFilterMismatch(false); setVibeFilterMismatch(false); setSelectedRec(null);
  };

  // ── Scroll to card when marker is clicked ─────────────────────────────────
  useEffect(() => {
    if (!selectedRec) return;
    setActiveTab("explore");
    setTimeout(() => {
      const el = cardRefs.current[selectedRec];
      if (el && panelContentRef.current)
        panelContentRef.current.scrollTo({ top: el.offsetTop - 8, behavior:"smooth" });
    }, 220);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRec]);

  const handleLogout = () => {
    setLoggedIn(false); setUserEmail(null); setProfile(null);
  };

  // ── Fetch restaurants when logged in, radius, location, or cuisine changes ──
  useEffect(() => {
    if (!loggedIn || !userLatLng) return;
    const controller = new AbortController();
    setLoadingRecs(true);
    setRestaurants([]);

    const override = advanced.cuisine_override;
    const keyword = override?.length
      ? [...new Set(override.map(t => CUISINE_KEYWORD[t]).filter(Boolean))].join(" ")
      : "";

    const url = `/api/places?radius=${radius}&lat=${userLatLng.lat}&lng=${userLatLng.lng}&category=${placeCategory}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`;
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        const results = d.results || [];
        setRestaurants(results);
        const ctx = agentModeCtxRef.current;
        if (ctx === "trending" || ctx === "hidden") {
          triggerModeAgent(ctx, results);
        } else if (agentModeRef.current && prefTextRef.current) {
          runPrefAgent(prefTextRef.current, results);
        } else {
          triggerForYouAgent(results);
        }
      })
      .catch(err => { if (err.name !== "AbortError") console.error(err); })
      .finally(() => { if (!agentModeCtxRef.current && !prefTextRef.current) setLoadingRecs(false); });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, radius, userLatLng, userEmail, placeCategory, advanced.cuisine_override]);

  // ── Re-apply all advanced filters to agent picks when any filter changes ──
  useEffect(() => {
    if (!agentModeRef.current || !agentPicksRef.current.length) return;
    let out = agentPicksRef.current;

    if (advanced.price_max) {
      const f = out.filter(r => (r.price_level || 2) <= advanced.price_max);
      if (f.length) {
        out = f;
        setPriceFilterMismatch(false);
      } else {
        setPriceFilterMismatch(true);
        return;
      }
    } else {
      setPriceFilterMismatch(false);
    }

    if (advanced.open_now) {
      const f = out.filter(r => r.open_now !== false);
      if (f.length) out = f;
    }
    if (advanced.vibe === "quiet") {
      const f = out
        .filter(r => (r.reviews_count || 0) < 600)
        .sort((a, b) => (a.reviews_count || 0) - (b.reviews_count || 0));
      if (f.length) { out = f; setVibeFilterMismatch(false); }
      else { setVibeFilterMismatch(true); return; }
    } else if (advanced.vibe === "lively") {
      const f = out
        .filter(r => (r.reviews_count || 0) >= 300)
        .sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0));
      if (f.length) { out = f; setVibeFilterMismatch(false); }
      else { setVibeFilterMismatch(true); return; }
    } else {
      setVibeFilterMismatch(false);
    }
    setRecs(out);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanced.price_max, advanced.vibe, advanced.open_now]);

  // ── Re-score whenever inputs change ───────────────────────────────────────
  useEffect(() => {
    if (agentModeRef.current) return;
    if (!profile || !restaurants.length) return;
    const weights = placeCategory !== "food" ? NON_FOOD_WEIGHTS : customWeights;
    const scored  = scoreRestaurants(restaurants, profile, { mode, advanced, weights });
    const visible = scored.filter(r => !excluded.has(r.name)).slice(0, 3);

    if (advanced.cuisine_override?.length) {
      const overrideSet = new Set(advanced.cuisine_override);
      const anyMatch = visible.some(r => (r.types || []).some(t => overrideSet.has(t)));
      setNoMatch(!anyMatch);
    } else {
      setNoMatch(false);
    }

    setRecs(visible.map(r => ({ ...r, explanation: null })));
    visible.forEach(r => {
      fetch("/api/explain", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ restaurant: r, profile }),
      })
        .then(res => res.json())
        .then(d => setRecs(prev =>
          prev.map(pr => pr.name === r.name ? { ...pr, explanation: d.explanation } : pr)
        ))
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, profile, mode, customWeights, excluded, advanced]);

  // ── Feedback ───────────────────────────────────────────────────────────────
  const handleFeedback = useCallback((name, intent) => {
    const rec = recs.find(r => r.name === name) || {};
    const entry = {
      name, types: rec.types, rating: rec.rating, price_level: rec.price_level,
      intent, saved: intent === "🔖",
      date: new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short" }),
    };
    setHistory(h => [...h.filter(e => e.name !== name), entry]);
    if (intent === "👎") setExcluded(ex => new Set([...ex, name]));
    showToast(
      intent === "🔖" ? `🔖 ${name} saved!`
      : intent === "👍" ? "👍 Noted — improving picks"
      : "👎 Removed from picks"
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recs]);

  // ── Apply advanced filters to agent picks ─────────────────────────────────
  const applyAgentFilters = (picks) => {
    let out = picks;
    if (advanced.price_max) {
      const f = out.filter(r => (r.price_level || 2) <= advanced.price_max);
      if (f.length) out = f;
    }
    if (advanced.open_now) {
      const f = out.filter(r => r.open_now !== false);
      if (f.length) out = f;
    }
    if (advanced.vibe === "quiet") {
      const f = out.filter(r => (r.reviews_count || 0) < 400);
      if (f.length) out = f;
    } else if (advanced.vibe === "lively") {
      const f = out.filter(r => (r.reviews_count || 0) >= 400);
      if (f.length) out = f;
    }
    return out;
  };

  // ── Enrich agent picks with engine sub-scores ─────────────────────────────
  const enrichWithScores = (picks) => {
    if (!profile) return picks;
    const weights = placeCategory !== "food" ? NON_FOOD_WEIGHTS : customWeights;
    const engineScored = scoreRestaurants(picks, profile, { weights });
    return picks.map(pick => {
      const e = engineScored.find(s => s.place_id === pick.place_id || s.name === pick.name);
      return e
        ? { ...pick, cuisineScore: e.cuisineScore, ratingScore: e.ratingScore, priceScore: e.priceScore, distScore: e.distScore }
        : pick;
    });
  };

  // ── For You agent ──────────────────────────────────────────────────────────
  const triggerForYouAgent = async (existingOverride) => {
    if (!userLatLng || !profile) return;
    agentModeCtxRef.current = "foryou";
    agentModeRef.current = true;
    setMode("all");
    setLoadingRecs(true);
    setRecs([]);
    setNoMatch(false);
    setNoMatchQuery(null);
    setPriceFilterMismatch(false);
    const cuisineText = profile.topCuisines.slice(0, 3)
      .map(c => c.replace(/_restaurant$/, "").replace(/_/g, " ")).join(", ");
    const catDef = PLACE_CATEGORIES.find(c => c.key === placeCategory) || PLACE_CATEGORIES[0];
    const fitnessInterests = profile.lifestyleHints?.fitnessInterests || [];
    const forYouText = placeCategory === "food"
      ? `Find the 3 best restaurants that genuinely match this user's cuisine preferences: ${cuisineText}. Prioritise places that truly fit their taste, not just any highly-rated nearby spot.`
      : placeCategory === "fitness" && fitnessInterests.length
      ? `Find the 3 best fitness venues near this location that match the user's interests: ${fitnessInterests.join(", ")}. Search specifically for venues offering these activities — use each interest as a keyword.`
      : `Find the 3 best ${catDef.agentLabel} near this location. Prioritise highly rated, well-reviewed spots that are worth visiting.`;
    try {
      const res = await fetch("/api/agent", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          text: forYouText,
          profile, lat: userLatLng?.lat, lng: userLatLng?.lng,
          radius, existingRestaurants: existingOverride ?? restaurants, advanced,
          category: placeCategory,
        }),
      });
      const d = await res.json();
      if (d.picks?.length) {
        const enriched = enrichWithScores(d.picks);
        agentPicksRef.current = enriched;
        setRecs(applyAgentFilters(enriched));
        setPriceFilterMismatch(false);
        setVibeFilterMismatch(false);
      } else {
        agentModeRef.current = false;
        agentModeCtxRef.current = null;
        const pool = existingOverride ?? restaurants;
        if (pool.length && profile) {
          const scored = scoreRestaurants(pool, profile, { advanced, weights: customWeights });
          setRecs(scored.slice(0, 3));
        }
      }
    } catch {
      agentModeRef.current = false;
      agentModeCtxRef.current = null;
      const pool = existingOverride ?? restaurants;
      if (pool.length && profile) {
        const scored = scoreRestaurants(pool, profile, { advanced, weights: customWeights });
        setRecs(scored.slice(0, 3));
      }
    }
    setLoadingRecs(false);
  };

  // ── Refresh picks ──────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    if (!userLatLng || !profile) return;
    const avoid = recs.map(r => r.name).join(", ");
    agentModeRef.current = true;
    setLoadingRecs(true);
    setRecs([]);
    try {
      const cuisineText = profile.topCuisines.slice(0, 3)
        .map(c => c.replace(/_restaurant$/, "").replace(/_/g, " ")).join(", ");
      const res = await fetch("/api/agent", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          text: prefTextRef.current
            ? `${prefTextRef.current}. Find 3 different options, avoid: ${avoid}`
            : `Find 3 more great restaurants matching this user's taste for ${cuisineText}. Avoid: ${avoid}`,
          profile, lat: userLatLng?.lat, lng: userLatLng?.lng,
          radius, existingRestaurants: restaurants, advanced,
          category: placeCategory,
        }),
      });
      const d = await res.json();
      if (d.picks?.length) {
        const enriched = enrichWithScores(d.picks);
        agentPicksRef.current = enriched;
        setRecs(applyAgentFilters(enriched));
        setNoMatch(false);
      } else {
        agentModeRef.current = false;
        setNoMatch(true);
      }
    } catch { agentModeRef.current = false; }
    setLoadingRecs(false);
  };

  // ── Natural language preference → agent ───────────────────────────────────
  const runPrefAgent = async (text, existingOverride) => {
    agentModeRef.current = true;
    setLoadingRecs(true);
    setRecs([]);
    setNoMatch(false);
    try {
      const res = await fetch("/api/agent", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          text, profile,
          lat: userLatLng?.lat, lng: userLatLng?.lng,
          radius, existingRestaurants: existingOverride ?? restaurants,
          advanced, category: placeCategory,
        }),
      });
      const d = await res.json();
      if (d.picks?.length) {
        const enriched = enrichWithScores(d.picks);
        agentPicksRef.current = enriched;
        setRecs(applyAgentFilters(enriched));
        setPrefLabel(d.summary);
        setNoMatch(false);
        setNoMatchQuery(null);
        setPriceFilterMismatch(false);
        setVibeFilterMismatch(false);
        showToast(`🎯 ${d.summary || "Found your picks"}`);
      } else {
        agentModeRef.current = false;
        setNoMatch(true);
        setNoMatchQuery(text);
      }
    } catch { agentModeRef.current = false; }
    setLoadingRecs(false);
  };

  // ── Direct keyword search for non-food categories ─────────────────────────
  const runKeywordSearch = async (keyword) => {
    agentModeRef.current = true;
    setLoadingRecs(true);
    setRecs([]);
    setNoMatch(false);
    setNoMatchQuery(null);
    try {
      const url = `/api/places?category=${placeCategory}&keyword=${encodeURIComponent(keyword)}&radius=${radius}&lat=${userLatLng.lat}&lng=${userLatLng.lng}`;
      const d = await fetch(url).then(r => r.json());
      const results = (d.results || []).slice(0, 3);
      if (results.length) {
        const merged = [...restaurants];
        for (const r of results) {
          if (!merged.find(e => e.place_id === r.place_id)) merged.push(r);
        }
        setRestaurants(merged);
        const picks = results.map((r, i) => ({ ...r, matchPct: 95 - i * 3, explanation: null }));
        agentPicksRef.current = picks;
        setRecs(picks);
        setPrefLabel(keyword);
        picks.forEach(r => {
          fetch("/api/explain", { method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ restaurant: r, profile }) })
            .then(res => res.json())
            .then(d => setRecs(prev => prev.map(pr => pr.name === r.name ? { ...pr, explanation: d.explanation } : pr)))
            .catch(() => {});
        });
      } else {
        agentModeRef.current = false;
        setNoMatch(true);
        setNoMatchQuery(keyword);
      }
    } catch { agentModeRef.current = false; }
    setLoadingRecs(false);
  };

  const handlePrefSubmit = async () => {
    if (!prefInput.trim() || prefLoading) return;
    setPrefLoading(true);
    prefTextRef.current = prefInput;
    if (placeCategory !== "food") {
      await runKeywordSearch(prefInput);
    } else {
      await runPrefAgent(prefInput);
    }
    setPrefLoading(false);
  };

  // ── Mode chip handler ─────────────────────────────────────────────────────
  const triggerModeAgent = async (modeKey, existingOverride) => {
    if (!userLatLng || !profile) return;
    agentModeCtxRef.current = modeKey;
    agentModeRef.current = true;
    setLoadingRecs(true);
    setRecs([]);
    setNoMatch(false);
    try {
      const catDef = PLACE_CATEGORIES.find(c => c.key === placeCategory) || PLACE_CATEGORIES[0];
      const text = modeKey === "trending"
        ? `Find the most popular and trending ${catDef.agentLabel} right now with lots of buzz and reviews`
        : `Find hidden gem ${catDef.agentLabel} — high quality, underrated, not yet discovered by the masses`;
      const res = await fetch("/api/agent", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ text, profile, lat: userLatLng?.lat, lng: userLatLng?.lng,
          radius, existingRestaurants: existingOverride ?? restaurants, modeContext: modeKey, advanced,
          category: placeCategory }),
      });
      const d = await res.json();
      if (d.picks?.length) {
        const enriched = enrichWithScores(d.picks);
        agentPicksRef.current = enriched;
        setRecs(applyAgentFilters(enriched));
        setPrefLabel(modeKey === "trending" ? "Trending now" : "Hidden gems");
        setNoMatch(false);
        setPriceFilterMismatch(false);
        setVibeFilterMismatch(false);
      } else {
        agentModeRef.current = false;
        setNoMatch(true);
      }
    } catch { agentModeRef.current = false; }
    setLoadingRecs(false);
  };

  const handleCategoryChange = (cat) => {
    if (cat === placeCategory) return;
    agentModeRef.current = false;
    agentModeCtxRef.current = null;
    agentPicksRef.current = [];
    prefTextRef.current = "";
    setPrefLabel(null); setCustomWeights(null); setAdvanced({});
    setMode("all"); setNoMatch(false); setNoMatchQuery(null);
    setPriceFilterMismatch(false); setVibeFilterMismatch(false);
    setSelectedRec(null); setRecs([]); setRestaurants([]); setExcluded(new Set());
    setPlaceCategory(cat);
  };

  const handleModeChange = (key) => {
    if (key === "trending" || key === "hidden") {
      setMode(key);
      triggerModeAgent(key);
    } else {
      agentPicksRef.current = [];
      prefTextRef.current = "";
      setPrefLabel(null); setCustomWeights(null);
      triggerForYouAgent();
    }
  };

  // ── Social helper ─────────────────────────────────────────────────────────
  const getSocialForRec = (index) => {
    if (!userEmail) return null;
    const social = SOCIAL_PROFILES[userEmail];
    if (!social?.friends?.length) return null;
    if (index === 0) return { type:"friend", ...social.friends[0] };
    if (index === 1) return { type:"fof" };
    return null;
  };

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  };

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={{
      display:"flex", height:"100vh", overflow:"hidden",
      fontFamily:"'Google Sans', sans-serif", background:"#f8f9fa",
    }}>

      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <div style={{
        width:420, flexShrink:0, height:"100vh",
        display:"flex", flexDirection:"column",
        background:"white",
        boxShadow:"2px 0 16px rgba(0,0,0,0.10)",
        zIndex:10, position:"relative",
      }}>

        {/* Sticky header */}
        <div style={{ flexShrink:0, padding:"16px 16px 0",
          background:"white", borderBottom:"1px solid #f1f3f4" }}>

          {/* Logo + user row */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <svg width="32" height="32" viewBox="0 0 48 48" style={{ flexShrink:0 }}>
              <path fill="#4285F4" d="M24 4C15.163 4 8 11.163 8 20c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z"/>
              <circle cx="24" cy="20" r="6.5" fill="white"/>
            </svg>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:700, color:"#202124" }}>Explore Barcelona</div>
              <div style={{ fontSize:12, color:"#5f6368", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {user.neighborhood} · {user.tagline}
              </div>
            </div>
            <motion.button whileTap={{ scale:0.92 }} onClick={handleLogout}
              title="Click to sign out"
              style={{ width:38, height:38, borderRadius:"50%", background:user.color,
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"white", fontWeight:700, fontSize:15, flexShrink:0,
                border:"2.5px solid #f1f3f4", cursor:"pointer",
                boxShadow:"0 2px 8px rgba(0,0,0,0.18)" }}>
              {user.initials}
            </motion.button>
          </div>

          {/* Search / preference input */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", gap:8 }}>
              <input value={prefInput}
                onChange={e => setPrefInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePrefSubmit()}
                placeholder={
                  placeCategory === "fitness"   ? "e.g. yoga studio, boxing gym, crossfit…" :
                  placeCategory === "sights"    ? "e.g. modern art, gothic history, free museum…" :
                  placeCategory === "parks"     ? "e.g. quiet garden, dog-friendly, sea views…" :
                  placeCategory === "shopping"  ? "e.g. vintage clothes, design market…" :
                  placeCategory === "nightlife" ? "e.g. rooftop bar, live jazz, cocktails…" :
                  "e.g. quiet spot for a business lunch…"
                }
                style={{ flex:1, border:"1.5px solid #dadce0", borderRadius:24,
                  padding:"9px 16px", fontSize:13, outline:"none", color:"#202124",
                  fontFamily:"'Google Sans',sans-serif", transition:"border-color 0.15s",
                  background:"#f8f9fa" }}
                onFocus={e => e.target.style.borderColor="#1a73e8"}
                onBlur={e  => e.target.style.borderColor="#dadce0"}
              />
              <motion.button whileTap={{ scale:0.93 }} onClick={handlePrefSubmit}
                disabled={prefLoading}
                style={{ padding:"9px 18px", background:"#1a73e8", color:"white",
                  border:"none", borderRadius:24, fontSize:13, fontWeight:700,
                  cursor:"pointer", fontFamily:"'Google Sans',sans-serif",
                  opacity: prefLoading ? 0.7 : 1, minWidth:44 }}>
                {prefLoading ? "…" : "→"}
              </motion.button>
            </div>
            {prefLabel && (
              <motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
                style={{ display:"inline-flex", alignItems:"center", gap:6,
                  marginTop:8, background:"#e8f0fe", color:"#1a73e8",
                  borderRadius:20, padding:"5px 14px", fontSize:12, fontWeight:600 }}>
                🎯 {prefLabel}
                <span style={{ cursor:"pointer", opacity:0.6 }}
                  onClick={() => {
                    agentModeCtxRef.current = null;
                    prefTextRef.current = ""; agentPicksRef.current = [];
                    setPrefLabel(null); setCustomWeights(null); setAdvanced({});
                    setNoMatch(false); setNoMatchQuery(null);
                    setPriceFilterMismatch(false); setVibeFilterMismatch(false);
                    triggerForYouAgent();
                  }}>✕</span>
              </motion.div>
            )}
          </div>

          {/* Category chips */}
          <div style={{ display:"flex", gap:7, overflowX:"auto",
            scrollbarWidth:"none", paddingBottom:8 }}>
            {PLACE_CATEGORIES.map(c => (
              <motion.button key={c.key} whileTap={{ scale:0.95 }}
                onClick={() => handleCategoryChange(c.key)}
                style={{ padding:"6px 14px", borderRadius:20, border:"none",
                  fontSize:12, fontWeight:600, whiteSpace:"nowrap", cursor:"pointer",
                  fontFamily:"'Google Sans',sans-serif",
                  background: placeCategory===c.key ? "#202124" : "white",
                  color:      placeCategory===c.key ? "white"   : "#3c4043",
                  boxShadow:  placeCategory===c.key
                    ? "0 2px 8px rgba(0,0,0,0.30)"
                    : "0 1px 4px rgba(0,0,0,0.10)",
                  transition:"all 0.18s" }}>
                {c.label}
              </motion.button>
            ))}
          </div>

          {/* Mode chips */}
          <div style={{ display:"flex", gap:7, overflowX:"auto",
            scrollbarWidth:"none", paddingBottom:12 }}>
            {MODES.map(m => (
              <motion.button key={m.key} whileTap={{ scale:0.95 }}
                onClick={() => handleModeChange(m.key)}
                style={{ padding:"7px 15px", borderRadius:20, border:"none",
                  fontSize:12, fontWeight:600, whiteSpace:"nowrap", cursor:"pointer",
                  fontFamily:"'Google Sans',sans-serif",
                  background: mode===m.key ? "#1a73e8" : "white",
                  color:      mode===m.key ? "white"   : "#3c4043",
                  boxShadow:  mode===m.key
                    ? "0 2px 8px rgba(26,115,232,0.35)"
                    : "0 1px 4px rgba(0,0,0,0.10)",
                  transition:"all 0.18s" }}>
                {m.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex", borderBottom:"1px solid #f1f3f4", flexShrink:0 }}>
          {[
            { key:"explore",  label:"🗺️ Explore"  },
            { key:"you",      label:"👤 You"       },
            { key:"pipeline", label:"⚙️ Pipeline"  },
          ].map(t => (
            <button key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{ flex:1, padding:"12px 0", border:"none", background:"none",
                cursor:"pointer", fontSize:13, fontWeight:600,
                fontFamily:"'Google Sans',sans-serif",
                color: activeTab===t.key ? "#1a73e8" : "#5f6368",
                borderBottom: activeTab===t.key ? "2.5px solid #1a73e8" : "2.5px solid transparent",
                transition:"color 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable tab content */}
        <div ref={panelContentRef}
          style={{ flex:1, minHeight:0, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>

          {activeTab === "explore" && (
            <motion.div key="explore"
              initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.15 }}>

              {/* Radius slider */}
              <div style={{ padding:"12px 16px 4px" }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  fontSize:12, color:"#5f6368", marginBottom:4 }}>
                  <span>Search radius</span>
                  <span style={{ fontWeight:600, color:"#3c4043" }}>{radius}m</span>
                </div>
                <input type="range" min={500} max={5000} step={250} value={radius}
                  onChange={e => setRadius(Number(e.target.value))}
                  style={{ width:"100%", accentColor:"#1a73e8", cursor:"pointer" }}/>
              </div>

              {/* Advanced toggle */}
              <div style={{ padding:"4px 16px 8px" }}>
                <button onClick={() => setShowAdvanced(s=>!s)}
                  style={{ fontSize:12, color:"#1a73e8", background:"none", border:"none",
                    cursor:"pointer", fontFamily:"'Google Sans',sans-serif", padding:0 }}>
                  {showAdvanced ? "▲ Hide filters" : "▼ Advanced filters"}
                </button>
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div initial={{ height:0, opacity:0 }}
                      animate={{ height:"auto", opacity:1 }}
                      exit={{ height:0, opacity:0 }} style={{ overflow:"hidden" }}>
                      <div style={{ paddingTop:10, display:"flex", flexDirection:"column", gap:10 }}>
                        {/* Budget filter */}
                        <div>
                          <div style={{ fontSize:12, color:"#5f6368", marginBottom:6 }}>Budget per person</div>
                          <div style={{ display:"flex", gap:6 }}>
                            {[["Any",null],["< €20",1],["€20–35",2],["€35–60",3]].map(([label, val]) => {
                              const active = val === null ? !advanced.price_max : advanced.price_max === val;
                              return (
                                <button key={label}
                                  onClick={() => setAdvanced(a => ({ ...a, price_max: val }))}
                                  style={{ flex:1, padding:"6px 0", border:"1.5px solid",
                                    borderColor: active ? "#1a73e8" : "#dadce0",
                                    borderRadius:20, background: active ? "#e8f0fe" : "white",
                                    color: active ? "#1a73e8" : "#5f6368",
                                    fontSize:12, fontWeight:600, cursor:"pointer",
                                    fontFamily:"'Google Sans',sans-serif" }}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* Open Now */}
                        <div>
                          <div style={{ fontSize:12, color:"#5f6368", marginBottom:6 }}>Availability</div>
                          <div style={{ display:"flex", gap:6 }}>
                            {[["Any",false],["Open Now",true]].map(([label, val]) => {
                              const active = (advanced.open_now || false) === val;
                              return (
                                <button key={label}
                                  onClick={() => setAdvanced(a => ({ ...a, open_now: val }))}
                                  style={{ flex:1, padding:"6px 0", border:"1.5px solid",
                                    borderColor: active ? "#1a73e8" : "#dadce0",
                                    borderRadius:20, background: active ? "#e8f0fe" : "white",
                                    color: active ? "#1a73e8" : "#5f6368",
                                    fontSize:12, fontWeight:600, cursor:"pointer",
                                    fontFamily:"'Google Sans',sans-serif" }}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* Vibe */}
                        <div>
                          <div style={{ fontSize:12, color:"#5f6368", marginBottom:6 }}>Vibe</div>
                          <div style={{ display:"flex", gap:6 }}>
                            {[["Quiet","quiet"],["Any",null],["Lively","lively"]].map(([label, val]) => {
                              const active = (advanced.vibe || null) === val;
                              return (
                                <button key={label}
                                  onClick={() => setAdvanced(a => ({ ...a, vibe: val }))}
                                  style={{ flex:1, padding:"6px 0", border:"1.5px solid",
                                    borderColor: active ? "#1a73e8" : "#dadce0",
                                    borderRadius:20, background: active ? "#e8f0fe" : "white",
                                    color: active ? "#1a73e8" : "#5f6368",
                                    fontSize:12, fontWeight:600, cursor:"pointer",
                                    fontFamily:"'Google Sans',sans-serif" }}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div style={{ borderTop:"1px solid #f1f3f4" }}/>

              {/* Cards */}
              <div style={{ padding:"12px 16px 40px" }}>
                {/* Vibe filter mismatch banner */}
                {vibeFilterMismatch && (
                  <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }}
                    style={{ background:"#f3e8ff", border:"1.5px solid #a855f7",
                      borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
                    <div style={{ fontSize:13, color:"#3c4043", marginBottom:10, lineHeight:1.5 }}>
                      None of your current picks match a <strong>{advanced.vibe}</strong> vibe.
                    </div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <motion.button whileTap={{ scale:0.96 }}
                        onClick={() => { setAdvanced(a => ({ ...a, vibe: null })); setVibeFilterMismatch(false); }}
                        style={{ padding:"8px 18px", background:"#9333ea", color:"white",
                          border:"none", borderRadius:20, fontSize:13, fontWeight:700,
                          cursor:"pointer", fontFamily:"'Google Sans',sans-serif" }}>
                        Clear vibe filter
                      </motion.button>
                      <motion.button whileTap={{ scale:0.96 }}
                        onClick={() => {
                          setVibeFilterMismatch(false);
                          if (agentModeCtxRef.current === "trending" || agentModeCtxRef.current === "hidden")
                            triggerModeAgent(agentModeCtxRef.current);
                          else if (prefTextRef.current) runPrefAgent(prefTextRef.current);
                          else triggerForYouAgent();
                        }}
                        style={{ padding:"8px 18px", background:"white", color:"#9333ea",
                          border:"1.5px solid #a855f7", borderRadius:20, fontSize:13, fontWeight:600,
                          cursor:"pointer", fontFamily:"'Google Sans',sans-serif" }}>
                        Search for {advanced.vibe} places
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* Price filter mismatch banner */}
                {priceFilterMismatch && (
                  <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }}
                    style={{ background:"#fef7e0", border:"1.5px solid #fbbc04",
                      borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
                    <div style={{ fontSize:13, color:"#3c4043", marginBottom:10, lineHeight:1.5 }}>
                      Current picks exceed your {advanced.price_max === 1 ? "< €20" : advanced.price_max === 2 ? "€20–35" : "€35–60"} budget. Search for new picks that fit?
                    </div>
                    <motion.button whileTap={{ scale:0.96 }}
                      onClick={() => {
                        setPriceFilterMismatch(false);
                        if (agentModeCtxRef.current) triggerModeAgent(agentModeCtxRef.current);
                        else if (prefTextRef.current) runPrefAgent(prefTextRef.current);
                      }}
                      style={{ padding:"8px 18px", background:"#e37400", color:"white",
                        border:"none", borderRadius:20, fontSize:13, fontWeight:700,
                        cursor:"pointer", fontFamily:"'Google Sans',sans-serif" }}>
                      Search now →
                    </motion.button>
                  </motion.div>
                )}

                {loadingRecs
                  ? <div style={{ textAlign:"center", padding:48, color:"#5f6368", fontSize:13 }}>
                      Finding your picks…
                    </div>
                  : noMatch
                  ? <motion.div initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }}
                      style={{ margin:"20px 0", background:"white", borderRadius:18,
                        boxShadow:"0 2px 16px rgba(0,0,0,0.10)", padding:"22px 20px", textAlign:"center" }}>
                      <div style={{ fontSize:28, marginBottom:10 }}>🔍</div>
                      {noMatchQuery
                        ? <>
                            <div style={{ fontSize:14, fontWeight:700, color:"#202124", marginBottom:6 }}>
                              "{noMatchQuery.length > 40 ? noMatchQuery.slice(0,40) + "…" : noMatchQuery}" not found nearby
                            </div>
                            <div style={{ fontSize:13, color:"#5f6368", marginBottom:16, lineHeight:1.5 }}>
                              No results in your current {radius}m search area. Expand it to find what you're looking for.
                            </div>
                          </>
                        : <div style={{ fontSize:13, color:"#5f6368", marginBottom:16, lineHeight:1.5 }}>
                            Nothing found nearby — try expanding the search area.
                          </div>
                      }
                      <motion.button whileTap={{ scale:0.96 }}
                        onClick={() => setRadius(prev => Math.min(prev + 1500, 5000))}
                        style={{ padding:"10px 22px", background:"#1a73e8", color:"white",
                          border:"none", borderRadius:20, fontSize:13, fontWeight:700,
                          cursor:"pointer", fontFamily:"'Google Sans',sans-serif" }}>
                        Expand search area (+1.5 km)
                      </motion.button>
                    </motion.div>
                  : recs.length === 0
                  ? <div style={{ textAlign:"center", padding:48, color:"#5f6368", fontSize:13 }}>
                      No {PLACE_CATEGORIES.find(c=>c.key===placeCategory)?.agentLabel || "places"} found — try increasing the radius.
                    </div>
                  : recs.map((r, i) => (
                      <div key={r.name} ref={el => { cardRefs.current[r.name] = el; }}>
                        <PlaceCard
                          r={r}
                          onFeedback={handleFeedback}
                          isSelected={selectedRec === r.name}
                          placeCategory={placeCategory}
                          socialData={getSocialForRec(i)}
                          onMouseEnter={() => setHoveredRec(r.name)}
                          onMouseLeave={() => setHoveredRec(null)}
                        />
                      </div>
                    ))
                }

                {recs.length > 0 && (
                  <motion.button whileTap={{ scale:0.97 }} onClick={handleRefresh}
                    style={{ width:"100%", padding:"12px 0", border:"1.5px solid #dadce0",
                      borderRadius:20, background:"white", color:"#3c4043",
                      fontSize:13, fontWeight:600, cursor:"pointer",
                      fontFamily:"'Google Sans',sans-serif", marginBottom:24 }}>
                    🔄 Show 3 more picks
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "you" && (
            <motion.div key="you"
              initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.15 }}>
              <YouTab user={user} profile={profile} history={history}/>
            </motion.div>
          )}

          {activeTab === "pipeline" && (
            <motion.div key="pipeline"
              initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.15 }}>
              <PipelineTab user={user} profile={profile}
                weights={customWeights} prefLabel={prefLabel}/>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL — MAP ────────────────────────────────────────────── */}
      <div style={{ flex:1, position:"relative", height:"100vh" }}>
        {mapsLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width:"100%", height:"100%", filter:"saturate(0.85) brightness(0.97)" }}
            center={userLatLng || BARCELONA}
            zoom={15}
            onLoad={map => { mapRef.current = map; }}
            options={{
              disableDefaultUI: true,
              gestureHandling: "greedy",
              backgroundColor: "#b3cde0",
              styles: [{ featureType:"poi", elementType:"labels", stylers:[{visibility:"off"}] }],
            }}
          >
            {userLatLng && (
              <>
                <Marker
                  position={userLatLng}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: "#4285F4",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 3,
                  }}
                />
                <Circle
                  center={userLatLng}
                  radius={80}
                  options={{ fillColor:"#4285F4", fillOpacity:0.15, strokeColor:"#4285F4", strokeOpacity:0.3, strokeWeight:1 }}
                />
              </>
            )}

            {recs.map((r, i) => r.lat && r.lng && (
              <Marker
                key={r.place_id || r.name}
                position={{ lat: r.lat, lng: r.lng }}
                onClick={() => setSelectedRec(r.name)}
                onMouseOver={() => setHoveredRec(r.name)}
                onMouseOut={() => setHoveredRec(null)}
                label={{ text: String(i + 1), color: "#fff", fontWeight: "bold", fontSize: "13px" }}
                icon={{
                  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                  fillColor: selectedRec === r.name ? "#ea4335" : hoveredRec === r.name ? "#1558d6" : "#1a73e8",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2,
                  scale: (hoveredRec === r.name || selectedRec === r.name) ? 2.5 : 2,
                  anchor: new window.google.maps.Point(12, 22),
                  labelOrigin: new window.google.maps.Point(12, 9),
                }}
              />
            ))}

            {/* Social OverlayViews above pins */}
            {recs.map((r, i) => {
              const social = getSocialForRec(i);
              if (!social || !r.lat || !r.lng) return null;
              return (
                <OverlayView
                  key={`social-${r.place_id || r.name}`}
                  position={{ lat: r.lat, lng: r.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  getPixelPositionOffset={(width, height) => ({
                    x: -(width / 2),
                    y: -(height + 44),
                  })}
                >
                  <SocialBubble
                    social={social}
                    onHover={() => setHoveredSocialPin(r.name)}
                    onLeave={() => setHoveredSocialPin(null)}
                    isHovered={hoveredSocialPin === r.name}
                  />
                </OverlayView>
              );
            })}
          </GoogleMap>
        ) : (
          <div style={{ width:"100%", height:"100%", background:"#e8eaed",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#5f6368", fontSize:14 }}>
            Loading map…
          </div>
        )}
      </div>

      <Toast msg={toastMsg}/>
    </div>
  );
}
