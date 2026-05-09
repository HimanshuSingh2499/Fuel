import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FOODS } from './foods.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, LineChart, Line, ReferenceLine, ReferenceArea
} from 'recharts'
import {
  Home, TrendingUp, Cookie, Settings, Plus, ChevronLeft, ChevronRight,
  Flame, Scale, Droplets, Calendar, Dumbbell, Utensils
} from 'lucide-react'

/* ---------------------------------------------------------------------------
   Storage helpers
   The original prompt asked for window.storage. That's not a real browser API,
   so we wrap it: try window.storage first, then fall back to localStorage so
   the web app actually persists. Same shape either way.
--------------------------------------------------------------------------- */
const STORAGE_KEY = 'nutritionApp.v1'
const storage = {
  get(key) {
    try {
      if (typeof window !== 'undefined' && window.storage && typeof window.storage.getItem === 'function') {
        return window.storage.getItem(key)
      }
      return window.localStorage.getItem(key)
    } catch { return null }
  },
  set(key, value) {
    try {
      if (typeof window !== 'undefined' && window.storage && typeof window.storage.setItem === 'function') {
        window.storage.setItem(key, value)
        return
      }
      window.localStorage.setItem(key, value)
    } catch { /* ignore quota errors */ }
  }
}

/* ---------------------------------------------------------------------------
   User profile + macro targets (defaults — editable in Settings)
--------------------------------------------------------------------------- */
const DEFAULT_PROFILE = {
  name: 'Himanshu',
  age: 26,
  weight: 83,
  heightCm: 183,
  goal: 'Body Recomposition (Fat Loss + Muscle Gain)',
  targets: {
    calories: { min: 2200, max: 2400 },
    protein:  { min: 160,  max: 170  },
    carbs:    { min: 220,  max: 250  },
    fat:      { min: 60,   max: 70   }
  },
  waterTarget: 3500
}
const mid = (range) => (range.min + range.max) / 2

/* ---------------------------------------------------------------------------
   Week plan data
--------------------------------------------------------------------------- */
const DAY_KEYS = ['mon','tue','wed','thu','fri','sat','sun']
const DAY_LABELS = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday'
}
const DAY_SHORT = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }

const ACTIVITY = {
  mon: { label: 'Badminton 8–9am',    emoji: '🏸', type: 'Badminton',     durationMin: 60 },
  tue: { label: 'Badminton 8–9am',    emoji: '🏸', type: 'Badminton',     durationMin: 60 },
  wed: { label: 'Badminton 8–9am',    emoji: '🏸', type: 'Badminton',     durationMin: 60 },
  thu: { label: 'Badminton 8–9am',    emoji: '🏸', type: 'Badminton',     durationMin: 60 },
  fri: { label: 'Football 9–10:30pm', emoji: '⚽', type: 'Football',       durationMin: 90 },
  sat: { label: 'Light activity',     emoji: '🚶', type: 'Light activity', durationMin: 30 },
  sun: { label: 'Full rest day',      emoji: '🛌', type: null,             durationMin: 0  }
}

const COMMON_WORKOUTS = ['Badminton', 'Football', 'Running', 'Cycling', 'Gym - Push', 'Gym - Pull', 'Gym - Legs', 'Gym - Full Body', 'Yoga', 'HIIT', 'Walk', 'Swimming', 'Stretching']
const INTENSITY_OPTS = [
  { key: 'light',    label: 'Light',    color: '#34d399' },
  { key: 'moderate', label: 'Moderate', color: '#fbbf24' },
  { key: 'hard',     label: 'Hard',     color: '#f87171' }
]

const mealEmoji = (type) => {
  const t = type.toLowerCase()
  if (t.includes('pre-workout') || t.includes('pre-match')) return '⚡'
  if (t.includes('post-workout') || t.includes('post-match') || t.includes('whey')) return '🥤'
  if (t.includes('breakfast')) return '🍳'
  if (t.includes('lunch')) return '🍱'
  if (t.includes('dinner')) return '🍽️'
  if (t.includes('snack')) return '🥜'
  return '🍴'
}

const m = (id, time, timeMin, type, food, calories, protein, carbs, fat) => ({
  id, time, timeMin, type, food, calories, protein, carbs, fat
})

const WEEK_PLAN = {
  mon: [
    m('mon-pre',   '7:15 AM',  7*60+15,  'Pre-Workout Snack', 'Banana + Black Coffee', 120, 1, 28, 0.5),
    m('mon-post',  '9:15 AM',  9*60+15,  'Post-Workout Whey', '1 scoop whey in water', 125, 25, 5, 1),
    m('mon-bf',    '10:00 AM', 10*60,    'Breakfast', 'Egg Bhurji (3 eggs+1 white) + 2 WW Toast', 420, 28, 35, 16),
    m('mon-lun',   '1:30 PM',  13*60+30, 'Lunch', 'Grilled Chicken Rice Bowl + Salad', 550, 45, 55, 12),
    m('mon-eve',   '5:00 PM',  17*60,    'Evening Snack', 'Greek Yogurt (200g) + Mixed Nuts', 280, 18, 20, 14),
    m('mon-din',   '8:00 PM',  20*60,    'Dinner', 'Masoor Dal + 2 WW Rotis + Curd', 520, 28, 70, 10),
  ],
  tue: [
    m('tue-pre',   '7:15 AM',  7*60+15,  'Pre-Workout Snack', 'Apple + Black Coffee', 100, 0.5, 25, 0.3),
    m('tue-post',  '9:15 AM',  9*60+15,  'Post-Workout Whey', '1 scoop whey in water', 125, 25, 5, 1),
    m('tue-bf',    '10:00 AM', 10*60,    'Breakfast', 'Moong Dal Chilla (3pcs) + Green Chutney', 380, 22, 45, 8),
    m('tue-lun',   '1:30 PM',  13*60+30, 'Lunch', 'Rajma + 1 cup Rice + Onion Salad', 550, 22, 80, 10),
    m('tue-eve',   '5:00 PM',  17*60,    'Evening Snack', '2 Boiled Eggs + Banana', 210, 14, 28, 8),
    m('tue-din',   '8:00 PM',  20*60,    'Dinner', 'Chicken Stir Fry (150g) + 2 Rotis + Salad', 520, 38, 55, 15),
  ],
  wed: [
    m('wed-pre',   '7:15 AM',  7*60+15,  'Pre-Workout Snack', 'Banana + Black Coffee', 120, 1, 28, 0.5),
    m('wed-post',  '9:15 AM',  9*60+15,  'Post-Workout Whey', '1 scoop whey in water', 125, 25, 5, 1),
    m('wed-bf',    '10:00 AM', 10*60,    'Breakfast', 'Oats Porridge (1 cup) + 1 Boiled Egg', 380, 20, 55, 8),
    m('wed-lun',   '1:30 PM',  13*60+30, 'Lunch', 'Paneer Bhurji (150g) + 2 Rotis + Salad', 580, 32, 45, 22),
    m('wed-eve',   '5:00 PM',  17*60,    'Evening Snack', 'Roasted Chana + Masala Chaas 250ml', 220, 12, 28, 5),
    m('wed-din',   '8:00 PM',  20*60,    'Dinner', 'Grilled Fish (150g) + 1 cup Rice + Stir Fried Veg', 480, 38, 50, 12),
  ],
  thu: [
    m('thu-pre',   '7:15 AM',  7*60+15,  'Pre-Workout Snack', 'Banana + Black Coffee', 120, 1, 28, 0.5),
    m('thu-post',  '9:15 AM',  9*60+15,  'Post-Workout Whey', '1 scoop whey in water', 125, 25, 5, 1),
    m('thu-bf',    '10:00 AM', 10*60,    'Breakfast', '3 Egg Omelette (spinach+onion) + 2 WW Toast', 430, 30, 35, 16),
    m('thu-lun',   '1:30 PM',  13*60+30, 'Lunch', 'Chicken Curry (200g) + 1 cup Rice', 560, 44, 55, 18),
    m('thu-eve',   '5:00 PM',  17*60,    'Evening Snack', 'Peanut Butter (1.5 tbsp) + 2 Rice Cakes', 250, 8, 28, 12),
    m('thu-din',   '8:00 PM',  20*60,    'Dinner', 'Dal Tadka + 2 Rotis + Curd', 520, 26, 70, 10),
  ],
  fri: [
    m('fri-bf',    '8:00 AM',  8*60,     'Breakfast', 'Egg Bhurji (3 eggs) + 2 WW Toast + Coffee', 420, 28, 35, 16),
    m('fri-lun',   '1:30 PM',  13*60+30, 'Lunch', 'Chicken Rice Bowl + Salad', 550, 45, 55, 12),
    m('fri-eve',   '5:00 PM',  17*60,    'Evening Snack', 'Greek Yogurt + Banana', 230, 15, 32, 5),
    m('fri-pre',   '7:30 PM',  19*60+30, 'Pre-Match Light Meal', '2 Rotis + Dal (light, easy digest)', 380, 16, 60, 8),
    m('fri-post',  '10:45 PM', 22*60+45, 'Post-Match Whey', '1 scoop whey in water (recovery)', 125, 25, 5, 1),
  ],
  sat: [
    m('sat-bf',    '8:30 AM',  8*60+30,  'Breakfast', 'Idli (3) + Sambar + Masala Chaas', 360, 14, 55, 6),
    m('sat-lun',   '1:30 PM',  13*60+30, 'Lunch', 'Dal Makhani + 2 Rotis + Salad', 560, 24, 70, 18),
    m('sat-eve',   '5:00 PM',  17*60,    'Evening Snack', 'Whey Shake + 1 Fruit', 220, 26, 20, 1),
    m('sat-din',   '8:30 PM',  20*60+30, 'Dinner', 'Grilled Chicken (180g) + Stir Fried Veg + 1 Roti', 480, 40, 35, 12),
  ],
  sun: [
    m('sun-bf',    '9:00 AM',  9*60,     'Breakfast', 'Veg Poha + 2 Boiled Eggs + Chai', 420, 20, 60, 12),
    m('sun-lun',   '2:00 PM',  14*60,    'Lunch', 'Butter Chicken + 1 cup Rice', 530, 36, 50, 16),
    m('sun-eve',   '5:30 PM',  17*60+30, 'Evening Snack', 'Whey Shake + Mixed Nuts', 280, 28, 10, 12),
    m('sun-din',   '8:30 PM',  20*60+30, 'Dinner', 'Moong Dal + 2 Rotis + Curd + Salad', 500, 24, 65, 10),
  ]
}

/* ---------------------------------------------------------------------------
   Snack data
--------------------------------------------------------------------------- */
const SNACKS = {
  'High Protein': [
    { name: 'Boiled Eggs (2)',     calories: 140, protein: 12, carbs: 1,  fat: 10, timing: 'Post-workout / anytime' },
    { name: 'Greek Yogurt (200g)', calories: 130, protein: 12, carbs: 10, fat: 4,  timing: 'Pre-bed / evening' },
    { name: 'Paneer Cubes (100g)', calories: 265, protein: 18, carbs: 3,  fat: 20, timing: 'Afternoon snack' },
    { name: 'Whey + Banana',       calories: 250, protein: 27, carbs: 30, fat: 2,  timing: 'Post-workout' },
    { name: 'Chicken Breast (100g)', calories: 165, protein: 31, carbs: 0, fat: 4, timing: 'Anytime' },
  ],
  'Pre-Workout': [
    { name: 'Banana + Black Coffee',        calories: 120, protein: 1, carbs: 28, fat: 0.5, timing: '30 min before session' },
    { name: 'Apple + Handful Almonds',      calories: 200, protein: 5, carbs: 30, fat: 10,  timing: '30–45 min before' },
    { name: '2 Rice Cakes + Peanut Butter', calories: 220, protein: 7, carbs: 28, fat: 8,   timing: '30 min before' },
    { name: 'Dates (3–4) + Water',          calories: 90,  protein: 1, carbs: 22, fat: 0.2, timing: '15 min before match' },
  ],
  'Evening / Pre-Bed': [
    { name: 'Masala Chaas (250ml)',    calories: 50,  protein: 3, carbs: 5,  fat: 1,  timing: 'After dinner' },
    { name: 'Mixed Nuts (30g)',        calories: 180, protein: 5, carbs: 8,  fat: 15, timing: 'Evening snack' },
    { name: 'Roasted Chana (40g)',     calories: 150, protein: 9, carbs: 24, fat: 3,  timing: 'Afternoon / evening' },
    { name: 'Curd (1 cup) + Jeera',    calories: 100, protein: 6, carbs: 8,  fat: 4,  timing: 'Post dinner' },
    { name: 'Milk (1 cup) + Turmeric', calories: 150, protein: 8, carbs: 12, fat: 5,  timing: 'Pre-bed' },
  ],
  'Calorie Boost': [
    { name: 'Peanut Butter (2 tbsp)', calories: 190, protein: 8,  carbs: 6,  fat: 16, timing: 'When 300+ kcal short' },
    { name: 'Whole Milk (250ml)',     calories: 150, protein: 8,  carbs: 12, fat: 8,  timing: 'Any time of day' },
    { name: 'Banana + Whey Shake',    calories: 250, protein: 27, carbs: 30, fat: 2,  timing: 'Post workout' },
    { name: 'Avocado Toast (1 slice)', calories: 220, protein: 5, carbs: 22, fat: 14, timing: 'Breakfast add-on' },
  ]
}

