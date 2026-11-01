/*
  ============================================================
  STUDY PIE - SETTINGS FILE
  Change colours, doodles, study times and countdowns here.
  After editing: save, upload to GitHub, refresh the app.
  ============================================================
*/

window.CONFIG = {

  /* ---------- COLOURS ----------
     name (one word) + hex code. Pick hex codes at https://htmlcolorcodes.com */
  colors: [
    { name: "sky",    hex: "#a6d8f5" },
    { name: "sun",    hex: "#ffe37d" },
    { name: "orange", hex: "#ffc27f" },
    { name: "peach",  hex: "#ffb5a5" },
    { name: "pink",   hex: "#f7aacb" },
    { name: "lilac",  hex: "#d2c1f2" },
    { name: "violet", hex: "#ad9ff0" },
    { name: "mint",   hex: "#aee8c6" },
    { name: "leaf",   hex: "#cbe78f" },
    { name: "teal",   hex: "#94dbd3" },
    { name: "red",    hex: "#ff9898" },
    { name: "sand",   hex: "#ecd7ad" }
  ],

  /* ---------- THE 3 TRACKS ---------- */
  tracks: {
    mern: { name: "MERN",    emoji: "💻", color: "sky"   },
    gate: { name: "GATE DA", emoji: "📘", color: "peach" },
    gre:  { name: "GRE",     emoji: "✈️", color: "lilac" },
    other:{ name: "Other",   emoji: "⭐", color: "sun"   }   // for anything new you add yourself
  },

  /* ---------- STUDY TIMES ----------
     24-hour clock, "HH:MM". Easier: change them inside the app (Log → Settings). */
  slots: {
    mern:  { start: "08:00", end: "09:00" },   // MERN learning hour
    gateA: { start: "13:00", end: "16:00" },   // GATE afternoon block
    gateE: { start: "19:30", end: "22:30" },   // GATE evening block
    gateF: { start: "13:00", end: "15:00" },   // GATE final-stretch revision (Feb)
    gre:   { start: "19:30", end: "22:30" }    // GRE evening block (Mar–Jun)
  },

  /* ---------- SUBJECT LOOKS ----------
     Colour + doodle for each subject's slice. Anything not listed uses its track's look. */
  subjects: {
    "MERN":                    { color: "sky",    emoji: "💻" },
    "Capstone":                { color: "teal",   emoji: "🏗️" },
    "Python":                  { color: "sky",    emoji: "🐍" },
    "Programming & DSA":       { color: "teal",   emoji: "🧩" },
    "Probability":             { color: "peach",  emoji: "🎲" },
    "Statistics":              { color: "orange", emoji: "📊" },
    "Linear Algebra":          { color: "leaf",   emoji: "🧮" },
    "Calculus":                { color: "mint",   emoji: "📈" },
    "DBMS":                    { color: "lilac",  emoji: "🗄️" },
    "Data Warehousing":        { color: "violet", emoji: "🏬" },
    "Machine Learning":        { color: "sun",    emoji: "🤖" },
    "Artificial Intelligence": { color: "pink",   emoji: "🧠" },
    "Revision":                { color: "sand",   emoji: "🔁" },
    "PYQs":                    { color: "red",    emoji: "🎯" },
    "Review":                  { color: "sand",   emoji: "📓" },
    "Final revision":          { color: "red",    emoji: "🏁" },
    "GRE":                     { color: "lilac",  emoji: "✈️" },
    "Custom":                  { }   // blocks you add yourself use their track's look
  },

  /* ---------- COUNTDOWNS ----------
     Only used the very first time. After that, change them inside the app: Log → Settings. */
  countdowns: [
    { emoji: "🎯", label: "GATE", date: "2027-02-06" },
    { emoji: "✈️", label: "GRE",  date: "2027-06-14" }
  ]
};
