/*
  Convertify – Währungs- & Einheiten-Umrechner
  Autor: Dein Name
  2025
*/

const categorySelect = document.getElementById("categorySelect");
const amountInput = document.getElementById("amount");
const fromUnitSelect = document.getElementById("fromUnit");
const toUnitSelect = document.getElementById("toUnit");
const resultSpan = document.getElementById("result");
const swapBtn = document.getElementById("swapBtn");
const copyBtn = document.getElementById("copyBtn");
const loadingDiv = document.getElementById("loading");
const errorDiv = document.getElementById("errorMsg");
const darkModeToggle = document.getElementById("darkModeToggle");

// Einheitendaten mit Umrechnungsfaktoren (Basiswert = 1 für jede Kategorie)
const unitsData = {
  currency: {
    label: "Währungen",
    // Wird per API geladen, hier nur Codes mit Anzeigenamen
    units: {
      EUR: "Euro (€)",
      USD: "US-Dollar ($)",
      GBP: "Britisches Pfund (£)",
      JPY: "Japanischer Yen (¥)"
    }
  },
  length: {
    label: "Länge",
    units: {
      meter: { name: "Meter (m)", factor: 1 },
      kilometer: { name: "Kilometer (km)", factor: 1000 },
      mile: { name: "Meile (mi)", factor: 1609.34 },
      foot: { name: "Fuß (ft)", factor: 0.3048 },
      inch: { name: "Zoll (in)", factor: 0.0254 }
    }
  },
  weight: {
    label: "Gewicht",
    units: {
      kilogram: { name: "Kilogramm (kg)", factor: 1 },
      gram: { name: "Gramm (g)", factor: 0.001 },
      pound: { name: "Pfund (lb)", factor: 0.453592 },
      ounce: { name: "Unze (oz)", factor: 0.0283495 }
    }
  },
  temperature: {
    label: "Temperatur",
    units: {
      celsius: { name: "Celsius (°C)" },
      fahrenheit: { name: "Fahrenheit (°F)" },
      kelvin: { name: "Kelvin (K)" }
    }
  },
  volume: {
    label: "Volumen",
    units: {
      liter: { name: "Liter (l)", factor: 1 },
      milliliter: { name: "Milliliter (ml)", factor: 0.001 },
      gallon: { name: "US Gallone (gal)", factor: 3.78541 },
      pint: { name: "US Pint (pt)", factor: 0.473176 }
    }
  },
  time: {
    label: "Zeit",
    units: {
      second: { name: "Sekunde (s)", factor: 1 },
      minute: { name: "Minute (min)", factor: 60 },
      hour: { name: "Stunde (h)", factor: 3600 },
      day: { name: "Tag (d)", factor: 86400 }
    }
  },
  data: {
    label: "Datenmenge",
    units: {
      bit: { name: "Bit (b)", factor: 1 },
      byte: { name: "Byte (B)", factor: 8 },
      kilobyte: { name: "Kilobyte (kB)", factor: 8000 },
      megabyte: { name: "Megabyte (MB)", factor: 8e6 },
      gigabyte: { name: "Gigabyte (GB)", factor: 8e9 }
    }
  }
};

// Aktuelle Wechselkurse, werden per API geladen, hier Startwerte als Fallback
let exchangeRates = {
  base: "EUR",
  rates: {
    USD: 1.1,
    GBP: 0.85,
    JPY: 140
  }
};

function formatNumber(num) {
  return Number.parseFloat(num).toLocaleString("de-DE", {maximumFractionDigits: 4});
}

// Lädt Wechselkurse von fixer API
async function fetchExchangeRates() {
  loadingDiv.style.display = "block";
  errorDiv.style.display = "none";
  try {
    const response = await fetch("https://api.exchangerate.host/latest?base=EUR");
    if(!response.ok) throw new Error("Netzwerkfehler");
    const data = await response.json();
    exchangeRates = data;
    // Aktualisiere currencies Units dynamisch
    const keys = Object.keys(exchangeRates.rates);
    unitsData.currency.units = {};
    for (const key of keys) {
      unitsData.currency.units[key] = key;
    }
    // Füge Basiswährung hinzu
    unitsData.currency.units[exchangeRates.base] = exchangeRates.base;
    populateUnits();
  } catch(e) {
    errorDiv.style.display = "block";
    console.error("Fehler beim Laden der Wechselkurse:", e);
  } finally {
    loadingDiv.style.display = "none";
  }
}