/* ---------------------------------------------------------------------------
   Date helpers
--------------------------------------------------------------------------- */
const todayISO = () => {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}
const isoToDayKey = (iso) => {
  // JS getDay: 0=Sun..6=Sat. Map to our day keys.
  const d = new Date(iso + 'T00:00:00')
  const map = ['sun','mon','tue','wed','thu','fri','sat']
  return map[d.getDay()]
}
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}
const startOfWeekISO = (iso) => {
  // Week starts on Monday
  const d = new Date(iso + 'T00:00:00')
  const day = d.getDay() // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}
const fmtShort = (iso) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/* ---------------------------------------------------------------------------
   Color logic for actual vs planned
--------------------------------------------------------------------------- */
const diffColor = (actual, planned) => {
  if (planned <= 0) return 'text-zinc-400'
  const pct = Math.abs(actual - planned) / planned
  if (pct <= 0.10) return 'text-[#34d399]'
  if (pct <= 0.20) return 'text-[#fbbf24]'
  return 'text-[#f87171]'
}

/* ---------------------------------------------------------------------------
   UI primitives + theme tokens
--------------------------------------------------------------------------- */
const THEME = {
  bg:       '#0a0a0b',
  surface:  '#16161c',
  surface2: '#1f1f28',
  border:   'rgba(255,255,255,0.07)',
  text:     '#f4f4f5',
  text2:    '#a1a1aa',
  text3:    '#71717a',
  accent:   '#d7ff3a',   // electric lime — primary CTA
  mint:     '#34d399',   // success / on-track
  cyan:     '#22d3ee',   // protein / recovery
  amber:    '#fbbf24',   // carbs / warning
  violet:   '#a78bfa',   // fat
  coral:    '#f87171',   // over / danger
  planned:  '#52525b'    // planned bars (dim slate, dark mode)
}

const Card = ({ children, className = '' }) => (
  <div className={`bg-[#16161c]/90 backdrop-blur rounded-3xl border border-white/[0.07] shadow-xl shadow-black/40 ${className}`}>{children}</div>
)

/* ---------------------------------------------------------------------------
   Confetti — emoji rain. Mounted with a fresh `key` on each celebration so
   the animation restarts. Auto-cleans after the longest particle lifetime.
--------------------------------------------------------------------------- */
const CONFETTI_EMOJIS = ['🎉', '✨', '🔥', '⭐', '💪', '🚀']
const Confetti = ({ emojis = CONFETTI_EMOJIS, count = 28 }) => {
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    left: Math.random() * 100,
    delay: Math.random() * 250,
    duration: 1600 + Math.random() * 1200,
    dx: (Math.random() - 0.5) * 240,
    rot: (Math.random() - 0.5) * 1080,
    size: 18 + Math.random() * 14
  })), [count, emojis])
  const [done, setDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 3200)
    return () => clearTimeout(t)
  }, [])
  if (done) return null
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: '-10%',
            fontSize: `${p.size}px`,
            animation: `confettiFall ${p.duration}ms ${p.delay}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
            ['--dx']: `${p.dx}px`,
            ['--rot']: `${p.rot}deg`
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Time-based greeting for the header
--------------------------------------------------------------------------- */
const greetingFor = (name) => {
  const h = new Date().getHours()
  const first = (name || 'there').split(' ')[0]
  if (h < 5)  return { text: `Late night, ${first}`,  emoji: '🌙' }
  if (h < 12) return { text: `GM, ${first}`,           emoji: '☀️' }
  if (h < 17) return { text: `Afternoon, ${first}`,    emoji: '🥗' }
  if (h < 22) return { text: `Evening, ${first}`,      emoji: '🌆' }
  return       { text: `Late night, ${first}`,         emoji: '🌙' }
}

/* ---------------------------------------------------------------------------
   Animated count-up hook — eases displayed number from previous value
   to current over `duration` ms using easeOutCubic. Avoids jumpy jumps.
--------------------------------------------------------------------------- */
const useCountUp = (value, duration = 700) => {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)
  const rafRef = useRef(null)
  useEffect(() => {
    const from = prev.current
    const to = value
    if (from === to) return
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = from + (to - from) * eased
      setDisplay(next)
      // Track the actually-rendered value so a mid-flight value change
      // continues smoothly from where we are, not from the old `from`.
      prev.current = next
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        prev.current = to
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])
  return display
}

/* ---------------------------------------------------------------------------
   Ring — SVG progress ring with smooth animated fill
   - size: outer diameter
   - stroke: ring thickness
   - children render in the center
--------------------------------------------------------------------------- */
const Ring = ({ size, stroke, value, target, color, children, glow = true }) => {
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0
  const offset = C * (1 - pct)
  const over = target > 0 && value > target
  const ringColor = over ? '#f87171' : color
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={ringColor} strokeWidth={stroke}
                strokeDasharray={C}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1), stroke 300ms',
                  filter: glow ? `drop-shadow(0 0 6px ${ringColor}66)` : undefined
                }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

const SatelliteRing = ({ label, value, target, planned, color, unit = 'g' }) => {
  const [flipped, setFlipped] = useState(false)
  const v = useCountUp(value)
  const p = useCountUp(planned)
  const diff = Math.round(value - planned)
  const diffColor = diff === 0 ? '#a1a1aa' : diff > 0 ? '#fbbf24' : '#71717a'
  return (
    <button
      type="button"
      onClick={() => setFlipped(f => !f)}
      className="flex flex-col items-center gap-1.5 active:scale-95 transition"
      aria-label={`Toggle ${label} planned vs logged`}
    >
      <Ring size={72} stroke={6} value={value} target={target} color={color}>
        <div className="relative w-full h-full flex items-center justify-center">
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${flipped ? 'opacity-0' : 'opacity-100'}`}>
            <div className="text-center leading-none">
              <div className="text-sm font-display font-bold tabular-nums" style={{ color }}>
                {Math.round(v)}<span className="text-[8px] text-zinc-500 font-normal">{unit}</span>
              </div>
              <div className="text-[8px] text-zinc-500 mt-1 tabular-nums">/{Math.round(target)}{unit}</div>
            </div>
          </div>
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${flipped ? 'opacity-100' : 'opacity-0'}`}>
            <div className="text-center leading-none">
              <div className="text-[8px] uppercase tracking-wider text-zinc-500 mb-1">Plan</div>
              <div className="text-sm font-display font-bold tabular-nums text-zinc-200">
                {Math.round(p)}<span className="text-[8px] text-zinc-500 font-normal">{unit}</span>
              </div>
              <div className="text-[8px] mt-1 tabular-nums font-semibold" style={{ color: diffColor }}>
                {diff > 0 ? '+' : ''}{diff}{unit}
              </div>
            </div>
          </div>
        </div>
      </Ring>
      <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color }}>{label}</div>
    </button>
  )
}

/* ---------------------------------------------------------------------------
   Streak — count consecutive recent days where the protein target was met.
   Today is fully forgiving: whether unlogged OR logged-but-not-yet-at-target,
   today never breaks the streak — it simply isn't counted until it hits.
   Past days must hit the target to count; otherwise the chain breaks.
--------------------------------------------------------------------------- */
const computeProteinStreak = (logs, proteinMin) => {
  let streak = 0
  let cursor = todayISO()
  const today = cursor
  for (let i = 0; i < 365; i++) {
    const dayKey = isoToDayKey(cursor)
    const plan = WEEK_PLAN[dayKey]
    const dayLog = logs[cursor]
    if (dayLog?.cheatDay) { cursor = addDays(cursor, -1); continue } // cheat days don't break or count
    const hasAnyLog = dayLog && dayLog.meals && dayLog.meals.length > 0
    const totals = hasAnyLog ? sumLogged(dayLog, plan) : null
    const hit = totals && totals.protein >= proteinMin

    if (cursor === today && !hit) {
      // Today is forgiving — partial/unlogged today doesn't break the chain.
      cursor = addDays(cursor, -1)
      continue
    }
    if (!hit) break
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

/* ---------------------------------------------------------------------------
   Reducers / log helpers
--------------------------------------------------------------------------- */
const ensureDayLog = (logs, date) => {
  if (!logs[date]) return { ...logs, [date]: { meals: [], water: 0 } }
  return logs
}

const findLogForMeal = (logs, date, mealId) => {
  const day = logs[date]
  if (!day) return null
  return day.meals.find(x => x.mealId === mealId) || null
}

const upsertMealLog = (logs, date, mealLog) => {
  const next = ensureDayLog(logs, date)
  const day = { ...next[date] }
  const idx = day.meals.findIndex(x => x.mealId === mealLog.mealId)
  if (idx >= 0) {
    const meals = [...day.meals]; meals[idx] = mealLog; day.meals = meals
  } else {
    day.meals = [...day.meals, mealLog]
  }
  return { ...next, [date]: day }
}

const upsertWorkout = (logs, date, workout) => {
  const next = ensureDayLog(logs, date)
  const day = { ...next[date], workouts: next[date].workouts || [] }
  const idx = day.workouts.findIndex(w => w.id === workout.id)
  if (idx >= 0) {
    const ws = [...day.workouts]; ws[idx] = workout; day.workouts = ws
  } else {
    day.workouts = [...day.workouts, workout]
  }
  return { ...next, [date]: day }
}

const removeWorkoutById = (logs, date, workoutId) => {
  const day = logs[date]
  if (!day || !day.workouts) return logs
  return { ...logs, [date]: { ...day, workouts: day.workouts.filter(w => w.id !== workoutId) } }
}

const sumLogged = (dayLog, plan) => {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  if (!dayLog) return totals
  for (const meal of dayLog.meals) {
    if (meal.status === 'skipped') continue
    if (meal.status === 'eaten_as_planned') {
      const planned = plan.find(p => p.id === meal.mealId)
      if (planned) {
        totals.calories += planned.calories
        totals.protein += planned.protein
        totals.carbs += planned.carbs
        totals.fat += planned.fat
      }
    } else if (meal.status === 'logged_actual' || meal.status === 'extra') {
      totals.calories += Number(meal.calories) || 0
      totals.protein += Number(meal.protein) || 0
      totals.carbs += Number(meal.carbs) || 0
      totals.fat += Number(meal.fat) || 0
    }
  }
  return totals
}

const sumPlanned = (plan) => plan.reduce((acc, p) => ({
  calories: acc.calories + p.calories,
  protein:  acc.protein + p.protein,
  carbs:    acc.carbs + p.carbs,
  fat:      acc.fat + p.fat
}), { calories: 0, protein: 0, carbs: 0, fat: 0 })

/* ---------------------------------------------------------------------------
   Log Form
--------------------------------------------------------------------------- */
const LogForm = ({ initial, onSubmit, onCancel, title }) => {
  const [form, setForm] = useState({
    loggedFood: initial?.loggedFood || '',
    calories: initial?.calories ?? '',
    protein:  initial?.protein  ?? '',
    carbs:    initial?.carbs    ?? '',
    fat:      initial?.fat      ?? '',
    note:     initial?.note     || ''
  })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const submit = (e) => {
    e.preventDefault()
    if (!form.loggedFood.trim()) return
    onSubmit({
      loggedFood: form.loggedFood.trim(),
      calories: Number(form.calories) || 0,
      protein:  Number(form.protein)  || 0,
      carbs:    Number(form.carbs)    || 0,
      fat:      Number(form.fat)      || 0,
      note:     form.note.trim()
    })
  }
  const inputCls = "w-full mt-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#d7ff3a]/50 focus:bg-white/[0.07] transition"
  const labelCls = "text-[10px] uppercase tracking-wide text-zinc-500 font-medium"
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-xl font-display font-bold text-white">{title}</h3>
      <div>
        <label className={labelCls}>Food name</label>
        <input value={form.loggedFood} onChange={set('loggedFood')} className={inputCls} placeholder="e.g. 3 eggs + toast" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Calories</label>
          <input type="number" value={form.calories} onChange={set('calories')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Protein (g)</label>
          <input type="number" value={form.protein} onChange={set('protein')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Carbs (g)</label>
          <input type="number" value={form.carbs} onChange={set('carbs')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Fat (g)</label>
          <input type="number" value={form.fat} onChange={set('fat')} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Note (optional)</label>
        <textarea value={form.note} onChange={set('note')} rows={2} className={inputCls} />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 transition">Cancel</button>
        <button type="submit" className="px-4 py-2.5 text-sm rounded-xl bg-[#d7ff3a] text-black font-semibold hover:bg-[#c6ee29] active:scale-[0.98] transition">Save log</button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------------------
   Workout form — type, duration, intensity, note
--------------------------------------------------------------------------- */
const WorkoutForm = ({ initial, prefill, onSubmit, onCancel, title = 'Log workout' }) => {
  const [form, setForm] = useState({
    type:        initial?.type        ?? prefill?.type        ?? '',
    durationMin: initial?.durationMin ?? prefill?.durationMin ?? '',
    intensity:   initial?.intensity   ?? 'moderate',
    note:        initial?.note        ?? ''
  })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const submit = (e) => {
    e.preventDefault()
    if (!form.type.trim()) return
    onSubmit({
      type: form.type.trim(),
      durationMin: Number(form.durationMin) || 0,
      intensity: form.intensity,
      note: form.note.trim()
    })
  }
  const inputCls = "w-full mt-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#d7ff3a]/50 focus:bg-white/[0.07] transition"
  const labelCls = "text-[10px] uppercase tracking-wide text-zinc-500 font-medium"
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-xl font-display font-bold text-white">{title}</h3>
      <div>
        <label className={labelCls}>Type</label>
        <input list="workout-options" value={form.type} onChange={set('type')} className={inputCls} placeholder="e.g. Badminton, Football, Gym" autoFocus />
        <datalist id="workout-options">
          {COMMON_WORKOUTS.map(w => <option key={w} value={w} />)}
        </datalist>
      </div>
      <div>
        <label className={labelCls}>Duration (min)</label>
        <input type="number" inputMode="numeric" value={form.durationMin} onChange={set('durationMin')} className={inputCls} placeholder="60" />
      </div>
      <div>
        <label className={labelCls}>Intensity</label>
        <div className="grid grid-cols-3 gap-1 mt-1 bg-white/5 p-1 rounded-xl border border-white/10">
          {INTENSITY_OPTS.map(i => (
            <button
              key={i.key} type="button"
              onClick={() => setForm(f => ({ ...f, intensity: i.key }))}
              className={`text-xs py-1.5 rounded-lg font-semibold transition ${form.intensity === i.key ? 'bg-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
              style={form.intensity === i.key ? { color: i.color } : {}}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>Note (optional)</label>
        <textarea value={form.note} onChange={set('note')} rows={2} className={inputCls} />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 transition">Cancel</button>
        <button type="submit" className="px-4 py-2.5 text-sm rounded-xl bg-[#d7ff3a] text-black font-semibold hover:bg-[#c6ee29] active:scale-[0.98] transition">Save workout</button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------------------
   Quick-log chooser — pops when the floating + is tapped
--------------------------------------------------------------------------- */
const LogChooser = ({ onPickFood, onPickWorkout }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-display font-bold text-white">Quick log</h3>
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onPickFood}
        className="aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition"
      >
        <span className="text-4xl">🍴</span>
        <span className="text-sm font-semibold text-zinc-100">Food</span>
        <span className="text-[10px] text-zinc-500 px-3 text-center">Extra meal or snack</span>
      </button>
      <button
        onClick={onPickWorkout}
        className="aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition"
      >
        <span className="text-4xl">🏋️</span>
        <span className="text-sm font-semibold text-zinc-100">Workout</span>
        <span className="text-[10px] text-zinc-500 px-3 text-center">Activity / exercise</span>
      </button>
    </div>
  </div>
)

