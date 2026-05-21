export interface FirstAidItem {
  title: string;
  symptoms: string[];
  steps: string[];
  medications: string[];
  warnings: string[];
}

export const FIRST_AID_DATA: Record<string, FirstAidItem> = {
  "low_blood_pressure": {
    title: "Acute Low Blood Pressure (Hypotension)",
    symptoms: [
      "Dizziness or lightheadedness",
      "Fainting (syncope)",
      "Blurred vision",
      "Nausea",
      "Fatigue or lack of concentration"
    ],
    steps: [
      "Help the person lie down flat on their back immediately.",
      "Elevate their legs about 12 inches (30 cm) above heart level to restore blood flow to the brain.",
      "Give them a glass of water or a slightly salty drink (such as an electrolyte/sports drink) if they are fully conscious. DO NOT give liquids to an unconscious person.",
      "Loosen any tight clothing around their neck or waist.",
      "Keep them warm with a blanket and encourage them to rest without sudden movements."
    ],
    medications: [
      "Do not start blood-pressure medicine or salt tablets without a clinician's plan.",
      "If the person is already prescribed BP medication, note the last dose time and share it with a doctor.",
      "Oral rehydration solution can help if dehydration is likely and the person is awake."
    ],
    warnings: [
      "Do not let the person stand up too quickly.",
      "If fainting lasts more than a minute, or is accompanied by chest pain or shortness of breath, call emergency services immediately."
    ]
  },
  "high_blood_sugar": {
    title: "High Blood Sugar Crisis (Hyperglycemia)",
    symptoms: [
      "Extreme thirst or dry mouth",
      "Frequent urination",
      "Fatigue or weakness",
      "Fruity-smelling breath",
      "Confusion or shortness of breath"
    ],
    steps: [
      "Encourage the person to drink plenty of water or sugar-free liquids to flush out excess glucose.",
      "If they are diabetic and have their prescribed insulin, assist them in administering their dose as per their medical plan.",
      "Check their blood sugar levels using a glucose monitor if available.",
      "Monitor their breathing and consciousness closely."
    ],
    medications: [
      "Use only the person's prescribed insulin or diabetes medication plan.",
      "Do not guess insulin doses for someone else.",
      "Avoid sugary drinks or glucose tablets unless low blood sugar is suspected or confirmed."
    ],
    warnings: [
      "Never administer insulin to a person who is unconscious or unable to swallow.",
      "If they show signs of severe vomiting, rapid deep breathing, or confusion (Diabetic Ketoacidosis), seek immediate emergency medical care."
    ]
  },
  "heat_exhaustion": {
    title: "Heat Exhaustion & Heatstroke",
    symptoms: [
      "Heavy sweating or pale, cold, clammy skin",
      "Rapid, weak pulse",
      "Nausea, vomiting, or muscle cramps",
      "Headache, dizziness, or weakness",
      "High body temperature (above 103°F / 39.4°C in heatstroke)"
    ],
    steps: [
      "Move the person to a cool, shaded, or air-conditioned area immediately.",
      "Loosen or remove excess layers of clothing.",
      "Cool them down by applying cool, wet cloths to their head, neck, armpits, and groin, or misting them with water.",
      "Give them cool water to sip slowly if they are fully conscious."
    ],
    medications: [
      "Avoid fever medicines such as paracetamol/acetaminophen for heatstroke; cooling is the priority.",
      "Use oral rehydration solution if available and the person can drink safely.",
      "Continue regular medicines only if the person is alert and a clinician has not advised stopping."
    ],
    warnings: [
      "Do not give them drinks containing alcohol or excessive caffeine.",
      "If the person refuses to drink, vomits, or loses consciousness (signs of Heatstroke), call emergency services immediately. Do not give an unconscious person anything by mouth."
    ]
  },
  "minor_burns": {
    title: "Minor Thermal Burns (1st & 2nd Degree)",
    symptoms: [
      "Redness and swelling",
      "Pain at the burn site",
      "Small blister formation"
    ],
    steps: [
      "Hold the burned area under cool (not cold or icy) running tap water for 10 to 15 minutes.",
      "Gently pat the area dry with a clean cloth.",
      "Cover the burn loosely with a sterile, non-stick bandage or gauze to protect the blistered skin.",
      "Over-the-counter pain relievers can be taken if necessary."
    ],
    medications: [
      "Paracetamol/acetaminophen or ibuprofen may help pain if the person can safely take them.",
      "A thin layer of sterile burn gel may be used after cooling if available.",
      "Do not apply antibiotic creams, steroid creams, or home remedies unless advised by a clinician."
    ],
    warnings: [
      "Never apply ice, butter, grease, or household ointments to a fresh burn; this traps heat and increases tissue damage.",
      "Do not pop blisters, as this increases the risk of infection."
    ]
  }
};