// Füllt die Einheiten Dropdowns je nach Kategorie
function populateUnits() {
  const category = categorySelect.value;
  const unitsObj = unitsData[category]?.units;
  if (!unitsObj) return;
  // Clear previous options
  fromUnitSelect.innerHTML = "";
  toUnitSelect.innerHTML = "";

  // Sortiere Einheiten alphabetisch, außer Währung bleibt so
  let entries = Object.entries(unitsObj);
  if(category !== "currency") {
    entries.sort((a,b) => a[1].name.localeCompare(b[1].name));
  }

  for (const [key, val] of entries) {
    const name = (category === "currency") ? val + ` (${key})` : val.name;
    const optionFrom = document.createElement("option");
    optionFrom.value = key;
    optionFrom.textContent = name;
    fromUnitSelect.appendChild(optionFrom);

    const optionTo = document.createElement("option");
    optionTo.value = key;
    optionTo.textContent = name;
    toUnitSelect.appendChild(optionTo);
  }

  // Default Auswahl: erste und zweite Einheit
  fromUnitSelect.selectedIndex = 0;
  toUnitSelect.selectedIndex = entries.length > 1 ? 1 : 0;

  calculateResult();
}

// Konvertiert Temperatur separat wegen Formeln
function convertTemperature(value, from, to) {
  let celsius;

  switch(from) {
    case "celsius": celsius = value; break;
    case "fahrenheit": celsius = (value - 32) * 5/9; break;
    case "kelvin": celsius = value - 273.15; break;
    default: return NaN;
  }

  switch(to) {
    case "celsius": return celsius;
    case "fahrenheit": return (celsius * 9/5) + 32;
    case "kelvin": return celsius + 273.15;
    default: return NaN;
  }
}

// Berechnet das Ergebnis je nach Kategorie und Eingabe
function calculateResult() {
  const category = categorySelect.value;
  const amount = parseFloat(amountInput.value);
  if(isNaN(amount)) {
    resultSpan.textContent = "-";
    return;
  }
  const fromUnit = fromUnitSelect.value;
  const toUnit = toUnitSelect.value;

  if(fromUnit === toUnit) {
    resultSpan.textContent = formatNumber(amount);
    return;
  }

  let result;

  if(category === "currency") {
    // Währungsumrechnung mit exchangeRates
    const base = exchangeRates.base;
    const rates = exchangeRates.rates;

    // Betrag in Basiswährung umrechnen
    let amountInBase;
    if(fromUnit === base) {
      amountInBase = amount;
    } else if(rates[fromUnit]) {
      amountInBase = amount / rates[fromUnit];
    } else {
      resultSpan.textContent = "–";
      return;
    }

    // Basiswährung in Zielwährung umrechnen
    if(toUnit === base) {
      result = amountInBase;
    } else if(rates[toUnit]) {
      result = amountInBase * rates[toUnit];
    } else {
      resultSpan.textContent = "–";
      return;
    }
  } else if(category === "temperature") {
    result = convertTemperature(amount, fromUnit, toUnit);
  } else {
    // Andere Einheiten mit Faktor (alle relativ zu Basis)
    const fromFactor = unitsData[category].units[fromUnit]?.factor;
    const toFactor = unitsData[category].units[toUnit]?.factor;
    if(!fromFactor || !toFactor) {
      resultSpan.textContent = "-";
      return;
    }
    result = (amount * fromFactor) / toFactor;
  }

  resultSpan.textContent = formatNumber(result);
}

// Tauscht von <-> nach Einheit
function swapUnits() {
  const temp = fromUnitSelect.value;
  fromUnitSelect.value = toUnitSelect.value;
  toUnitSelect.value = temp;
  calculateResult();
}

// Kopiert Ergebnis in Zwischenablage
function copyResult() {
  const text = resultSpan.textContent;
  if(text && text !== "-") {
    navigator.clipboard.writeText(text).then(() => {
      alert("Ergebnis kopiert: " + text);
    });
  }
}

// Dark Mode speichern und laden
function applyDarkMode(enabled) {
  if(enabled) {
    document.body.classList.add("darkmode");
  } else {
    document.body.classList.remove("darkmode");
  }
  localStorage.setItem("darkMode", enabled);
}

function loadDarkModeSetting() {
  const saved = localStorage.getItem("darkMode");
  const enabled = saved === "true";
  darkModeToggle.checked = enabled;
  applyDarkMode(enabled);
}

// Event Listeners
categorySelect.addEventListener("change", () => {
  populateUnits();
  calculateResult();
});

amountInput.addEventListener("input", calculateResult);
fromUnitSelect.addEventListener("change", calculateResult);
toUnitSelect.addEventListener("change", calculateResult);

swapBtn.addEventListener("click", () => {
  swapUnits();
  calculateResult();
});

copyBtn.addEventListener("click", copyResult);

darkModeToggle.addEventListener("change", (e) => {
  applyDarkMode(e.target.checked);
});

// Initial Setup
loadDarkModeSetting();
populateUnits();
fetchExchangeRates();