/* ---------------------------------------------------------------------------
   Food search modal — local DB first, Open Food Facts fallback
--------------------------------------------------------------------------- */
const FoodSearchModal = ({ onAdd, onClose }) => {
  const [tab, setTab] = useState('search') // 'search' | 'manual' | 'scan'
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [grams, setGrams] = useState('100')
  const [offResults, setOffResults] = useState([])
  const [offLoading, setOffLoading] = useState(false)
  const [basket, setBasket] = useState([])
  const [manual, setManual] = useState({ name: '', cal: '', protein: '', carbs: '', fat: '' })
  const [scanLoading, setScanLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [scanPreview, setScanPreview] = useState(null)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { if (!selected) inputRef.current?.focus() }, [selected])

  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return FOODS
      .filter(f => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
      .sort((a, b) => {
        const ai = a.name.toLowerCase().indexOf(q)
        const bi = b.name.toLowerCase().indexOf(q)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      .slice(0, 8)
  }, [query])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) { setOffResults([]); return }
    clearTimeout(debounceRef.current)
    setOffLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&api_key=DEMO_KEY&pageSize=8&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`
        )
        const data = await res.json()
        const get = (nutrients, id) => nutrients?.find(n => n.nutrientId === id)?.value || 0
        const parsed = (data.foods || [])
          .map((f, i) => ({
            id: `usda-${f.fdcId || i}`,
            name: f.description,
            category: f.foodCategory || 'USDA',
            cal:     Math.round(get(f.foodNutrients, 1008)),
            protein: Math.round(get(f.foodNutrients, 1003) * 10) / 10,
            carbs:   Math.round(get(f.foodNutrients, 1005) * 10) / 10,
            fat:     Math.round(get(f.foodNutrients, 1004) * 10) / 10,
            source: 'usda',
          }))
          .filter(f => f.cal > 0)
          .slice(0, 6)
        setOffResults(parsed)
      } catch { setOffResults([]) }
      finally { setOffLoading(false) }
    }, 650)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const allResults = selected ? [] : [...localResults, ...offResults] // kept for empty-state check
  const hasPieces = !!selected?.serving
  const [mode, setMode] = useState('pieces')
  const [qty, setQty] = useState('2')
  useEffect(() => {
    if (selected) { setMode(selected.serving ? 'pieces' : 'grams'); setQty('2'); setGrams('100') }
  }, [selected?.id])

  const gramsVal = mode === 'pieces' && hasPieces
    ? Math.max(1, Math.round((Number(qty) || 1) * selected.serving.weight))
    : Math.max(1, Number(grams) || 1)

  const scaled = selected ? {
    cal:     Math.round(selected.cal     * gramsVal / 100),
    protein: Math.round(selected.protein * gramsVal / 100 * 10) / 10,
    carbs:   Math.round(selected.carbs   * gramsVal / 100 * 10) / 10,
    fat:     Math.round(selected.fat     * gramsVal / 100 * 10) / 10,
  } : null

  const addToBasket = () => {
    if (!selected) return
    const qtyNum = Number(qty) || 1
    const label = mode === 'pieces' && hasPieces
      ? `${qtyNum} ${selected.serving.label}${qtyNum !== 1 ? 's' : ''}`
      : `${gramsVal}g`
    const displayName = mode === 'pieces' && hasPieces
      ? `${qtyNum} ${selected.name}`
      : selected.name
    setBasket(b => [...b, {
      id: `${selected.id}-${Date.now()}`,
      name: selected.name,
      displayName,
      label,
      grams: gramsVal,
      ...scaled,
    }])
    setSelected(null)
    setQuery('')
    setGrams('100')
    setQty('2')
  }

  const addManualToBasket = () => {
    if (!manual.name.trim()) return
    const trimmed = manual.name.trim()
    setBasket(b => [...b, {
      id: `manual-${Date.now()}`,
      name: trimmed,
      displayName: trimmed,
      label: 'manual',
      grams: 0,
      cal:     Number(manual.cal)     || 0,
      protein: Number(manual.protein) || 0,
      carbs:   Number(manual.carbs)   || 0,
      fat:     Number(manual.fat)     || 0,
    }])
    setManual({ name: '', cal: '', protein: '', carbs: '', fat: '' })
  }

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setScanResult(null)
    setScanError('')
    setScanPreview(URL.createObjectURL(file))
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1]
      setScanLoading(true)
      try {
        const res = await fetch('/api/analyze-meal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType: file.type })
        })
        if (!res.ok) throw new Error('API error')
        const data = await res.json()
        setScanResult(data)
      } catch {
        setScanError('Could not analyse the photo. Please try again or enter manually.')
      } finally {
        setScanLoading(false)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const addScanToBasket = () => {
    if (!scanResult) return
    setBasket(b => [...b, {
      id: `scan-${Date.now()}`,
      name: scanResult.name,
      displayName: scanResult.name,
      label: 'photo',
      grams: 0,
      cal:     scanResult.cal     || 0,
      protein: scanResult.protein || 0,
      carbs:   scanResult.carbs   || 0,
      fat:     scanResult.fat     || 0,
    }])
    setScanResult(null)
    setScanPreview(null)
    setTab('search')
  }

  const removeFromBasket = (id) => setBasket(b => b.filter(x => x.id !== id))

  const total = basket.reduce((acc, x) => ({
    cal:     acc.cal     + x.cal,
    protein: Math.round((acc.protein + x.protein) * 10) / 10,
    carbs:   Math.round((acc.carbs   + x.carbs)   * 10) / 10,
    fat:     Math.round((acc.fat     + x.fat)     * 10) / 10,
  }), { cal: 0, protein: 0, carbs: 0, fat: 0 })

  const logAll = () => {
    if (basket.length === 0) return
    onAdd(basket)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-white">
          {selected ? 'Set quantity' : 'Log meal'}
        </h3>
        {selected && (
          <button onClick={() => { setSelected(null); setGrams('100') }}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition px-2 py-1 rounded-lg bg-white/5">
            ← Back
          </button>
        )}
      </div>

      {/* Tab toggle — only when not in the quantity-picker step */}
      {!selected && (
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
          <button onClick={() => setTab('search')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${tab === 'search' ? 'bg-[#d7ff3a] text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>
            Search DB
          </button>
          <button onClick={() => setTab('manual')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${tab === 'manual' ? 'bg-[#d7ff3a] text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>
            Manual
          </button>
          <button onClick={() => setTab('scan')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${tab === 'scan' ? 'bg-[#d7ff3a] text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>
            📷 Scan
          </button>
        </div>
      )}

      {/* Basket */}
      {basket.length > 0 && !selected && (
        <div className="space-y-1.5">
          {basket.map(item => (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/[0.07]">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-100 truncate">{item.name}</div>
                <div className="text-[10px] text-zinc-500 tabular-nums">{item.label || `${item.grams}g`} · {item.cal} kcal</div>
              </div>
              <button onClick={() => removeFromBasket(item.id)} className="ml-3 text-zinc-600 hover:text-[#f87171] transition text-lg leading-none">×</button>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#d7ff3a]/5 border border-[#d7ff3a]/20">
            <span className="text-xs font-semibold text-[#d7ff3a]">Total ({basket.length} items)</span>
            <span className="text-xs tabular-nums text-zinc-300">
              {total.cal} kcal · P{total.protein}g · C{total.carbs}g · F{total.fat}g
            </span>
          </div>
        </div>
      )}

      {!selected ? (
        <>
          {tab === 'search' && (
            <>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={basket.length > 0 ? 'Add another item…' : 'Search dal makhani, pasta, banana…'}
                className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#d7ff3a]/50 transition"
              />

              {query.trim().length === 0 && basket.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-2">Type a food name to search</p>
              )}

              {(localResults.length > 0 || offResults.length > 0) && (
                <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                  {localResults.length > 0 && (
                    <>
                      <div className="px-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">My database</div>
                      {localResults.map(f => (
                        <button key={f.id} onClick={() => { setSelected(f); setGrams('100') }}
                          className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl bg-white/5 border border-white/[0.07] hover:bg-white/10 active:scale-[0.98] transition text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-zinc-100 truncate">{f.name}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">{f.category} · per 100g</div>
                          </div>
                          <div className="shrink-0 text-right ml-3">
                            <div className="text-sm font-semibold text-[#d7ff3a] tabular-nums">{f.cal} kcal</div>
                            <div className="text-[10px] text-zinc-500 tabular-nums">P{f.protein} C{f.carbs} F{f.fat}</div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  {offResults.length > 0 && (
                    <>
                      <div className="px-1 pt-1 text-[10px] font-semibold text-[#22d3ee] uppercase tracking-wider">🌐 Online (USDA FoodData)</div>
                      {offResults.map(f => (
                        <button key={f.id} onClick={() => { setSelected(f); setGrams('100') }}
                          className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl bg-[#22d3ee]/5 border border-[#22d3ee]/10 hover:bg-[#22d3ee]/10 active:scale-[0.98] transition text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-zinc-100 truncate">{f.name}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">{f.category} · per 100g</div>
                          </div>
                          <div className="shrink-0 text-right ml-3">
                            <div className="text-sm font-semibold text-[#d7ff3a] tabular-nums">{f.cal} kcal</div>
                            <div className="text-[10px] text-zinc-500 tabular-nums">P{f.protein} C{f.carbs} F{f.fat}</div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {offLoading && <p className="text-xs text-zinc-500 text-center py-1 animate-pulse">Searching online…</p>}
              {query.trim().length >= 3 && !offLoading && allResults.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-2">No results found. Try a different name.</p>
              )}
            </>
          )}

          {tab === 'manual' && (
            <div className="space-y-3">
              <input
                type="text"
                value={manual.name}
                onChange={e => setManual(m => ({ ...m, name: e.target.value }))}
                placeholder="Food name (e.g. Home-made poha)"
                className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#d7ff3a]/50 transition"
              />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'cal',     label: 'Calories (kcal)', color: '#d7ff3a' },
                  { key: 'protein', label: 'Protein (g)',     color: '#22d3ee' },
                  { key: 'carbs',   label: 'Carbs (g)',       color: '#fbbf24' },
                  { key: 'fat',     label: 'Fat (g)',         color: '#a78bfa' },
                ].map(({ key, label, color }) => (
                  <div key={key}>
                    <label className="block text-[10px] mb-1 font-medium" style={{ color }}>{label}</label>
                    <input
                      type="number" min={0}
                      value={manual[key]}
                      onChange={e => setManual(m => ({ ...m, [key]: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#d7ff3a]/50 transition tabular-nums"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={addManualToBasket}
                disabled={!manual.name.trim()}
                className="w-full py-2.5 rounded-xl bg-white/10 border border-white/10 text-zinc-200 text-sm font-semibold hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                + Add to meal
              </button>
            </div>
          )}

          {tab === 'scan' && (
            <div className="space-y-4">
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhoto}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
              />

              {/* Idle state — no preview yet */}
              {!scanPreview && !scanLoading && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl">📷</div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-200">Take a photo of your meal</p>
                    <p className="text-xs text-zinc-500 mt-1">Claude will estimate the calories and macros</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => cameraRef.current?.click()}
                      className="px-5 py-2.5 rounded-xl bg-[#d7ff3a] text-black text-sm font-semibold hover:bg-[#c6ee29] transition"
                    >
                      📷 Camera
                    </button>
                    <button
                      onClick={() => galleryRef.current?.click()}
                      className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/10 text-zinc-200 text-sm font-semibold hover:bg-white/15 transition"
                    >
                      🖼️ Gallery
                    </button>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {scanLoading && (
                <div className="flex flex-col items-center gap-3 py-6">
                  {scanPreview && (
                    <img src={scanPreview} alt="meal" className="w-full max-h-48 object-cover rounded-2xl opacity-60" />
                  )}
                  <div className="flex items-center gap-2 text-sm text-zinc-400 animate-pulse">
                    <span className="text-lg">✨</span> Analysing your meal…
                  </div>
                </div>
              )}

              {/* Result state */}
              {scanResult && !scanLoading && (
                <div className="space-y-3">
                  {scanPreview && (
                    <img src={scanPreview} alt="meal" className="w-full max-h-40 object-cover rounded-2xl" />
                  )}
                  <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.07]">
                    <div className="text-sm font-semibold text-zinc-100">{scanResult.name}</div>
                    {scanResult.breakdown && (
                      <div className="text-xs text-zinc-500 mt-1 leading-relaxed">{scanResult.breakdown}</div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Cal',     value: scanResult.cal,     unit: 'kcal', color: '#d7ff3a' },
                      { label: 'Protein', value: scanResult.protein, unit: 'g',    color: '#22d3ee' },
                      { label: 'Carbs',   value: scanResult.carbs,   unit: 'g',    color: '#fbbf24' },
                      { label: 'Fat',     value: scanResult.fat,     unit: 'g',    color: '#a78bfa' },
                    ].map(({ label, value, unit, color }) => (
                      <div key={label} className="flex flex-col items-center py-2.5 rounded-xl bg-white/5 border border-white/[0.07]">
                        <span className="text-base font-bold tabular-nums" style={{ color }}>{value}</span>
                        <span className="text-[9px] text-zinc-500 mt-0.5">{unit}</span>
                        <span className="text-[9px] text-zinc-600">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setScanResult(null); setScanPreview(null); setScanError('') }}
                      className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm hover:bg-white/5 transition"
                    >
                      Retry
                    </button>
                    <button
                      onClick={addScanToBasket}
                      className="flex-1 py-2.5 rounded-xl bg-[#d7ff3a] text-black text-sm font-semibold hover:bg-[#c6ee29] transition"
                    >
                      + Add to meal
                    </button>
                  </div>
                </div>
              )}

              {/* Error state */}
              {scanError && !scanLoading && !scanResult && (
                <div className="space-y-3">
                  <div className="px-4 py-3 rounded-2xl bg-[#f87171]/10 border border-[#f87171]/20 text-xs text-[#f87171] leading-relaxed">
                    {scanError}
                  </div>
                  <button
                    onClick={() => { setScanError(''); cameraRef.current?.click() }}
                    className="w-full py-2.5 rounded-xl bg-white/10 border border-white/10 text-zinc-200 text-sm font-semibold hover:bg-white/15 transition"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {basket.length > 0 && (
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm hover:bg-white/5 transition">Cancel</button>
              <button onClick={logAll} className="flex-1 py-2.5 rounded-xl bg-[#d7ff3a] text-black text-sm font-semibold hover:bg-[#c6ee29] transition">
                Log meal ({basket.length})
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/[0.07]">
            <div className="text-base font-semibold text-white">{selected.name}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{selected.category}</div>
          </div>

          {/* Mode toggle — only shown for piece-countable foods */}
          {hasPieces && (
            <div className="flex gap-1.5 p-1 bg-white/5 rounded-xl">
              <button onClick={() => setMode('pieces')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${mode === 'pieces' ? 'bg-[#d7ff3a] text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>
                By piece
              </button>
              <button onClick={() => setMode('grams')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${mode === 'grams' ? 'bg-[#d7ff3a] text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>
                By grams
              </button>
            </div>
          )}

          {mode === 'pieces' && hasPieces ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-zinc-400 font-medium">How many {selected.serving.label}s?</label>
                <span className="text-[10px] text-zinc-500 tabular-nums">= {gramsVal}g</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(q => String(Math.max(1, (Number(q) || 1) - 1)))}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-zinc-200 text-xl hover:bg-white/10 active:scale-95 transition flex items-center justify-center">−</button>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} min={1}
                  className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-center text-lg font-bold text-zinc-100 focus:outline-none focus:border-[#d7ff3a]/50 transition tabular-nums" />
                <button onClick={() => setQty(q => String((Number(q) || 1) + 1))}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-zinc-200 text-xl hover:bg-white/10 active:scale-95 transition flex items-center justify-center">+</button>
              </div>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setQty(String(n))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${Number(qty) === n ? 'bg-[#d7ff3a] text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Quantity (grams)</label>
              <input type="number" value={grams} onChange={e => setGrams(e.target.value)} min={1}
                className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-[#d7ff3a]/50 transition tabular-nums" />
              <div className="flex gap-2 mt-2">
                {[50, 100, 150, 200, 250].map(g => (
                  <button key={g} onClick={() => setGrams(String(g))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${gramsVal === g ? 'bg-[#d7ff3a] text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
                    {g}g
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Calories', val: scaled.cal,     unit: 'kcal', color: '#d7ff3a' },
              { label: 'Protein',  val: scaled.protein, unit: 'g',    color: '#22d3ee' },
              { label: 'Carbs',    val: scaled.carbs,   unit: 'g',    color: '#fbbf24' },
              { label: 'Fat',      val: scaled.fat,     unit: 'g',    color: '#a78bfa' },
            ].map(({ label, val, unit, color }) => (
              <div key={label} className="flex flex-col items-center py-3 rounded-xl bg-white/5 border border-white/[0.07]">
                <div className="text-lg font-display font-bold tabular-nums" style={{ color }}>{val}</div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-wide mt-0.5">{unit}</div>
                <div className="text-[9px] text-zinc-600 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setSelected(null); setGrams('100') }}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm hover:bg-white/5 transition">
              ← Back
            </button>
            <button onClick={addToBasket}
              className="flex-1 py-2.5 rounded-xl bg-[#d7ff3a] text-black text-sm font-semibold hover:bg-[#c6ee29] transition">
              Add to meal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Activity card — planned workout for the day + ad-hoc workouts
--------------------------------------------------------------------------- */
const intensityColor = (k) => INTENSITY_OPTS.find(i => i.key === k)?.color || '#a1a1aa'

const ActivityCard = ({ dayKey, dayLog, onMarkDone, onSkip, onAddWorkout, onRemoveWorkout, onEditWorkout }) => {
  const activity = ACTIVITY[dayKey]
  const workouts = dayLog?.workouts || []
  const planned = workouts.find(w => w.id === 'planned')
  const adHoc   = workouts.filter(w => w.id !== 'planned')
  const isRestDay = !activity.type
  const plannedDone    = planned?.status === 'done'
  const plannedSkipped = planned?.status === 'skipped'

  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Activity</div>
      </div>

      {isRestDay ? (
        <div className="flex items-center gap-3">
          <div className="text-2xl shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">{activity.emoji}</div>
          <div className="text-sm text-zinc-300 flex-1">{activity.label}</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 font-semibold">Recover 🛌</span>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="text-2xl shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">{activity.emoji}</div>
            <div className="min-w-0">
              <div className="font-semibold text-zinc-100 truncate">{activity.type}</div>
              <div className="text-[11px] text-zinc-500">{activity.label}</div>
              {plannedDone && (
                <div className="text-[11px] text-zinc-400 mt-1">
                  <span className="tabular-nums">{planned.durationMin}min</span> · <span style={{ color: intensityColor(planned.intensity) }}>{planned.intensity}</span>
                  {planned.note && <span className="text-zinc-500"> · {planned.note}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 flex flex-wrap gap-1.5 justify-end">
            {plannedDone && (
              <>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30 font-semibold">✓ Done</span>
                <button onClick={() => onEditWorkout(planned)} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition">edit</button>
              </>
            )}
            {plannedSkipped && (
              <button onClick={onMarkDone} className="text-xs px-3 py-1.5 rounded-xl bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30 font-semibold hover:bg-[#34d399]/25 active:scale-95 transition">Mark done</button>
            )}
            {!plannedDone && !plannedSkipped && (
              <>
                <button onClick={onMarkDone} className="text-xs px-3 py-1.5 rounded-xl bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30 font-semibold hover:bg-[#34d399]/25 active:scale-95 transition">✓ Did it</button>
                <button onClick={onSkip} className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-zinc-500 hover:bg-white/5 transition">Skip</button>
              </>
            )}
          </div>
        </div>
      )}

      {adHoc.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
          {adHoc.map(w => (
            <div key={w.id} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-zinc-100">{w.type}</span>
                <span className="text-zinc-500"> · <span className="tabular-nums">{w.durationMin}min</span> · </span>
                <span style={{ color: intensityColor(w.intensity) }}>{w.intensity}</span>
                {w.note && <span className="text-zinc-500"> · {w.note}</span>}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button onClick={() => onEditWorkout(w)} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition">edit</button>
                <button onClick={() => onRemoveWorkout(w.id)} className="text-[10px] text-[#f87171]/70 hover:text-[#f87171] transition">remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onAddWorkout}
        className="w-full mt-3 py-2 text-xs rounded-xl border border-dashed border-white/15 text-zinc-400 hover:bg-white/5 hover:border-white/25 transition"
      >
        + Add workout
      </button>
    </Card>
  )
}

const Modal = ({ open, onClose, children }) => {
  if (!open) return null
  return createPortal(
    <div
      className="fixed z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overlay-fade"
      style={{ top: 0, left: 0, right: 0, bottom: 0, height: '100dvh' }}
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md mx-4 rounded-3xl p-5 border border-white/10 shadow-2xl shadow-black/50 sheet-slide-up overflow-y-auto"
        style={{ maxHeight: '85dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

/* ---------------------------------------------------------------------------
   Meal card
--------------------------------------------------------------------------- */
const MealCard = ({ meal, log, onMarkPlanned, onLogActual, onSkip, onClear, isPast }) => {
  const isWhey = meal.type.toLowerCase().includes('whey') || meal.type.toLowerCase().includes('post-workout') || meal.type.toLowerCase().includes('post-match')
  const status = log?.status || 'planned'
  const showActual = status === 'logged_actual'
  const ate = status === 'eaten_as_planned'
  const skipped = status === 'skipped'
  const needsAttention = isPast && status === 'planned'

  const pillBase = 'text-[10px] px-2 py-0.5 rounded-full font-semibold border'
  const accent = isWhey ? '#22d3ee' : null

  return (
    <Card className={`p-3.5 relative overflow-hidden ${skipped ? 'opacity-60' : ''}`}>
      {isWhey && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#22d3ee]" style={{ boxShadow: '0 0 16px #22d3ee88' }} />}
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">{mealEmoji(meal.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{meal.time} · {meal.type}</div>
              <div className="font-medium text-zinc-100 mt-0.5">{meal.food}</div>
            </div>
            <div className="shrink-0">
              {ate && <span className={`${pillBase} bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30`}>✓ Eaten</span>}
              {showActual && <span className={`${pillBase} bg-[#d7ff3a]/15 text-[#d7ff3a] border-[#d7ff3a]/30`}>● Logged</span>}
              {skipped && <span className={`${pillBase} bg-white/5 text-zinc-400 border-white/10`}>Skipped</span>}
              {needsAttention && <span className={`${pillBase} bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/30`}>Tap to log 👀</span>}
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
            <Macro label="kcal" planned={meal.calories} actual={showActual ? log.calories : null} />
            <Macro label="P"    planned={meal.protein}  actual={showActual ? log.protein  : null} unit="g" />
            <Macro label="C"    planned={meal.carbs}    actual={showActual ? log.carbs    : null} unit="g" />
            <Macro label="F"    planned={meal.fat}      actual={showActual ? log.fat      : null} unit="g" />
          </div>

          {showActual && log.loggedFood && (
            <div className="mt-2 text-xs text-zinc-400">Actual: <span className="text-zinc-200">{log.loggedFood}</span>{log.note ? ` · ${log.note}` : ''}</div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {!ate && !showActual && (
              <button onClick={onMarkPlanned} className="text-xs px-3 py-1.5 rounded-xl bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30 font-semibold hover:bg-[#34d399]/20 active:scale-95 transition">✓ Ate it</button>
            )}
            {!ate && (
              <button onClick={onLogActual} className="text-xs px-3 py-1.5 rounded-xl bg-[#d7ff3a] text-black font-semibold hover:bg-[#c6ee29] active:scale-95 transition">
                {showActual ? 'Edit log' : 'Log actual'}
              </button>
            )}
            {ate && (
              <button onClick={onLogActual} className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-zinc-400 hover:bg-white/5 active:scale-95 transition whitespace-nowrap">Add details</button>
            )}
            {!skipped && status !== 'planned' && (
              <button onClick={onClear} className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-zinc-400 hover:bg-white/5 active:scale-95 transition">Clear</button>
            )}
            {status === 'planned' && (
              <button onClick={onSkip} className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-zinc-500 hover:bg-white/5 transition">Skip</button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

const Macro = ({ label, planned, actual, unit = '' }) => {
  const showActual = actual !== null && actual !== undefined
  const colorClass = showActual ? diffColor(actual, planned) : 'text-zinc-200'
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.04] py-1.5">
      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">{label}</div>
      {showActual ? (
        <div className={`text-xs font-semibold tabular-nums ${colorClass}`}>
          {Math.round(actual)}{unit}
          <span className="text-[10px] text-zinc-600 font-normal"> /{Math.round(planned)}{unit}</span>
        </div>
      ) : (
        <div className="text-xs font-semibold text-zinc-200 tabular-nums">{Math.round(planned)}{unit}</div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Bento stats — small status tiles (streak / weight / water).
   Each tile is tap-to-expand into a focused modal.
--------------------------------------------------------------------------- */
const StatTile = ({ Icon, label, value, sub, onClick, accent, footer, ariaLabel }) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel || label}
    className="flex-1 min-w-0 p-3 bg-[#16161c]/90 backdrop-blur rounded-2xl border border-white/[0.07] shadow-xl shadow-black/40 hover:bg-white/[0.04] active:scale-[0.97] transition text-left flex flex-col"
  >
    <div className="flex items-center justify-between mb-1.5">
      <Icon size={16} strokeWidth={2.2} style={{ color: accent }} />
    </div>
    <div className="text-2xl font-display font-bold tabular-nums leading-none truncate" style={{ color: accent }}>{value}</div>
    <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mt-1.5 truncate">{label}</div>
    {sub && <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{sub}</div>}
    {footer}
  </button>
)

const BentoStats = ({ streak, weights, water, waterTarget, onOpenWeight, onOpenWater, profileWeight }) => {
  const wEntries = sortedWeights(weights)
  const latest = wEntries[wEntries.length - 1]
  const wDelta = lastDelta(wEntries)
  const waterPct = Math.min(100, Math.round((water / waterTarget) * 100))
  return (
    <div className="flex gap-2">
      <StatTile
        Icon={Flame}
        accent={streak > 0 ? '#fbbf24' : '#71717a'}
        value={streak}
        label={streak === 1 ? 'Day streak' : 'Day streak'}
        sub={streak > 0 ? 'Keep it lit 🔥' : 'Start one!'}
        ariaLabel={`${streak} day streak`}
      />
      <StatTile
        Icon={Scale}
        accent="#d7ff3a"
        value={latest ? latest.weight : profileWeight}
        label="Weight (kg)"
        sub={wDelta !== null ? `${wDelta > 0 ? '+' : ''}${wDelta} last` : 'Tap to log'}
        onClick={onOpenWeight}
      />
      <StatTile
        Icon={Droplets}
        accent="#22d3ee"
        value={`${waterPct}%`}
        label="Hydration"
        sub={`${water}/${waterTarget}ml`}
        onClick={onOpenWater}
      />
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Water modal — full water controls (tile is the entry point)
--------------------------------------------------------------------------- */
const WaterModal = ({ water, target, onAdd, onClose }) => {
  const pct = Math.min(100, (water / target) * 100)
  const remaining = Math.max(0, target - water)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <Droplets size={20} className="text-[#22d3ee]" /> Hydration
        </h3>
        <div className="text-right">
          <div className="text-2xl font-display font-bold text-white tabular-nums">{water}<span className="text-sm font-normal text-zinc-500">ml</span></div>
          <div className="text-[10px] text-zinc-500 tabular-nums">of {target}ml</div>
        </div>
      </div>

      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#22d3ee', boxShadow: '0 0 14px #22d3ee99' }} />
      </div>
      <div className="text-[11px] text-zinc-500 text-center tabular-nums">
        {remaining > 0 ? <>{remaining}ml to goal</> : <span className="text-[#22d3ee] font-semibold">Goal hit — way to flow 💧</span>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => onAdd(250)} className="py-3 rounded-xl bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30 font-semibold text-sm hover:bg-[#22d3ee]/25 active:scale-95 transition">+250ml</button>
        <button onClick={() => onAdd(500)} className="py-3 rounded-xl bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30 font-semibold text-sm hover:bg-[#22d3ee]/25 active:scale-95 transition">+500ml</button>
        <button onClick={() => onAdd(750)} className="py-3 rounded-xl bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30 font-semibold text-sm hover:bg-[#22d3ee]/25 active:scale-95 transition">+750ml</button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onAdd(-250)} className="flex-1 py-2 rounded-xl border border-white/10 text-zinc-400 text-sm hover:bg-white/5 transition">−250ml</button>
        <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-[#d7ff3a] text-black text-sm font-semibold hover:bg-[#c6ee29] transition">Done</button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Cheat Day card
--------------------------------------------------------------------------- */
const CHEAT_TIPS = [
  { icon: '💧', text: 'Stay hydrated — aim for 3L water today. Junk food is high in sodium.' },
  { icon: '🥩', text: 'Front-load protein earlier in the day so you don\'t end up near zero by dinner.' },
  { icon: '🚶', text: 'A short 20-min walk after meals helps digestion and limits fat storage.' },
  { icon: '🍕', text: 'Whole foods first — pizza over chips, ice cream over soda. Enjoy real food.' },
  { icon: '🌙', text: 'Try to wrap up eating by 10 PM. Late-night binges are harder to recover from.' },
  { icon: '🏋️', text: 'Don\'t skip your workout — the extra carbs today will fuel a great session.' },
  { icon: '🧘', text: 'Eat slowly and savour every bite. Mindful eating means you\'ll need less to feel satisfied.' },
  { icon: '✅', text: 'One cheat day won\'t derail your progress. Just get back on plan tomorrow — no guilt.' },
  { icon: '🥤', text: 'Avoid liquid calories (sodas, juices, cocktails) — they add up invisibly fast.' },
  { icon: '😴', text: 'Good sleep tonight will reset hunger hormones and make tomorrow\'s clean eating easier.' },
]

const CheatDayCard = ({ onToggleOff }) => {
  const tips = useMemo(() => {
    const shuffled = [...CHEAT_TIPS].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3)
  }, [])
  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1400 0%, #1f1a00 100%)', border: '1px solid rgba(251,191,36,0.25)' }}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-display font-black text-[#fbbf24] tracking-tight">Cheat Day 🍕</div>
            <div className="text-sm text-amber-300/70 mt-0.5">Goals paused — enjoy guilt-free</div>
          </div>
          <button onClick={onToggleOff}
            className="shrink-0 px-3 py-1.5 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/10 transition">
            Undo
          </button>
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="text-[10px] font-semibold text-amber-500/60 uppercase tracking-widest">Tips for today</div>
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
              <span className="text-lg leading-none shrink-0 mt-0.5">{tip.icon}</span>
              <span className="text-sm text-amber-100/80 leading-snug">{tip.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Hero macro dashboard — big calorie ring + 3 satellite rings (streak moved to bento)
--------------------------------------------------------------------------- */
const HeroMacroCard = ({ planned, logged, targets }) => {
  const [flipped, setFlipped] = useState(false)
  const calTarget = mid(targets.calories)
  const calLeft = Math.max(0, Math.round(calTarget - logged.calories))
  const calOver = logged.calories > calTarget
  const animKcal = useCountUp(logged.calories)
  const animPlanned = useCountUp(planned.calories)
  const ringColor = calOver ? '#f87171' : THEME.accent
  const diff = Math.round(logged.calories - planned.calories)
  const diffColor = diff === 0 ? '#a1a1aa' : diff > 0 ? '#fbbf24' : '#71717a'

  return (
    <Card className="p-5">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Today's Fuel</div>

      <div className="flex flex-col items-center pt-2">
        <button
          type="button"
          onClick={() => setFlipped(f => !f)}
          className="active:scale-[0.97] transition"
          aria-label="Toggle calories planned vs logged"
        >
          <Ring size={196} stroke={14} value={logged.calories} target={calTarget} color={THEME.accent}>
            <div className="relative w-full h-full flex items-center justify-center">
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${flipped ? 'opacity-0' : 'opacity-100'}`}>
                <div className="text-center leading-none">
                  <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Calories</div>
                  <div className="text-[44px] font-display font-bold tabular-nums" style={{ color: ringColor }}>{Math.round(animKcal)}</div>
                  <div className="text-[10px] text-zinc-500 mt-1.5 tabular-nums">of {Math.round(calTarget)} kcal</div>
                </div>
              </div>
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${flipped ? 'opacity-100' : 'opacity-0'}`}>
                <div className="text-center leading-none">
                  <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Planned</div>
                  <div className="text-[44px] font-display font-bold tabular-nums text-zinc-200">{Math.round(animPlanned)}</div>
                  <div className="text-[11px] mt-1.5 tabular-nums font-semibold" style={{ color: diffColor }}>
                    {diff > 0 ? '+' : ''}{diff} vs plan
                  </div>
                </div>
              </div>
            </div>
          </Ring>
        </button>

        <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-zinc-500">
          <span className="text-[9px] opacity-50">tap ring for plan</span>
          <span className="text-zinc-700">·</span>
          <span className={calOver ? 'text-[#f87171] font-semibold' : ''}>
            {calOver
              ? <>Over by <span className="tabular-nums">{Math.round(logged.calories - calTarget)}</span> kcal</>
              : <>Left <span className="text-zinc-300 tabular-nums">{calLeft}</span> kcal</>}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/5">
        <SatelliteRing label="Protein" value={logged.protein} planned={planned.protein} target={mid(targets.protein)} color={THEME.cyan} />
        <SatelliteRing label="Carbs"   value={logged.carbs}   planned={planned.carbs}   target={mid(targets.carbs)}   color={THEME.amber} />
        <SatelliteRing label="Fat"     value={logged.fat}     planned={planned.fat}     target={mid(targets.fat)}     color={THEME.violet} />
      </div>
    </Card>
  )
}

/* ---------------------------------------------------------------------------
   Reminders card
--------------------------------------------------------------------------- */
const RemindersCard = ({ plan, dayLog, water, waterTarget, onOpenWater }) => {
  const [now, setNow] = useState(() => new Date())
  const [dismissed, setDismissed] = useState(new Set())
  const notifDenied = 'Notification' in window && Notification.permission === 'denied'

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const reminders = []

  // Meal reminders — past meals with no logged status
  plan.forEach(meal => {
    if (meal.timeMin > nowMin) return // not yet
    const log = dayLog.meals.find(x => x.mealId === meal.id)
    if (log?.status === 'eaten_as_planned' || log?.status === 'logged_actual' || log?.status === 'skipped') return
    reminders.push({ id: `meal-${meal.id}`, icon: '🍽️', label: meal.type, text: `${meal.food} — not logged yet`, color: '#fbbf24' })
  })

  // Water reminder — only after 10 AM, only if below target
  if (nowMin >= 10 * 60 && water < waterTarget) {
    const pct = Math.round((water / waterTarget) * 100)
    const urgency = pct < 40 ? '🚨' : pct < 70 ? '💧' : '💧'
    reminders.push({ id: 'water', icon: urgency, label: 'Hydration', text: `${pct}% of daily target — ${waterTarget - water}ml to go`, color: '#22d3ee', action: onOpenWater, actionLabel: 'Log' })
  }

  const visible = reminders.filter(r => !dismissed.has(r.id))
  if (visible.length === 0 && !notifDenied) return null

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 px-1">Reminders</div>
      {notifDenied && (
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-zinc-700/50 bg-zinc-800/40">
          <span className="text-xl shrink-0">🔕</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Notifications blocked</div>
            <div className="text-xs text-zinc-500 mt-0.5 leading-snug">Enable in browser settings to get pop-up meal & water alerts</div>
          </div>
        </div>
      )}
      {visible.map(r => (
        <div key={r.id} className="flex items-center gap-3 px-3.5 py-3 rounded-2xl border"
          style={{ background: `${r.color}08`, borderColor: `${r.color}25` }}>
          <span className="text-xl shrink-0">{r.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: r.color }}>{r.label}</div>
            <div className="text-xs text-zinc-300 mt-0.5 leading-snug">{r.text}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {r.action && (
              <button onClick={r.action}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-black transition active:scale-95"
                style={{ background: r.color }}>
                {r.actionLabel}
              </button>
            )}
            <button onClick={() => setDismissed(d => new Set([...d, r.id]))}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition text-base leading-none">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Today / Daily View
--------------------------------------------------------------------------- */
const TodayView = ({ date, setDate, logs, setLogs, openLogger, openWorkoutLogger, openChooser, profile, weights, setWeights, onOpenWater, onOpenWeight }) => {
  const dayKey = isoToDayKey(date)
  const plan = WEEK_PLAN[dayKey]
  const dayLog = logs[date] || { meals: [], water: 0 }
  const planned = useMemo(() => sumPlanned(plan), [plan])
  const logged = useMemo(() => sumLogged(dayLog, plan), [dayLog, plan])
  const t = profile.targets

  const now = new Date()
  const isToday = date === todayISO()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const markPlanned = (mealId) => {
    setLogs(prev => upsertMealLog(prev, date, { mealId, status: 'eaten_as_planned' }))
  }
  const skip = (mealId) => {
    setLogs(prev => upsertMealLog(prev, date, { mealId, status: 'skipped' }))
  }
  const clear = (mealId) => {
    setLogs(prev => {
      const day = prev[date]
      if (!day) return prev
      return { ...prev, [date]: { ...day, meals: day.meals.filter(x => x.mealId !== mealId) } }
    })
  }
  const clearGroup = (mealIds) => {
    setLogs(prev => {
      const day = prev[date]
      if (!day) return prev
      return { ...prev, [date]: { ...day, meals: day.meals.filter(x => !mealIds.includes(x.mealId)) } }
    })
  }

  const water = dayLog.water || 0
  const isCheatDay = !!dayLog.cheatDay
  const toggleCheatDay = () => setLogs(prev => {
    const day = prev[date] || { meals: [], water: 0 }
    return { ...prev, [date]: { ...day, cheatDay: !day.cheatDay } }
  })
  const streak = useMemo(() => computeProteinStreak(logs, t.protein.min), [logs, t.protein.min])

  return (
    <div className="space-y-4 pb-fab">
      {/* Date picker strip */}
      <Card className="p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">{isToday ? 'Today' : 'Date'}</div>
            <div className="text-lg font-display font-bold text-white">{DAY_LABELS[dayKey]} · {fmtShort(date)}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{ACTIVITY[dayKey].emoji} {ACTIVITY[dayKey].label}</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setDate(addDays(date, -1))} className="w-9 h-9 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 active:scale-95 transition flex items-center justify-center"><ChevronLeft size={18} strokeWidth={2.2} /></button>
            <button onClick={() => setDate(addDays(date, 1))} className="w-9 h-9 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 active:scale-95 transition flex items-center justify-center"><ChevronRight size={18} strokeWidth={2.2} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-[#d7ff3a]/50 transition"
          />
          <button onClick={() => setDate(todayISO())} className="px-4 py-2.5 text-xs rounded-xl bg-[#d7ff3a] text-black font-semibold hover:bg-[#c6ee29] active:scale-95 transition">Today</button>
          <button onClick={toggleCheatDay}
            className={`px-3 py-2.5 text-xs rounded-xl font-semibold active:scale-95 transition ${isCheatDay ? 'bg-[#fbbf24] text-black' : 'border border-white/10 text-zinc-400 hover:bg-white/5'}`}>
            🍕
          </button>
        </div>
      </Card>

      {/* Friday football warning */}
      {dayKey === 'fri' && (
        <Card className="p-3.5 border-[#fbbf24]/30 bg-[#fbbf24]/5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚽</span>
            <div className="text-sm">
              <div className="font-semibold text-[#fbbf24]">Match night, baby ⚡</div>
              <div className="text-xs text-zinc-400 mt-0.5">Light dinner at 7:30 PM, smash a whey post-match for recovery.</div>
            </div>
          </div>
        </Card>
      )}

      {/* Bento stats — streak / weight / hydration tiles */}
      <BentoStats
        streak={streak}
        weights={weights}
        water={water}
        waterTarget={profile.waterTarget}
        profileWeight={profile.weight}
        onOpenWeight={onOpenWeight}
        onOpenWater={onOpenWater}
      />

      {/* Activity card — planned workout + ad-hoc */}
      <ActivityCard
        dayKey={dayKey}
        dayLog={dayLog}
        onMarkDone={() => {
          const a = ACTIVITY[dayKey]
          openWorkoutLogger({
            date,
            workoutId: 'planned',
            planned: true,
            prefill: { type: a.type, durationMin: a.durationMin, intensity: 'moderate' }
          })
        }}
        onSkip={() => {
          setLogs(prev => upsertWorkout(prev, date, {
            id: 'planned', planned: true, status: 'skipped',
            type: ACTIVITY[dayKey].type
          }))
        }}
        onAddWorkout={() => openWorkoutLogger({ date, planned: false })}
        onEditWorkout={(w) => openWorkoutLogger({ date, workoutId: w.id, planned: w.planned, initial: w })}
        onRemoveWorkout={(id) => setLogs(prev => removeWorkoutById(prev, date, id))}
      />

      {/* Hero macro dashboard — calorie ring + 3 satellites, or cheat day card */}
      {isCheatDay
        ? <CheatDayCard onToggleOff={toggleCheatDay} />
        : <HeroMacroCard planned={planned} logged={logged} targets={t} />
      }

      {/* Reminders — only for today, hidden on cheat days */}
      {isToday && !isCheatDay && (
        <RemindersCard
          plan={plan}
          dayLog={dayLog}
          water={water}
          waterTarget={profile.waterTarget}
          onOpenWater={onOpenWater}
        />
      )}

      {/* Meal timeline */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 px-1">Timeline</div>
        {plan.map(meal => {
          const log = findLogForMeal(logs, date, meal.id)
          const isPast = date < todayISO() || (isToday && nowMin > meal.timeMin)
          return (
            <MealCard
              key={meal.id}
              meal={meal}
              log={log}
              isPast={isPast}
              onMarkPlanned={() => markPlanned(meal.id)}
              onLogActual={() => openLogger({ mealId: meal.id, mealName: meal.food })}
              onSkip={() => skip(meal.id)}
              onClear={() => clear(meal.id)}
            />
          )
        })}
        {/* Extra logged items — grouped by session */}
        {(() => {
          const extras = dayLog.meals.filter(x => x.status === 'extra')
          const groups = []
          const seen = new Set()
          extras.forEach(item => {
            if (!item.groupId) { groups.push([item]); return }
            if (!seen.has(item.groupId)) {
              seen.add(item.groupId)
              groups.push(extras.filter(x => x.groupId === item.groupId))
            }
          })
          return groups.map((group, i) => {
            const mealName = group.map(x => x.displayName || x.loggedFood).join(' + ')
            const tot = group.reduce((acc, x) => ({
              calories: acc.calories + (Number(x.calories) || 0),
              protein:  Math.round((acc.protein + (Number(x.protein) || 0)) * 10) / 10,
              carbs:    Math.round((acc.carbs   + (Number(x.carbs)   || 0)) * 10) / 10,
              fat:      Math.round((acc.fat     + (Number(x.fat)     || 0)) * 10) / 10,
            }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
            const handleRemove = () => clearGroup(group.map(x => x.mealId))
            return (
              <Card key={`extra-group-${i}`} className="p-3.5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#fbbf24]" style={{ boxShadow: '0 0 14px #fbbf2466' }} />
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-xl">➕</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Quick Log</div>
                    <div className="font-medium text-zinc-100 mt-0.5 leading-snug">{mealName}</div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-xs">
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.04] py-1.5"><div className="text-[9px] text-zinc-500 uppercase tracking-wider">kcal</div><div className="font-semibold text-zinc-200 tabular-nums">{tot.calories}</div></div>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.04] py-1.5"><div className="text-[9px] text-zinc-500 uppercase tracking-wider">P</div><div className="font-semibold text-zinc-200 tabular-nums">{tot.protein}g</div></div>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.04] py-1.5"><div className="text-[9px] text-zinc-500 uppercase tracking-wider">C</div><div className="font-semibold text-zinc-200 tabular-nums">{tot.carbs}g</div></div>
                      <div className="rounded-xl bg-white/[0.04] border border-white/[0.04] py-1.5"><div className="text-[9px] text-zinc-500 uppercase tracking-wider">F</div><div className="font-semibold text-zinc-200 tabular-nums">{tot.fat}g</div></div>
                    </div>
                  </div>
                  <button onClick={handleRemove} className="text-xs text-[#f87171]/80 hover:text-[#f87171] transition shrink-0">Remove</button>
                </div>
              </Card>
            )
          })
        })()}
      </div>

    </div>
  )
}

/* ---------------------------------------------------------------------------
   Weekly summary (Stats tab)
--------------------------------------------------------------------------- */
const PLANNED_COLOR = '#52525b' // dim slate — neutral planned bars on dark bg
const CHART_MACROS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', plannedField: 'plannedCal',     loggedField: 'loggedCal',     loggedColor: '#d7ff3a', targetKey: 'calories' },
  { key: 'protein',  label: 'Protein',  unit: 'g',    plannedField: 'plannedProtein', loggedField: 'loggedProtein', loggedColor: '#22d3ee', targetKey: 'protein'  },
  { key: 'carbs',    label: 'Carbs',    unit: 'g',    plannedField: 'plannedCarbs',   loggedField: 'loggedCarbs',   loggedColor: '#fbbf24', targetKey: 'carbs'    },
  { key: 'fat',      label: 'Fat',      unit: 'g',    plannedField: 'plannedFat',     loggedField: 'loggedFat',     loggedColor: '#a78bfa', targetKey: 'fat'      }
]

const SummaryView = ({ logs, profile, weights, setWeights }) => {
  const [chartMacro, setChartMacro] = useState('calories')
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, -1 = last week, etc.
  const t = profile.targets
  const weekStart = addDays(startOfWeekISO(todayISO()), weekOffset * 7)
  const isCurrentWeek = weekOffset === 0
  const days = DAY_KEYS.map((k, i) => ({ key: k, iso: addDays(weekStart, i) }))

  const data = days.map(({ key, iso }) => {
    const plan = WEEK_PLAN[key]
    const planned = sumPlanned(plan)
    const dayLog = logs[iso]
    const logged = sumLogged(dayLog, plan)
    const hasLog = dayLog && dayLog.meals.length > 0
    return {
      day: DAY_SHORT[key],
      iso, key,
      plannedCal: Math.round(planned.calories),
      loggedCal: hasLog ? Math.round(logged.calories) : 0,
      plannedProtein: Math.round(planned.protein),
      loggedProtein:  hasLog ? Math.round(logged.protein) : 0,
      plannedCarbs:   Math.round(planned.carbs),
      loggedCarbs:    hasLog ? Math.round(logged.carbs) : 0,
      plannedFat:     Math.round(planned.fat),
      loggedFat:      hasLog ? Math.round(logged.fat) : 0,
      protein: hasLog ? Math.round(logged.protein) : 0,
      carbs:   hasLog ? Math.round(logged.carbs) : 0,
      fat:     hasLog ? Math.round(logged.fat) : 0,
      hasLog
    }
  })

  const loggedDays = data.filter(d => d.hasLog)
  const avg = (key) => loggedDays.length ? Math.round(loggedDays.reduce((s, d) => s + d[key], 0) / loggedDays.length) : 0
  const proteinHits = loggedDays.filter(d => d.protein >= t.protein.min).length
  const macroCfg = CHART_MACROS.find(m => m.key === chartMacro)

  const tooltipStyle = { background: '#16161c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }
  return (
    <div className="space-y-3 pb-fab">
      <Card className="p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Weekly Summary</div>
            <div className="text-lg font-display font-bold text-white">{fmtShort(weekStart)} – {fmtShort(addDays(weekStart, 6))}</div>
            {!isCurrentWeek && (
              <div className="text-[10px] text-zinc-500 mt-0.5">{Math.abs(weekOffset)} week{Math.abs(weekOffset) > 1 ? 's' : ''} ago</div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset(o => o - 1)}
              className="w-9 h-9 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 active:scale-95 transition flex items-center justify-center">
              <ChevronLeft size={18} strokeWidth={2.2} />
            </button>
            <button onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
              disabled={isCurrentWeek}
              className="w-9 h-9 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center">
              <ChevronRight size={18} strokeWidth={2.2} />
            </button>
            {!isCurrentWeek && (
              <button onClick={() => setWeekOffset(0)}
                className="px-3 h-9 rounded-xl bg-[#d7ff3a] text-black text-xs font-semibold hover:bg-[#c6ee29] active:scale-95 transition">
                Now
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{macroCfg.label}: Planned vs Logged</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Target <span className="text-zinc-200 tabular-nums">{t[macroCfg.targetKey].min}–{t[macroCfg.targetKey].max}</span> {macroCfg.unit}
            </div>
          </div>
        </div>
        <div className="flex gap-1 mb-3 bg-white/5 p-1 rounded-2xl border border-white/5">
          {CHART_MACROS.map(mc => (
            <button
              key={mc.key}
              onClick={() => setChartMacro(mc.key)}
              className={`flex-1 text-xs py-1.5 rounded-xl font-semibold transition ${
                chartMacro === mc.key ? 'bg-white/10' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              style={chartMacro === mc.key ? { color: mc.loggedColor } : {}}
            >
              {mc.label}
            </button>
          ))}
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#71717a' }} stroke="rgba(255,255,255,0.1)" />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} stroke="rgba(255,255,255,0.1)" domain={[0, Math.ceil(Math.max(...data.map(d => Math.max(d[macroCfg.plannedField] || 0, d[macroCfg.loggedField] || 0)), t[macroCfg.targetKey].max) * 1.15)]} />
              <Tooltip formatter={(v) => `${Math.round(v)} ${macroCfg.unit}`} contentStyle={tooltipStyle} labelStyle={{ color: '#a1a1aa' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
              <ReferenceArea
                y1={t[macroCfg.targetKey].min}
                y2={t[macroCfg.targetKey].max}
                fill={macroCfg.loggedColor}
                fillOpacity={0.10}
                ifOverflow="extendDomain"
              />
              <ReferenceLine
                y={mid(t[macroCfg.targetKey])}
                stroke={macroCfg.loggedColor}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                ifOverflow="extendDomain"
                label={{ value: `Target ${Math.round(mid(t[macroCfg.targetKey]))}`, position: 'insideTopRight', fontSize: 10, fill: macroCfg.loggedColor }}
              />
              <Bar dataKey={macroCfg.plannedField} name="Planned" fill={PLANNED_COLOR}        radius={[6,6,0,0]} />
              <Bar dataKey={macroCfg.loggedField}  name="Logged"  fill={macroCfg.loggedColor} radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-zinc-500 justify-center">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: PLANNED_COLOR }} /> Planned</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: macroCfg.loggedColor }} /> Logged</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded-sm" style={{ background: macroCfg.loggedColor, opacity: 0.7 }} /> Target range</span>
        </div>
      </Card>

      <Card className="p-3.5">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2.5">Weekly Averages</div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { l: 'kcal', v: avg('loggedCal'), tgt: mid(t.calories), c: THEME.accent },
            { l: 'P',    v: avg('protein'),   tgt: mid(t.protein),  c: THEME.cyan },
            { l: 'C',    v: avg('carbs'),     tgt: mid(t.carbs),    c: THEME.amber },
            { l: 'F',    v: avg('fat'),       tgt: mid(t.fat),      c: THEME.violet }
          ].map((x, i) => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.05] rounded-2xl p-2">
              <div className="text-[10px] text-zinc-500 uppercase font-medium tracking-wider">{x.l}</div>
              <div className="text-base font-display font-bold tabular-nums" style={{ color: x.c }}>{x.v}</div>
              <div className="text-[10px] text-zinc-500 tabular-nums">target {Math.round(x.tgt)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-3.5">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">🔥 Streak</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-display font-bold tabular-nums" style={{ color: THEME.accent }}>{proteinHits}</span>
          <span className="text-sm text-zinc-300">day{proteinHits === 1 ? '' : 's'} hitting protein target</span>
        </div>
        <div className="text-xs text-zinc-500 mt-1 tabular-nums">{loggedDays.length} of 7 days logged this week</div>
      </Card>

      <WeightTrendCard weights={weights} setWeights={setWeights} weekStart={weekStart} />

      <Card className="p-3.5">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Per-day breakdown</div>
        <div className="divide-y divide-white/5">
          {data.map(d => (
            <div key={d.iso} className="py-2.5 flex items-center justify-between text-sm">
              <div>
                <div className="font-semibold text-zinc-100">{d.day} <span className="text-xs text-zinc-500 font-normal">{fmtShort(d.iso)}</span></div>
                <div className="text-[11px] text-zinc-500">{d.hasLog ? <span><span className="text-zinc-300 tabular-nums">{d.loggedCal}</span> kcal logged</span> : 'Not logged yet'}</div>
              </div>
              <div className="text-[11px] tabular-nums">
                <span style={{ color: THEME.cyan }}>P {d.protein}g</span> <span className="text-zinc-700">·</span> <span style={{ color: THEME.amber }}>C {d.carbs}g</span> <span className="text-zinc-700">·</span> <span style={{ color: THEME.violet }}>F {d.fat}g</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Snacks view
--------------------------------------------------------------------------- */
const SnacksView = ({ date, setLogs, flash }) => {
  const addSnack = (s) => {
    setLogs(prev => upsertMealLog(prev, date, {
      mealId: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'extra',
      loggedFood: s.name,
      calories: s.calories, protein: s.protein, carbs: s.carbs, fat: s.fat,
      note: s.timing
    }))
    const where = date === todayISO() ? '' : ` to ${fmtShort(date)}`
    flash(`✓ "${s.name}" added${where} — nice grab`)
  }

  return (
    <div className="space-y-4 pb-fab">
      <Card className="p-3.5">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Snacks</div>
        <div className="text-sm text-zinc-300">Tap <span className="text-[#d7ff3a] font-semibold">+ Add</span> to log directly.</div>
      </Card>
      {Object.entries(SNACKS).map(([category, items]) => (
        <div key={category}>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 px-1 mb-2">{category}</div>
          <div className="space-y-2">
            {items.map((s, i) => (
              <Card key={i} className="p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-100">{s.name}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">⏰ {s.timing}</div>
                    <div className="grid grid-cols-4 gap-1.5 mt-2 text-center text-[11px]">
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.04] py-1"><span className="text-zinc-500 text-[9px] uppercase tracking-wider">kcal</span> <div className="font-semibold text-zinc-200 tabular-nums">{s.calories}</div></div>
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.04] py-1"><span className="text-zinc-500 text-[9px] uppercase tracking-wider">P</span> <div className="font-semibold tabular-nums" style={{ color: THEME.cyan }}>{s.protein}g</div></div>
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.04] py-1"><span className="text-zinc-500 text-[9px] uppercase tracking-wider">C</span> <div className="font-semibold tabular-nums" style={{ color: THEME.amber }}>{s.carbs}g</div></div>
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.04] py-1"><span className="text-zinc-500 text-[9px] uppercase tracking-wider">F</span> <div className="font-semibold tabular-nums" style={{ color: THEME.violet }}>{s.fat}g</div></div>
                    </div>
                  </div>
                  <button onClick={() => addSnack(s)} className="px-3 py-2 text-xs rounded-xl bg-[#d7ff3a] text-black font-semibold whitespace-nowrap hover:bg-[#c6ee29] active:scale-95 transition">+ Add</button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Weight helpers + components
   - WeightInputCard (Today): compact input + current value + last delta
   - WeightTrendCard (Log):   chart + history list (no input)
--------------------------------------------------------------------------- */
const sortedWeights = (weights) =>
  Object.entries(weights)
    .map(([d, w]) => ({ date: d, weight: Number(w) }))
    .sort((a, b) => a.date.localeCompare(b.date))

const lastDelta = (entries) => {
  if (entries.length < 2) return null
  const a = entries[entries.length - 1].weight
  const b = entries[entries.length - 2].weight
  return +(a - b).toFixed(1)
}

const DeltaBadge = ({ delta }) => {
  if (delta === null) return null
  const cls = delta < 0 ? 'text-[#34d399]' : delta > 0 ? 'text-[#fbbf24]' : 'text-zinc-400'
  return <span className={`${cls} font-semibold tabular-nums`}>{delta > 0 ? '+' : ''}{delta} kg</span>
}

const WeightInputCard = ({ weights, setWeights, currentWeight }) => {
  const [input, setInput] = useState('')
  const [entryDate, setEntryDate] = useState(todayISO())
  const entries = sortedWeights(weights)
  const latest = entries[entries.length - 1]
  const delta = lastDelta(entries)
  const existingForDate = weights[entryDate]

  const submit = (e) => {
    e.preventDefault()
    if (existingForDate !== undefined) return
    const w = parseFloat(input)
    if (!Number.isFinite(w) || w <= 0) return
    setWeights(prev => ({ ...prev, [entryDate]: w }))
    setInput('')
  }

  const clearForDate = () => {
    setWeights(prev => { const next = { ...prev }; delete next[entryDate]; return next })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <Scale size={20} className="text-[#d7ff3a]" /> Weight
        </h3>
        <div className="text-right">
          <div className="text-2xl font-display font-bold text-white tabular-nums">
            {latest ? latest.weight : currentWeight}<span className="text-sm font-normal text-zinc-500"> kg</span>
          </div>
          {delta !== null && (
            <div className="text-[10px] text-zinc-500">last: <DeltaBadge delta={delta} /></div>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full mt-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-[#d7ff3a]/50 transition"
          />
        </div>
        {existingForDate !== undefined ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[#34d399]/10 border border-[#34d399]/30 rounded-xl">
            <div className="text-sm min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-[#34d399] font-semibold">Already logged</div>
              <div className="text-zinc-100 font-semibold tabular-nums truncate">{existingForDate} kg <span className="text-zinc-500 font-normal">on {fmtShort(entryDate)}</span></div>
            </div>
            <button type="button" onClick={clearForDate} className="shrink-0 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 transition">Clear</button>
          </div>
        ) : (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Weight (kg)</label>
            <div className="flex items-stretch gap-2 mt-1">
              <input
                type="number" step="0.1" inputMode="decimal" autoFocus
                value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. 82.5"
                className="min-w-0 flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#d7ff3a]/50 transition"
              />
              <button type="submit" className="shrink-0 px-5 py-2.5 text-sm rounded-xl bg-[#d7ff3a] text-black font-semibold hover:bg-[#c6ee29] active:scale-95 transition">Log</button>
            </div>
          </div>
        )}
      </form>

      <div className="text-[10px] text-zinc-600 text-center">See the full trend in the Stats tab</div>
    </div>
  )
}

const WeightTrendCard = ({ weights, setWeights, weekStart }) => {
  const entries = sortedWeights(weights)
  const chartData = entries.slice(-12).map(e => ({ ...e, label: fmtShort(e.date) }))
  const latest = entries[entries.length - 1]
  const delta = lastDelta(entries)

  // delta over the currently-viewed week (Mon→Sun): latest entry within the week
  // minus the most recent entry on or before the week's start
  const weekEnd = addDays(weekStart, 6)
  const inWeek = entries.filter(e => e.date >= weekStart && e.date <= weekEnd)
  const beforeWeek = [...entries].reverse().find(e => e.date < weekStart)
  const weekDelta = inWeek.length && beforeWeek
    ? +(inWeek[inWeek.length - 1].weight - beforeWeek.weight).toFixed(1)
    : (inWeek.length >= 2 ? +(inWeek[inWeek.length - 1].weight - inWeek[0].weight).toFixed(1) : null)

  const removeEntry = (d) => {
    setWeights(prev => { const next = { ...prev }; delete next[d]; return next })
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">⚖️ Weight Trend</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            {latest ? <>Latest: <span className="text-zinc-200 tabular-nums">{latest.weight} kg</span> on {fmtShort(latest.date)}</> : 'No entries yet'}
          </div>
        </div>
        <div className="text-right text-[10px] text-zinc-500 space-y-0.5">
          {weekDelta !== null && <div>this week: <DeltaBadge delta={weekDelta} /></div>}
          {delta !== null && <div>last change: <DeltaBadge delta={delta} /></div>}
        </div>
      </div>

      {chartData.length >= 2 ? (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#71717a' }} stroke="rgba(255,255,255,0.1)" />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} stroke="rgba(255,255,255,0.1)" domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v) => `${v} kg`}
                contentStyle={{ background: '#16161c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Line type="monotone" dataKey="weight" stroke="#d7ff3a" strokeWidth={2.5} dot={{ r: 3, fill: '#d7ff3a' }} activeDot={{ r: 5, fill: '#d7ff3a' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-xs text-zinc-500 py-6 text-center bg-white/[0.03] border border-white/[0.05] rounded-2xl">
          {chartData.length === 1 ? 'One more weigh-in and we\'ve got a trend 📈' : 'Drop a weigh-in on the Today tab to start tracking'}
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-3 max-h-32 overflow-y-auto divide-y divide-white/5 text-xs">
          {[...entries].reverse().slice(0, 8).map(e => (
            <div key={e.date} className="py-2 flex items-center justify-between">
              <span className="text-zinc-400">{fmtShort(e.date)}</span>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-zinc-200 tabular-nums">{e.weight} kg</span>
                <button onClick={() => removeEntry(e.date)} className="text-[#f87171]/70 hover:text-[#f87171] text-[11px] transition">remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ---------------------------------------------------------------------------
   Settings / Goals editor
--------------------------------------------------------------------------- */
const SettingsField = ({ label, value, onChange, type = 'text', step }) => (
  <div>
    <label className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">{label}</label>
    <input
      type={type} step={step} value={value} onChange={onChange}
      className="w-full mt-1 px-2.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-[#d7ff3a]/50 focus:bg-white/[0.07] transition"
    />
  </div>
)

const SettingsForm = ({ profile, onSave, onCancel, onReset }) => {
  const [form, setForm] = useState({
    name: profile.name,
    age: profile.age,
    weight: profile.weight,
    heightCm: profile.heightCm,
    goal: profile.goal,
    waterTarget: profile.waterTarget,
    calMin: profile.targets.calories.min, calMax: profile.targets.calories.max,
    pMin:   profile.targets.protein.min,  pMax:   profile.targets.protein.max,
    cMin:   profile.targets.carbs.min,    cMax:   profile.targets.carbs.max,
    fMin:   profile.targets.fat.min,      fMax:   profile.targets.fat.max,
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const num = (v, fallback = 0) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
  }

  const submit = (e) => {
    e.preventDefault()
    onSave({
      name: form.name.trim() || 'You',
      age: num(form.age, profile.age),
      weight: num(form.weight, profile.weight),
      heightCm: num(form.heightCm, profile.heightCm),
      goal: form.goal.trim() || profile.goal,
      waterTarget: num(form.waterTarget, profile.waterTarget),
      targets: {
        calories: { min: num(form.calMin), max: num(form.calMax) },
        protein:  { min: num(form.pMin),   max: num(form.pMax) },
        carbs:    { min: num(form.cMin),   max: num(form.cMax) },
        fat:      { min: num(form.fMin),   max: num(form.fMax) }
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h3 className="text-2xl font-display font-bold text-white">Profile & Goals</h3>

      <section>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Profile</div>
        <div className="grid grid-cols-2 gap-2.5">
          <SettingsField label="Name" value={form.name} onChange={set('name')} />
          <SettingsField label="Goal" value={form.goal} onChange={set('goal')} />
          <SettingsField label="Age" type="number" value={form.age} onChange={set('age')} />
          <SettingsField label="Weight (kg)" type="number" step="0.1" value={form.weight} onChange={set('weight')} />
          <SettingsField label="Height (cm)" type="number" value={form.heightCm} onChange={set('heightCm')} />
          <SettingsField label="Water target (ml)" type="number" value={form.waterTarget} onChange={set('waterTarget')} />
        </div>
      </section>

      <section>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Daily macro targets</div>
        <div className="space-y-2.5">
          {[
            { label: 'Calories (kcal)', minK: 'calMin', maxK: 'calMax' },
            { label: 'Protein (g)',     minK: 'pMin',   maxK: 'pMax' },
            { label: 'Carbs (g)',       minK: 'cMin',   maxK: 'cMax' },
            { label: 'Fat (g)',         minK: 'fMin',   maxK: 'fMax' }
          ].map(row => (
            <div key={row.label} className="grid grid-cols-3 gap-2 items-end">
              <div className="text-xs text-zinc-300 pb-2">{row.label}</div>
              <SettingsField label="Min" type="number" value={form[row.minK]} onChange={set(row.minK)} />
              <SettingsField label="Max" type="number" value={form[row.maxK]} onChange={set(row.maxK)} />
            </div>
          ))}
        </div>
      </section>

      {/* Notification test */}
      <div className="pt-2 border-t border-white/[0.07]">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Notifications</div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-xs text-zinc-400">
            Permission: <span className={`font-semibold ${Notification.permission === 'granted' ? 'text-[#34d399]' : Notification.permission === 'denied' ? 'text-[#f87171]' : 'text-[#fbbf24]'}`}>
              {typeof Notification !== 'undefined' ? Notification.permission : 'not supported'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof Notification === 'undefined') return alert('Notifications not supported in this browser')
              if (Notification.permission !== 'granted') return alert('Permission not granted — allow notifications in browser settings first')
              new Notification('🔔 Test from Fuel', { body: 'Notifications are working correctly!', icon: '/favicon.ico' })
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 transition"
          >
            Send test
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end pt-1">
        <button type="button" onClick={onReset} className="px-3.5 py-2 text-xs rounded-xl border border-white/10 text-zinc-500 hover:bg-white/5 transition">Reset</button>
        <button type="button" onClick={onCancel} className="px-3.5 py-2 text-sm rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 transition">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm rounded-xl bg-[#d7ff3a] text-black font-semibold hover:bg-[#c6ee29] active:scale-95 transition">Save</button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------------------
   Bottom Nav
--------------------------------------------------------------------------- */
const BottomNav = ({ tab, setTab }) => {
  const tabs = [
    { k: 'today',   label: 'Today',  Icon: Home },
    { k: 'log',     label: 'Stats',  Icon: TrendingUp },
    { k: 'snacks',  label: 'Snacks', Icon: Cookie },
  ]
  return (
    <nav className="nav-safe fixed left-1/2 -translate-x-1/2 max-w-md w-[calc(100%-1.5rem)] z-30">
      <div className="glass border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex justify-around py-1.5 px-2">
        {tabs.map(({ k, label, Icon }) => {
          const active = tab === k
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex flex-col items-center justify-center flex-1 py-2 rounded-xl transition active:scale-95 ${active ? 'bg-[#d7ff3a]/10' : ''}`}
            >
              <Icon size={20} strokeWidth={2.2} className={active ? 'text-[#d7ff3a]' : 'text-zinc-500'} />
              <span className={`text-[10px] mt-1 font-semibold tracking-wide ${active ? 'text-[#d7ff3a]' : 'text-zinc-500'}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ---------------------------------------------------------------------------
   App
--------------------------------------------------------------------------- */
export default function App() {
  const [date, setDate] = useState(todayISO())
  const [tab, setTab] = useState('today')
  const [logs, setLogs] = useState({})
  const [weights, setWeights] = useState({})
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [logger, setLogger] = useState(null) // { mealId, mealName } | null
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState('')
  const [confettiKey, setConfettiKey] = useState(0)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [workoutLogger, setWorkoutLogger] = useState(null) // { date, workoutId?, planned, initial?, prefill? }
  const [waterOpen, setWaterOpen] = useState(false)
  const [weightOpen, setWeightOpen] = useState(false)
  const [foodSearchOpen, setFoodSearchOpen] = useState(false)

  // Per-date snapshot of last-seen totals. We only celebrate when totals
  // *transition* from below to at-or-above a target — so reloading the page
  // or navigating to a previously-perfect day doesn't re-fire confetti.
  const prevTotalsRef = useRef({})  // { 'YYYY-MM-DD': { calories, protein, carbs, fat } }
  const toastTimerRef = useRef(null)

  // Load from storage once
  useEffect(() => {
    const raw = storage.get(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        setLogs(parsed.logs || {})
        setWeights(parsed.weights || {})
        if (parsed.profile) {
          setProfile({
            ...DEFAULT_PROFILE,
            ...parsed.profile,
            targets: { ...DEFAULT_PROFILE.targets, ...(parsed.profile.targets || {}) }
          })
        }
      } catch { /* corrupted, ignore */ }
    }
    setLoaded(true)
  }, [])

  // Persist on change
  useEffect(() => {
    if (!loaded) return
    storage.set(STORAGE_KEY, JSON.stringify({ logs, weights, profile }))
  }, [logs, weights, profile, loaded])

  // Browser notifications — request permission once, then fire on meal/water triggers
  const firedNotifs = useRef(new Set())
  const [notifPermission, setNotifPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'denied'
  )
  useEffect(() => {
    if (!loaded) return
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(result => {
        setNotifPermission(result)
        if (result === 'granted') {
          new Notification('🔔 Fuel reminders active', {
            body: 'You\'ll get pop-ups for unlogged meals and water checkpoints.',
            icon: '/favicon.ico',
          })
        }
      })
    }
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    const check = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const today = todayISO()
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const dayLog = logs[today] || { meals: [], water: 0 }
      const water = dayLog.water || 0
      const wTarget = profile.waterTarget
      const dayPlan = WEEK_PLAN[isoToDayKey(today)]

      // Meal reminders — 15 min grace period after scheduled time
      dayLog.cheatDay || dayPlan.forEach(meal => {
        if (nowMin < meal.timeMin + 15) return
        const log = dayLog.meals.find(x => x.mealId === meal.id)
        if (log?.status === 'eaten_as_planned' || log?.status === 'logged_actual' || log?.status === 'skipped') return
        const id = `meal-${meal.id}-${today}`
        if (firedNotifs.current.has(id)) return
        firedNotifs.current.add(id)
        new Notification(`🍽️ ${meal.type}`, { body: `${meal.food} — log it or skip`, tag: id, icon: '/favicon.ico' })
      })

      // Water reminders at checkpoints — only fire if below the threshold
      const waterCheckpoints = [
        { minTime: 10 * 60, id: `w-10-${today}`, pctNeeded: 0.01, msg: 'You haven\'t logged any water yet. Start hydrating!' },
        { minTime: 14 * 60, id: `w-14-${today}`, pctNeeded: 0.40, msg: `Only ${Math.round((water/wTarget)*100)}% done — aim for 40% by now.` },
        { minTime: 18 * 60, id: `w-18-${today}`, pctNeeded: 0.70, msg: `${wTarget - water}ml to go — keep it up!` },
        { minTime: 21 * 60, id: `w-21-${today}`, pctNeeded: 1.00, msg: `${wTarget - water}ml left to hit your daily target.` },
      ]
      waterCheckpoints.forEach(({ minTime, id, pctNeeded, msg }) => {
        if (nowMin < minTime) return
        if (water / wTarget >= pctNeeded) return
        if (firedNotifs.current.has(id)) return
        firedNotifs.current.add(id)
        new Notification('💧 Hydration Reminder', { body: msg, tag: id, icon: '/favicon.ico' })
      })
    }
    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [logs, loaded, profile.waterTarget, notifPermission])

  const flash = useCallback((msg) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2400)
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const fireConfetti = useCallback(() => setConfettiKey(k => k + 1), [])

  // Watch the currently-viewed day's totals; celebrate only when totals
  // transition from *below* a target to *at-or-above* it. First observation
  // of a date primes the snapshot without firing — so existing data on
  // page load or revisited dates never trigger a stale celebration.
  useEffect(() => {
    if (!loaded) return
    const dayKey = isoToDayKey(date)
    const plan = WEEK_PLAN[dayKey]
    const dayLog = logs[date]
    const water = dayLog?.water || 0
    const totals = dayLog
      ? { ...sumLogged(dayLog, plan), water }
      : { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 }
    const prev = prevTotalsRef.current[date]
    prevTotalsRef.current[date] = totals
    if (!prev) return  // first time seeing this date — prime, don't celebrate

    const t = profile.targets
    const justCrossed = (key, min) => prev[key] < min && totals[key] >= min
    const proteinUp = justCrossed('protein',  t.protein.min)
    const calsUp    = justCrossed('calories', t.calories.min)
    const carbsUp   = justCrossed('carbs',    t.carbs.min)
    const fatUp     = justCrossed('fat',      t.fat.min)
    const waterUp   = justCrossed('water',    profile.waterTarget)

    const allMacrosMet =
      totals.protein  >= t.protein.min  &&
      totals.calories >= t.calories.min &&
      totals.carbs    >= t.carbs.min    &&
      totals.fat      >= t.fat.min

    if ((proteinUp || calsUp || carbsUp || fatUp) && allMacrosMet) {
      fireConfetti()
      flash('💯 Perfect day — all macros locked in!')
    } else if (proteinUp) {
      fireConfetti()
      flash('🔥 Protein target smashed!')
    } else if (waterUp) {
      fireConfetti()
      flash('💧 Hydration goal hit — way to flow!')
    }
  }, [logs, date, profile, loaded, flash, fireConfetti])

  const openLogger = (m) => setLogger(m)

  const submitLog = (form) => {
    if (!logger) return
    setLogs(prev => upsertMealLog(prev, date, {
      mealId: logger.mealId,
      status: 'logged_actual',
      ...form
    }))
    setLogger(null)
  }

  const submitExtra = (form) => {
    setLogs(prev => upsertMealLog(prev, date, {
      mealId: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'extra',
      ...form
    }))
    setLogger(null)
  }

  const logFoodDirect = (items) => {
    const arr = Array.isArray(items) ? items : [items]
    const groupId = arr.length > 1 ? `group-${Date.now()}` : undefined
    setLogs(prev => arr.reduce((acc, { name, displayName, cal, protein, carbs, fat }) =>
      upsertMealLog(acc, date, {
        mealId: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'extra',
        loggedFood: name,
        displayName: displayName || name,
        calories: cal,
        protein, carbs, fat,
        ...(groupId ? { groupId } : {}),
      }), prev))
    setFoodSearchOpen(false)
    setChooserOpen(false)
    flash(arr.length > 1 ? `✅ ${arr.length} items logged` : `✅ ${arr[0].name} logged`)
  }

  const openWorkoutLogger = (payload) => setWorkoutLogger(payload)

  const submitWorkout = (form) => {
    if (!workoutLogger) return
    const targetDate = workoutLogger.date || date
    const isPlanned = !!workoutLogger.planned
    const id = workoutLogger.workoutId
      || (isPlanned ? 'planned' : `wk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    setLogs(prev => upsertWorkout(prev, targetDate, {
      id,
      planned: isPlanned,
      status: 'done',
      ...form
    }))
    flash(isPlanned ? '💪 Workout locked in!' : `💪 ${form.type} logged`)
    setWorkoutLogger(null)
  }

  const addWater = (delta) => {
    setLogs(prev => {
      const day = prev[date] || { meals: [], water: 0 }
      const next = Math.max(0, (day.water || 0) + delta)
      return { ...prev, [date]: { ...day, water: next } }
    })
  }

  const dayKey = isoToDayKey(date)
  const existingLog = logger ? findLogForMeal(logs, date, logger.mealId) : null
  const water = (logs[date] || {}).water || 0

  return (
    <div className="min-h-full max-w-md mx-auto">
      {/* Header */}
      <header className="glass border-b border-white/5 px-4 pb-3 header-safe sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 flex items-center gap-1.5">
              <span>{greetingFor(profile.name).text}</span>
              <span className="text-sm leading-none normal-case">{greetingFor(profile.name).emoji}</span>
            </div>
            <div className="text-base font-display font-bold text-white truncate">{profile.goal}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right text-[10px] text-zinc-400 leading-tight tabular-nums">
              <div className="flex items-center gap-1 justify-end"><span className="text-[#d7ff3a]">●</span> {profile.targets.calories.min}–{profile.targets.calories.max} kcal</div>
              <div>P {profile.targets.protein.min}–{profile.targets.protein.max}g</div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Edit goals"
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-zinc-300 active:scale-95 transition"
            ><Settings size={16} strokeWidth={2.2} /></button>
          </div>
        </div>
      </header>

      <main className="p-3">
        <div key={tab} className="page-enter">
          {tab === 'today'  && <TodayView   date={date} setDate={setDate} logs={logs} setLogs={setLogs} openLogger={openLogger} openWorkoutLogger={openWorkoutLogger} openChooser={() => setChooserOpen(true)} profile={profile} weights={weights} setWeights={setWeights} onOpenWater={() => setWaterOpen(true)} onOpenWeight={() => setWeightOpen(true)} />}
          {tab === 'log'    && <SummaryView logs={logs} profile={profile} weights={weights} setWeights={setWeights} />}
          {tab === 'snacks' && <SnacksView  date={date} setLogs={setLogs} flash={flash} />}
        </div>
      </main>

      {/* Floating + button — opens chooser (food / workout) */}
      {tab === 'today' && (
        <button
          onClick={() => setChooserOpen(true)}
          className="fab-safe fixed left-1/2 -translate-x-1/2 z-40 pl-3 pr-4 py-2.5 rounded-full bg-[#d7ff3a] text-black flex items-center gap-1.5 active:scale-95 hover:bg-[#c6ee29] transition"
          style={{ boxShadow: '0 12px 30px rgba(215, 255, 58, 0.35), 0 6px 16px rgba(0,0,0,0.55)' }}
          aria-label="Quick log"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span className="text-sm font-semibold tracking-wide">Quick log</span>
        </button>
      )}

      <BottomNav tab={tab} setTab={setTab} />

      {/* Logger modal */}
      <Modal open={!!logger} onClose={() => setLogger(null)}>
        {logger && (
          <LogForm
            initial={existingLog}
            title={logger.extra ? 'Log extra food' : `Log: ${logger.mealName}`}
            onSubmit={logger.extra ? submitExtra : submitLog}
            onCancel={() => setLogger(null)}
          />
        )}
      </Modal>

      {/* Quick-log chooser */}
      <Modal open={chooserOpen} onClose={() => setChooserOpen(false)}>
        {chooserOpen && (
          <LogChooser
            onPickFood={() => {
              setChooserOpen(false)
              setFoodSearchOpen(true)
            }}
            onPickWorkout={() => {
              setChooserOpen(false)
              openWorkoutLogger({ date, planned: false })
            }}
          />
        )}
      </Modal>

      {/* Food search modal */}
      <Modal open={foodSearchOpen} onClose={() => setFoodSearchOpen(false)}>
        {foodSearchOpen && <FoodSearchModal onAdd={logFoodDirect} onClose={() => setFoodSearchOpen(false)} />}
      </Modal>

      {/* Workout logger modal */}
      <Modal open={!!workoutLogger} onClose={() => setWorkoutLogger(null)}>
        {workoutLogger && (
          <WorkoutForm
            initial={workoutLogger.initial}
            prefill={workoutLogger.prefill}
            title={workoutLogger.planned && !workoutLogger.initial ? 'Mark workout done' : (workoutLogger.initial ? 'Edit workout' : 'Log workout')}
            onSubmit={submitWorkout}
            onCancel={() => setWorkoutLogger(null)}
          />
        )}
      </Modal>

      {/* Water modal */}
      <Modal open={waterOpen} onClose={() => setWaterOpen(false)}>
        {waterOpen && <WaterModal water={water} target={profile.waterTarget} onAdd={addWater} onClose={() => setWaterOpen(false)} />}
      </Modal>

      {/* Weight modal */}
      <Modal open={weightOpen} onClose={() => setWeightOpen(false)}>
        {weightOpen && <WeightInputCard weights={weights} setWeights={setWeights} currentWeight={profile.weight} />}
      </Modal>

      {/* Settings modal */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)}>
        {showSettings && (
          <SettingsForm
            profile={profile}
            onSave={(p) => { setProfile(p); setShowSettings(false); flash('Goals updated 💪') }}
            onCancel={() => setShowSettings(false)}
            onReset={() => { setProfile(DEFAULT_PROFILE); setShowSettings(false); flash('Back to defaults') }}
          />
        )}
      </Modal>

      {/* Confetti — re-mounts on key change so each celebration restarts */}
      {confettiKey > 0 && <Confetti key={confettiKey} />}

      {/* Toast — outer wrapper handles centering, inner handles the pop animation */}
      {toast && (
        <div className="toast-safe fixed left-1/2 -translate-x-1/2 z-50 px-4">
          <div key={toast} className="glass text-zinc-100 text-sm px-4 py-2.5 rounded-2xl shadow-2xl border border-white/10 pop whitespace-nowrap">{toast}</div>
        </div>
      )}
    </div>
  )
}
