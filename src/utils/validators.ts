export function validateBloodPressure(systolic: string, diastolic: string): { valid: boolean; error?: string; parsed?: { systolic: number; diastolic: number } } {
  const sys = parseInt(systolic, 10);
  const dia = parseInt(diastolic, 10);
  
  if (isNaN(sys) || isNaN(dia)) {
    return { valid: false, error: 'Metrics must be numeric digits.' };
  }
  
  if (sys < 50 || sys > 250) {
    return { valid: false, error: 'Systolic value out of logical safe range (50-250).' };
  }
  
  if (dia < 30 || dia > 150) {
    return { valid: false, error: 'Diastolic value out of logical safe range (30-150).' };
  }
  
  if (sys <= dia) {
    return { valid: false, error: 'Systolic pressure must exceed diastolic pressure.' };
  }
  
  return { valid: true, parsed: { systolic: sys, diastolic: dia } };
}

export function validateBloodSugar(glucose: string): { valid: boolean; error?: string; parsed?: number } {
  const val = parseFloat(glucose);
  
  if (isNaN(val)) {
    return { valid: false, error: 'Glucose level must be numeric.' };
  }
  
  if (val < 20 || val > 600) {
    return { valid: false, error: 'Glucose value out of safe clinical range (20-600 mg/dL).' };
  }
  
  return { valid: true, parsed: val };
}

export function validateWeight(weight: string): { valid: boolean; error?: string; parsed?: number } {
  const val = parseFloat(weight);
  
  if (isNaN(val)) {
    return { valid: false, error: 'Weight must be numeric.' };
  }
  
  if (val < 10 || val > 300) {
    return { valid: false, error: 'Weight out of valid bounds (10-300 kg).' };
  }
  
  return { valid: true, parsed: val };
}
