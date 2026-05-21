export const THEME = {
  colors: {
    background: '#080807',       // Premium deep rich black from palette
    surface: 'rgba(255, 255, 255, 0.07)', // Clean translucent white glass surface
    border: 'rgba(255, 255, 255, 0.18)', // Sleek white glass outline
    text: '#FFFFFF',             // Absolute white text (for general screen text)
    textMuted: '#A0A0A0',        // Legible light-gray text for glass card contents
    
    // Harmony colors from the palette image
    primary: '#E74627',          // Premium Bright Neon Orange
    accent: '#F18F2E',           // Electric Accent Orange
    rust: '#7D2817',             // Rich dark rust/red-brown
    charcoal: '#1D1D1C',         // Dark premium charcoal
    
    // Mood states mapped beautifully
    mood: {
      Happy: '#2ECC71',          // Emerald Green
      Overwhelmed: '#E74C3C',    // Crimson Red
      Exhausted: '#7F8C8D',      // Slate Gray
      'Low Energy': '#F1C40F',   // Vibrant Amber Gold
      Neutral: '#34495E'         // Muted Blue-Grey
    },
    
    success: '#2ECC71',
    warning: '#F39C12',
    danger: '#E74C3C',
    info: '#3498DB'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 20,
    round: 9999
  }
};
