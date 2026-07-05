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
    sm: 12,
    md: 18,
    lg: 24,
    xl: 30,
    round: 9999
  },

  // Neumorphism + Glassmorphism design language.
  // No hard outlines — depth is conveyed purely through translucent
  // glass fills and soft, layered shadows.
  glass: {
    surface: 'rgba(255, 255, 255, 0.055)',   // resting frosted glass
    surfaceStrong: 'rgba(255, 255, 255, 0.085)', // raised / hovered glass
    inset: 'rgba(0, 0, 0, 0.22)',            // carved-in fields (inputs)
    accent: 'rgba(231, 70, 39, 0.14)',       // active / selected glass tint
    accentStrong: 'rgba(231, 70, 39, 0.20)',
    danger: 'rgba(231, 76, 60, 0.12)',
    success: 'rgba(46, 204, 113, 0.10)',
  },

  // Soft-UI shadow presets. Large, diffuse, dark drop shadows lift the
  // glass off the deep-black backdrop like extruded neumorphic panels.
  shadow: {
    soft: {
      shadowColor: '#000000',
      shadowOpacity: 0.34,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
    lifted: {
      shadowColor: '#000000',
      shadowOpacity: 0.42,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 20 },
      elevation: 10,
    },
    glowAccent: {
      shadowColor: '#E74627',
      shadowOpacity: 0.5,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 9,
    },
  },
} as const;
