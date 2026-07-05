import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Animated,
  Easing,
  Modal,
  Linking,
  AppState,
  Image
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Menu, Settings as SettingsIcon, LogOut, X, User, Heart, Check, Square, CheckSquare, Home, FileText, Wallet, Activity, MapPin, ListChecks, MessageSquareWarning, ChevronLeft, Send, BookOpen } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop, Filter, FeTurbulence, FeColorMatrix, FeComposite } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import { Todo, TodoRecurrence, Complaint, AppUpdate } from './src/types';
import { useAuth } from './src/hooks/useAuth';
import { useRealtimeNotes } from './src/hooks/useRealtimeNotes';
import { useMood } from './src/hooks/useMood';
import { useTodos } from './src/hooks/useTodos';
import { usePeriods } from './src/hooks/usePeriods';
import { useComplaints } from './src/hooks/useComplaints';
import { useLocation } from './src/hooks/useLocation';
import { formatDistance, formatUpdatedAgo, haversineMeters, mapsUrl } from './src/services/locationService';
import { configureNotificationsAsync, PRIORITY_CHANNEL } from './src/services/notification';
import { cancelScheduledNotificationsByPrefix, scheduleSharedReminder, scheduleLocalNotification } from './src/services/notification';
import { supabase } from './src/services/supabase';
import { checkAndApplyUpdate, fetchAppUpdates, getLastSeenUpdateAt, markUpdatesSeen, unseenUpdates } from './src/services/updates';
import { getWordOfDay } from './src/constants/vocabulary';
import { FIRST_AID_DATA } from './src/constants/firstAidData';
import { THEME } from './src/constants/theme';

const DAY_OPTIONS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function SpaceBackdrop() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
      <Defs>
        {/* Soft, top-right atmospheric glow blending neon orange into deep black */}
        <RadialGradient id="topRightOrangeGlow" cx="95%" cy="5%" r="110%" fx="95%" fy="5%">
          <Stop offset="0%" stopColor="#E74627" stopOpacity="0.85" />
          <Stop offset="30%" stopColor="#F18F2E" stopOpacity="0.45" />
          <Stop offset="65%" stopColor="#7D2817" stopOpacity="0.18" />
          <Stop offset="100%" stopColor="#080807" stopOpacity="0" />
        </RadialGradient>

        {/* Bottom absolute black atmospheric fade out (dark below pill taskbar) */}
        <SvgLinearGradient id="bottomBlackFade" x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%" stopColor="#080807" stopOpacity="1.0" />
          <Stop offset="28%" stopColor="#080807" stopOpacity="1.0" />
          <Stop offset="38%" stopColor="#080807" stopOpacity="0.95" />
          <Stop offset="55%" stopColor="#080807" stopOpacity="0.40" />
          <Stop offset="80%" stopColor="#080807" stopOpacity="0" />
        </SvgLinearGradient>

        {/* High-fidelity SVG grain noise filter overlay */}
        <Filter id="noiseFilter">
          <FeTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" result="noise" />
          <FeColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.065 0" />
          <FeComposite operator="in" in2="SourceGraphic" />
        </Filter>
      </Defs>

      {/* Solid black base background layer */}
      <Rect width="390" height="844" fill="#080807" />
      
      {/* Dynamic top-right neon orange light */}
      <Rect width="390" height="844" fill="url(#topRightOrangeGlow)" />
      
      {/* Bottom atmospheric black fade overlay to cover space below the pill taskbar */}
      <Rect width="390" height="844" fill="url(#bottomBlackFade)" />
      
      {/* Tactical grain overlay blending the background with noise */}
      <Rect width="390" height="844" fill="#080807" filter="url(#noiseFilter)" opacity="0.45" />
    </Svg>
  );
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * PressableScale — a touchable that gently springs inward on press.
 * Gives every interactive glass surface a soft, tactile neumorphic response.
 */
function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.96,
  disabled = false,
  activeOpacity = 0.92,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: any;
  scaleTo?: number;
  disabled?: boolean;
  activeOpacity?: number;
  hitSlop?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 7 }).start();
  return (
    <AnimatedTouchable
      activeOpacity={activeOpacity}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
}

/**
 * ScreenTransition — replays a soft fade + rise whenever its `key` changes.
 * Wrap tab content and key it on the active tab for seamless screen swaps.
 */
function ScreenTransition({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * AnimatedTabBar — frosted glass pill dock with a sliding accent indicator
 * that glides between tabs, plus per-item press springs.
 */
const TAB_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  hub: Home,
  notes: FileText,
  finances: Wallet,
  health: Activity,
};

function AnimatedTabBar<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: readonly T[];
  activeTab: T;
  onChange: (t: T) => void;
}) {
  const INNER_PAD = 6;
  const [barW, setBarW] = useState(0);
  // activeTab may be a Hub sub-screen (todos/complaints/bucket/location) that
  // isn't on the bar — indexOf is -1 then, so we hide the sliding indicator.
  const activeIndex = tabs.indexOf(activeTab);
  const onBar = activeIndex >= 0;
  const indicator = useRef(new Animated.Value(onBar ? activeIndex : 0)).current;
  const slotW = barW > 0 ? (barW - INNER_PAD * 2) / tabs.length : 0;

  useEffect(() => {
    if (!onBar) return;
    Animated.spring(indicator, {
      toValue: activeIndex,
      useNativeDriver: true,
      speed: 18,
      bounciness: 9,
    }).start();
  }, [activeIndex, onBar]);

  const translateX = indicator.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => INNER_PAD + i * slotW),
  });

  return (
    <View style={styles.tabBar} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
      {slotW > 0 && onBar && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabIndicator,
            { width: slotW, transform: [{ translateX }] },
          ]}
        />
      )}
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        const Icon = TAB_ICONS[tab] || Home;
        return (
          <PressableScale
            key={tab}
            scaleTo={0.9}
            style={styles.tabItem}
            onPress={() => onChange(tab)}
          >
            <Icon
              size={24}
              color={isActive ? '#F18F2E' : 'rgba(255,255,255,0.55)'}
              strokeWidth={isActive ? 2.5 : 2}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

const BlinkingBucketRow = ({ item, getCreatorName, onToggle, onDelete }: { item: any; getCreatorName: (creatorId?: string | null) => string; onToggle: () => void; onDelete: () => void }) => {
  const blinkAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(blinkAnim, { toValue: 0.15, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 0.15, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 0.15, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      onToggle();
    });
  };

  return (
    <Animated.View style={{ opacity: blinkAnim }}>
      <TouchableOpacity 
        style={[
          styles.bucketRow,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
            {item.is_completed ? (
              <CheckSquare size={18} color="#F18F2E" strokeWidth={2} />
            ) : (
              <Square size={18} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            )}
            <Text style={[styles.bucketText, item.is_completed && styles.strikethrough, { marginLeft: 8 }]}>
              {item.title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.financeMeta, { fontSize: 10, opacity: 0.6, marginRight: 12 }]}>By {getCreatorName(item.created_by)}</Text>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: 'rgba(255, 75, 75, 0.16)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={12} color="#FF4D4D" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
        {item.description ? (
          <Text style={[styles.bucketDescription, { opacity: 0.85, fontSize: 12, marginTop: 4 }]}>
            {item.description}
          </Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'hub' | 'notes' | 'finances' | 'health' | 'bucket' | 'location' | 'todos' | 'complaints'>('hub');

  // Custom hooks
  const { 
    session, 
    loading: authLoading, 
    profile, 
    partnerProfile, 
    coupleId,
    signUp,
    signIn,
    signOut,
    pairPartner,
    updateDisplayName,
    unpairPartner
  } = useAuth();
  const userId = session?.user?.id || null;

  // Auth local state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  // Pairing local state
  const [partnerIdInput, setPartnerIdInput] = useState('');

  const handleAuthSubmit = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (isSignUpMode) {
      if (!authDisplayName.trim()) {
        Alert.alert("Error", "Please enter a display name.");
        return;
      }
      await signUp(authEmail, authPassword, authDisplayName);
    } else {
      await signIn(authEmail, authPassword);
    }
  };

  const handlePairSubmit = async () => {
    if (!partnerIdInput.trim()) {
      Alert.alert("Error", "Please enter your partner's User ID.");
      return;
    }
    await pairPartner(partnerIdInput.trim());
  };

  const { notes, isPartnerTyping, addNote, removeNote } = useRealtimeNotes(coupleId, userId);
  const { currentMood, partnerMood, partnerName, updateMood } = useMood(coupleId, userId);
  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos(coupleId, userId);
  const { records, predictions, addPeriodLog, refreshPeriods } = usePeriods(coupleId);
  const {
    complaints,
    addComplaint,
    addReply,
    setStatus: setComplaintStatus,
    deleteComplaint,
    repliesFor,
  } = useComplaints(coupleId, userId);
  const {
    myLocation,
    partnerLocation,
    busy: locationBusy,
    isLive: isLiveSharing,
    errorMessage: locationError,
    shareOnce: shareMyLocation,
    setLive: setLiveSharing,
    stopSharing: stopLocationSharing,
  } = useLocation(coupleId, userId);
  const welcomeAnim = useRef(new Animated.Value(0)).current;
  const todosRef = useRef(todos);
  todosRef.current = todos;

  // Side drawer & settings states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState('');
  const drawerAnim = useRef(new Animated.Value(0)).current;

  // Sync temp display name with profile
  useEffect(() => {
    if (profile?.display_name) {
      setTempDisplayName(profile.display_name);
    }
  }, [profile]);

  const toggleDrawer = (open: boolean) => {
    if (open) {
      setIsDrawerOpen(true);
      Animated.timing(drawerAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setIsDrawerOpen(false));
    }
  };

  const handleSaveDisplayName = async () => {
    if (!tempDisplayName.trim()) {
      Alert.alert("Name required", "Please enter a valid display name.");
      return;
    }
    try {
      await updateDisplayName(tempDisplayName.trim());
      Alert.alert("Success", "Display name updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update display name.");
    }
  };

  const handleUnpairPress = () => {
    Alert.alert(
      "Unpair Partner?",
      "This will break the live synchronized channel. Are you sure you want to proceed?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Unpair", 
          style: "destructive", 
          onPress: async () => {
            setIsSettingsVisible(false);
            await unpairPartner();
          } 
        }
      ]
    );
  };

  // Local feature states
  const [firstAidSearch, setFirstAidSearch] = useState<string>('');
  const [matchingFirstAid, setMatchingFirstAid] = useState<any>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  
  // Finances
  const [financeItems, setFinanceItems] = useState<any[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'subscription' | 'borrowing' | 'self_liability'>('borrowing');
  const [financeDueDate, setFinanceDueDate] = useState('');
  const [financeRenewalCycle, setFinanceRenewalCycle] = useState<'none' | 'monthly' | 'yearly'>('none');

  // Bucket list
  const [bucketList, setBucketList] = useState<any[]>([]);
  const [newBucketTitle, setNewBucketTitle] = useState('');
  const [newBucketDescription, setNewBucketDescription] = useState('');

  // Period inputs
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [crampsIntensity, setCrampsIntensity] = useState<'none' | 'mild' | 'moderate' | 'heavy'>('none');
  const [moodSwings, setMoodSwings] = useState<'balanced' | 'irritable' | 'anxious' | 'sad'>('balanced');
  const [flowLevel, setFlowLevel] = useState<'light' | 'medium' | 'heavy'>('light');
  const [ovulationMucus, setOvulationMucus] = useState<'dry' | 'sticky' | 'creamy' | 'fertile'>('dry');

  // Tapping a NOVIA notification jumps to the relevant screen.
  useEffect(() => {
    const routeFromData = (data: any) => {
      if (!data) return;
      if (data.kind === 'todo') setActiveTab('todos');
      else if (data.kind === 'complaint') setActiveTab('complaints');
      else if (data.kind === 'update') { setIsSettingsVisible(true); markUpdatesViewed(); }
    };
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromData(response.notification.request.content.data);
    });
    return () => {
      responseSubscription.remove();
    };
  }, []);

  // Calendar states
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'periodStartDate' | 'periodEndDate' | 'hospitalDate' | 'financeDueDate' | 'todoDate' | null>(null);

  const openCalendarFor = (target: 'periodStartDate' | 'periodEndDate' | 'hospitalDate' | 'financeDueDate' | 'todoDate') => {
    setCalendarTarget(target);
    setIsCalendarVisible(true);
  };

  const handleDateSelect = (dateString: string) => {
    if (calendarTarget === 'periodStartDate') setPeriodStartDate(dateString);
    else if (calendarTarget === 'periodEndDate') setPeriodEndDate(dateString);
    else if (calendarTarget === 'hospitalDate') setHospitalDate(dateString);
    else if (calendarTarget === 'financeDueDate') setFinanceDueDate(dateString);
    else if (calendarTarget === 'todoDate') setTodoDate(dateString);
    setIsCalendarVisible(false);
    setCalendarTarget(null);
  };

  // GF Menstrual Prediction multi-choice questionnaire states
  const [gfBleeding, setGfBleeding] = useState<'none' | 'spotting' | 'light' | 'heavy'>('none');
  const [gfPhysical, setGfPhysical] = useState<'none' | 'cramps' | 'tender' | 'bloating' | 'energized'>('none');
  const [gfFluid, setGfFluid] = useState<'none' | 'dry' | 'sticky' | 'creamy' | 'eggwhite'>('none');
  const [gfEmotion, setGfEmotion] = useState<'calm' | 'irritable' | 'sad' | 'anxious' | 'happy'>('calm');
  const [gfEnergy, setGfEnergy] = useState<'low' | 'normal' | 'stressed' | 'high'>('normal');

  // Todo creator inputs
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoNotes, setNewTodoNotes] = useState('');
  const [todoHour, setTodoHour] = useState(9);
  const [todoMinute, setTodoMinute] = useState(0);
  const [todoDate, setTodoDate] = useState(''); // 'YYYY-MM-DD' first fire date
  const [todoRecurrence, setTodoRecurrence] = useState<TodoRecurrence>('once');

  const adjustTodoTime = (unit: 'hour' | 'minute', amount: number) => {
    if (unit === 'hour') {
      setTodoHour((current) => (current + amount + 24) % 24);
      return;
    }
    setTodoMinute((current) => (current + amount + 60) % 60);
  };

  // Complaint Box inputs
  const [newComplaintTitle, setNewComplaintTitle] = useState('');
  const [newComplaintBody, setNewComplaintBody] = useState('');
  const [openComplaintId, setOpenComplaintId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Updates / changelog
  const [appUpdates, setAppUpdates] = useState<AppUpdate[]>([]);
  const [hasUnseenUpdate, setHasUnseenUpdate] = useState(false);

  // Medical Record Vault
  const [medLogs, setMedLogs] = useState<any[]>([]);
  const [hospitalDate, setHospitalDate] = useState('');
  const [hospitalReason, setHospitalReason] = useState('');
  const [hospitalResults, setHospitalResults] = useState('');

  // Finance borrowing lender direction state
  const [financeLenderDirection, setFinanceLenderDirection] = useState<'me' | 'partner'>('me');

  // Configure notification permissions + channels upon login.
  useEffect(() => {
    if (session) {
      configureNotificationsAsync();
    }
  }, [session]);

  // Apply any OTA (EAS) JS update once on launch.
  useEffect(() => {
    checkAndApplyUpdate();
  }, []);

  // Roll the daily-vocabulary window forward whenever the app returns to the
  // foreground (the vocab scheduling effect keys off this tick).
  const [foregroundTick, setForegroundTick] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') setForegroundTick((t) => t + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!session || !coupleId) return;

    welcomeAnim.setValue(0);
    Animated.timing(welcomeAnim, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [session, coupleId, welcomeAnim]);

  const getCreatorName = (creatorId?: string | null) => {
    if (!creatorId) return 'User';
    if (creatorId === profile?.id) return profile.display_name || 'You';
    if (creatorId === partnerProfile?.id) return partnerProfile.display_name || partnerName || 'Partner';
    return 'Partner';
  };

  const fetchSharedFinances = async () => {
    if (!coupleId) return;

    const { data, error } = await supabase
      .from('finances')
      .select('*')
      .eq('couple_id', coupleId)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('[Finances] Fetch failed:', error);
      return;
    }

    setFinanceItems(data || []);
  };

  const fetchSharedBucketList = async () => {
    if (!coupleId) return;

    const { data, error } = await supabase
      .from('bucket_list')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Bucket] Fetch failed:', error);
      return;
    }

    setBucketList(data || []);
  };

  const fetchHospitalVisits = async () => {
    if (!profile) return;

    const profileIds = [profile.id, partnerProfile?.id].filter(Boolean);
    const { data, error } = await supabase
      .from('medical_vault')
      .select('*')
      .eq('metric_type', 'hospital_visit')
      .in('user_id', profileIds)
      .order('record_date', { ascending: false });

    if (error) {
      console.error('[Medical Vault] Fetch failed:', error);
      return;
    }

    setMedLogs(data || []);
  };

  useEffect(() => {
    if (!coupleId) return;

    fetchSharedFinances();
    fetchSharedBucketList();

    const financeChannel = supabase
      .channel(`finance-sync:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finances', filter: `couple_id=eq.${coupleId}` }, fetchSharedFinances)
      .subscribe();

    const bucketChannel = supabase
      .channel(`bucket-sync:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bucket_list', filter: `couple_id=eq.${coupleId}` }, fetchSharedBucketList)
      .subscribe();

    return () => {
      supabase.removeChannel(financeChannel);
      supabase.removeChannel(bucketChannel);
    };
  }, [coupleId]);

  useEffect(() => {
    fetchHospitalVisits();
  }, [coupleId, profile?.id, partnerProfile?.id]);

  useEffect(() => {
    const scheduleFinanceReminders = async () => {
      if (!coupleId) return;

      await cancelScheduledNotificationsByPrefix(`finance:${coupleId}:`);
      await Promise.all(
        financeItems
          .filter((item) => item.status !== 'paid')
          .map((item) => {
            const reminderDate = new Date(item.due_date);
            reminderDate.setDate(reminderDate.getDate() - 1);
            reminderDate.setHours(9, 0, 0, 0);

            return scheduleSharedReminder({
              reminderKey: `finance:${coupleId}:${item.id}`,
              title: 'NOVIA Finance Reminder',
              body: `${item.item_name} is due tomorrow. Amount: ₹${Number(item.amount).toFixed(2)}.`,
              date: reminderDate,
            });
          })
      );
    };

    scheduleFinanceReminders();
  }, [financeItems, coupleId]);

  useEffect(() => {
    const scheduleCycleReminder = async () => {
      if (!coupleId || !predictions) return;

      await cancelScheduledNotificationsByPrefix(`period:${coupleId}:`);
      const reminderDate = new Date(predictions.nextPeriodStart);
      reminderDate.setDate(reminderDate.getDate() - 1);
      reminderDate.setHours(9, 0, 0, 0);

      await scheduleSharedReminder({
        reminderKey: `period:${coupleId}:next`,
        title: 'NOVIA Cycle Reminder',
        body: 'Predicted period starts tomorrow. Both partners have this gentle reminder.',
        date: reminderDate,
      });
    };

    scheduleCycleReminder();
  }, [predictions, coupleId]);

  // Schedule a local reminder for every open todo. Because todos are shared and
  // each device schedules from the same list, both partners get reminded.
  useEffect(() => {
    const syncTodoReminders = async () => {
      if (!coupleId) return;

      await cancelScheduledNotificationsByPrefix(`todo:${coupleId}:`);

      await Promise.all(
        todos
          .filter((t) => !t.is_completed)
          .map((t) => {
            const due = new Date(t.due_at);
            if (isNaN(due.getTime())) return null;
            const hour = due.getHours();
            const minute = due.getMinutes();

            let trigger: any;
            if (t.recurrence === 'weekly') {
              trigger = { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: due.getDay() + 1, hour, minute };
            } else if (t.recurrence === 'monthly') {
              trigger = { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: due.getDate(), hour, minute };
            } else if (t.recurrence === 'yearly') {
              trigger = { type: Notifications.SchedulableTriggerInputTypes.YEARLY, month: due.getMonth() + 1, day: due.getDate(), hour, minute };
            } else {
              if (due.getTime() <= Date.now()) return null; // one-off already passed
              trigger = due;
            }

            const recurrenceLabel = t.recurrence === 'once' ? '' : ` (${t.recurrence})`;
            return scheduleLocalNotification({
              title: `TODO: ${t.title.toUpperCase()}`,
              body: `Reminder${recurrenceLabel} — ${t.title}. Tap to open your shared list.`,
              trigger,
              channelId: PRIORITY_CHANNEL,
              data: { kind: 'todo', reminderKey: `todo:${coupleId}:${t.id}` },
            });
          })
      );
    };

    syncTodoReminders();
  }, [todos, coupleId]);

  // Daily vocabulary: schedule the next 14 days of one-shot notifications, each
  // carrying that day's specific word. Rolls forward on foreground (foregroundTick).
  useEffect(() => {
    if (!session) return;
    const scheduleVocab = async () => {
      await cancelScheduledNotificationsByPrefix('vocab:');
      const AT_HOUR = 9;
      const now = new Date();
      const tasks: Promise<any>[] = [];
      for (let i = 0; i < 14; i++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, AT_HOUR, 0, 0, 0);
        if (day.getTime() <= Date.now()) continue;
        const w = getWordOfDay(day);
        tasks.push(
          scheduleLocalNotification({
            title: `Word of the Day: ${w.word}`,
            body: `${w.meaning}${w.example ? `  e.g. ${w.example}` : ''}`,
            trigger: day as any,
            channelId: PRIORITY_CHANNEL,
            data: { kind: 'vocab', reminderKey: `vocab:${day.toDateString()}` },
          })
        );
      }
      await Promise.all(tasks);
    };
    scheduleVocab();
  }, [session, foregroundTick]);

  // Fetch the changelog; if there are entries newer than the user has seen, drop
  // an "update available" notification. First run silently baselines.
  useEffect(() => {
    if (!session) return;
    const run = async () => {
      const [list, lastSeen] = await Promise.all([fetchAppUpdates(), getLastSeenUpdateAt()]);
      setAppUpdates(list);
      if (list.length === 0) return;
      if (!lastSeen) {
        await markUpdatesSeen(list[0].created_at); // baseline, no notification
        return;
      }
      const unseen = unseenUpdates(list, lastSeen);
      if (unseen.length > 0) {
        setHasUnseenUpdate(true);
        const latest = unseen[0];
        await scheduleLocalNotification({
          title: 'NOVIA update available',
          body: `${latest.version} — ${latest.title}`,
          trigger: { seconds: 1 } as any,
          channelId: PRIORITY_CHANNEL,
          data: { kind: 'update' },
        });
      }
    };
    run();
  }, [session, foregroundTick]);

  // Live-refresh the changelog when a new update row is inserted.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('app-updates-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_updates' }, () =>
        setForegroundTick((t) => t + 1)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const markUpdatesViewed = async () => {
    if (appUpdates.length > 0) await markUpdatesSeen(appUpdates[0].created_at);
    setHasUnseenUpdate(false);
  };

  // Offline first aid query parser
  const handleFirstAidSearch = (text: string) => {
    setFirstAidSearch(text);
    if (!text.trim()) {
      setMatchingFirstAid(null);
      return;
    }
    const query = text.toLowerCase();
    
    // Check blood pressure queries
    if (query.includes('blood pressure') || query.includes('bp') || query.includes('low pressure') || query.includes('dizzy')) {
      setMatchingFirstAid(FIRST_AID_DATA.low_blood_pressure);
    } 
    // Check blood sugar queries
    else if (query.includes('sugar') || query.includes('glucose') || query.includes('diabetic') || query.includes('thirst')) {
      setMatchingFirstAid(FIRST_AID_DATA.high_blood_sugar);
    } 
    // Check burns
    else if (query.includes('burn') || query.includes('blister') || query.includes('fire')) {
      setMatchingFirstAid(FIRST_AID_DATA.minor_burns);
    }
    // Check heatstroke
    else if (query.includes('heat') || query.includes('stroke') || query.includes('sweat')) {
      setMatchingFirstAid(FIRST_AID_DATA.heat_exhaustion);
    } else {
      setMatchingFirstAid(null);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    const success = await addNote(newNoteContent);
    if (success) {
      setNewNoteContent('');
    }
  };

  const handleAddFinance = async () => {
    if (!coupleId || !userId || !newItemName.trim() || !newAmount.trim() || !financeDueDate.trim()) return;
    const amount = parseFloat(newAmount);
    if (isNaN(amount)) return;

    const lenderId = newType === 'borrowing' ? (financeLenderDirection === 'me' ? userId : (partnerProfile?.id || userId)) : null;
    const borrowerId = newType === 'borrowing' ? (financeLenderDirection === 'me' ? (partnerProfile?.id || userId) : userId) : null;

    const isSelfLiability = newType === 'self_liability';
    const payload = {
      couple_id: coupleId,
      type: isSelfLiability ? 'subscription' : newType,
      item_name: isSelfLiability ? `[SELF_LIABILITY] ${newItemName.trim()}` : newItemName.trim(),
      amount,
      due_date: new Date(financeDueDate).toISOString(),
      renewal_cycle: isSelfLiability ? 'none' : financeRenewalCycle,
      status: 'pending',
      lender_id: lenderId,
      borrower_id: borrowerId,
      created_by: userId,
    };

    let { error } = await supabase.from('finances').insert(payload);
    if (error?.code === 'PGRST204' && error.message.includes('created_by')) {
      const { created_by: _createdBy, ...fallbackPayload } = payload;
      const fallback = await supabase.from('finances').insert(fallbackPayload);
      error = fallback.error;
    }

    if (error) {
      Alert.alert("Finance not saved", error.message);
      return;
    }

    setNewItemName('');
    setNewAmount('');
    setFinanceDueDate('');
    setFinanceRenewalCycle('none');
    await fetchSharedFinances();
  };

  const markFinancePaid = async (id: string) => {
    await supabase.from('finances').update({ status: 'paid' }).eq('id', id);
    await fetchSharedFinances();
  };

  const removeFinance = async (id: string) => {
    await supabase.from('finances').delete().eq('id', id);
    await fetchSharedFinances();
  };

  const handleFastSettleUp = async () => {
    if (!coupleId) return;
    Alert.alert(
      "Fast Settle Up",
      "Are you sure you want to mark all outstanding shared borrowings as paid (settled)?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes, Settle Up", 
          onPress: async () => {
            const { error } = await supabase
              .from('finances')
              .update({ status: 'paid' })
              .eq('couple_id', coupleId)
              .eq('type', 'borrowing')
              .eq('status', 'pending');
            
            if (error) {
              Alert.alert("Settle Up failed", error.message);
            } else {
              Alert.alert("Settled Up", "All outstanding borrowings have been marked as paid.");
              await fetchSharedFinances();
            }
          }
        }
      ]
    );
  };

  const handleAddBucket = async () => {
    if (!coupleId || !userId || !newBucketTitle.trim()) return;

    const payload = {
      couple_id: coupleId,
      category: 'learning',
      title: newBucketTitle.trim(),
      description: newBucketDescription.trim() || null,
      created_by: userId,
    };

    let { error } = await supabase.from('bucket_list').insert(payload);
    if (error?.code === 'PGRST204' && error.message.includes('created_by')) {
      const { created_by: _createdBy, ...fallbackPayload } = payload;
      const fallback = await supabase.from('bucket_list').insert(fallbackPayload);
      error = fallback.error;
    }

    if (error) {
      Alert.alert("Bucket item not saved", error.message);
      return;
    }

    setNewBucketTitle('');
    setNewBucketDescription('');
    await fetchSharedBucketList();
  };

  const toggleBucketItemShared = async (item: any) => {
    const nextState = !item.is_completed;
    
    // Optimistic UI state update
    setBucketList(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: nextState } : i));

    if (nextState) {
      Alert.alert(
        "Experiences Unlocked",
        "Congratulations on crossing off an experience together! Particle celebration active across screens.",
        [{ text: "Awesome!" }]
      );
    }

    const { error } = await supabase
      .from('bucket_list')
      .update({
        is_completed: nextState,
        completed_at: nextState ? new Date().toISOString() : null,
        completed_by: nextState ? userId : null,
      })
      .eq('id', item.id);

    if (error) {
      console.error('[Bucket Sync] Toggle failed:', error);
      fetchSharedBucketList();
    } else {
      await fetchSharedBucketList();
    }
  };

  const deleteBucketItem = async (id: string) => {
    // Optimistic UI state update
    setBucketList(prev => prev.filter(i => i.id !== id));

    const { error } = await supabase
      .from('bucket_list')
      .delete()
      .eq('id', id);

    if (error) {
      Alert.alert("Failed to delete", error.message);
      fetchSharedBucketList();
    } else {
      await fetchSharedBucketList();
    }
  };

  const handleAddPeriodLog = async () => {
    if (!periodStartDate.trim()) {
      Alert.alert("Date needed", "Please choose a period start date.");
      return;
    }

    const symptomsArray: string[] = [];
    if (gfBleeding !== 'none') symptomsArray.push(`bleeding:${gfBleeding}`);
    if (gfPhysical !== 'none') symptomsArray.push(`physical:${gfPhysical}`);
    if (gfFluid !== 'none') symptomsArray.push(`fluid:${gfFluid}`);
    if (gfEmotion !== 'calm') symptomsArray.push(`emotion:${gfEmotion}`);
    if (gfEnergy !== 'normal') symptomsArray.push(`energy:${gfEnergy}`);

    // Call predictions helper with serialized symptoms
    await addPeriodLog(periodStartDate, periodEndDate.trim() || null, symptomsArray, null);
    
    // Proactively refresh periods logs for real-time live prediction updates
    await refreshPeriods();

    setPeriodStartDate('');
    setPeriodEndDate('');
    setGfBleeding('none');
    setGfPhysical('none');
    setGfFluid('none');
    setGfEmotion('calm');
    setGfEnergy('normal');
    setIsEditingCycle(false);
    Alert.alert("Success", "Cycle data logged and predicted instantly!");
  };

  const logHospitalVisit = async () => {
    if (!userId || !hospitalReason.trim()) {
      Alert.alert("Reason needed", "Add the hospital visit reason before saving.");
      return;
    }

    const { error } = await supabase.from('medical_vault').insert({
      user_id: userId,
      metric_type: 'hospital_visit',
      value_json: {
        reason: hospitalReason.trim(),
        test_results: hospitalResults.trim(),
      },
      record_date: hospitalDate ? new Date(hospitalDate).toISOString() : new Date().toISOString(),
      notes: hospitalResults.trim() || null,
    });

    if (error) {
      Alert.alert("Visit not saved", error.message);
      return;
    }

    setHospitalDate('');
    setHospitalReason('');
    setHospitalResults('');
    fetchHospitalVisits();
  };

  // ---- Todo handlers -------------------------------------------------------
  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) {
      Alert.alert('Title needed', 'Give your todo a title first.');
      return;
    }
    // Build the first-fire timestamp from the picked date (default today) + time.
    const base = todoDate ? new Date(`${todoDate}T00:00:00`) : new Date();
    base.setHours(todoHour, todoMinute, 0, 0);

    const created = await addTodo({
      title: newTodoTitle,
      notes: newTodoNotes,
      dueAt: base,
      recurrence: todoRecurrence,
    });

    if (!created) {
      Alert.alert('Todo not saved', 'NOVIA could not save this todo. Please check connectivity.');
      return;
    }

    setNewTodoTitle('');
    setNewTodoNotes('');
    setTodoDate('');
    setTodoHour(9);
    setTodoMinute(0);
    setTodoRecurrence('once');
  };

  // ---- Complaint handlers --------------------------------------------------
  const handleAddComplaint = async () => {
    if (!newComplaintTitle.trim()) {
      Alert.alert('Title needed', 'Give your complaint a short title.');
      return;
    }
    const created = await addComplaint(newComplaintTitle, newComplaintBody);
    if (!created) {
      Alert.alert('Not saved', 'NOVIA could not file this complaint. Please check connectivity.');
      return;
    }
    setNewComplaintTitle('');
    setNewComplaintBody('');
  };

  const handleAddReply = async (complaintId: string) => {
    if (!replyText.trim()) return;
    const created = await addReply(complaintId, replyText);
    if (created) setReplyText('');
  };

  // Notify me when my partner files a complaint or replies to a thread.
  const prevComplaintIdsRef = useRef<Set<string>>(new Set());
  const complaintsBaselinedRef = useRef(false);
  useEffect(() => {
    if (!userId) return;
    const currentIds = new Set(complaints.map((c) => c.id));
    if (!complaintsBaselinedRef.current) {
      prevComplaintIdsRef.current = currentIds;
      complaintsBaselinedRef.current = true;
      return;
    }
    complaints.forEach((c) => {
      if (!prevComplaintIdsRef.current.has(c.id) && c.created_by !== userId) {
        const from = c.created_by === partnerProfile?.id ? (partnerProfile?.display_name || partnerName || 'Your partner') : 'Your partner';
        scheduleLocalNotification({
          title: 'New complaint filed',
          body: `${from}: ${c.title}`,
          trigger: { seconds: 1 } as any,
          channelId: PRIORITY_CHANNEL,
          data: { kind: 'complaint' },
        });
      }
    });
    prevComplaintIdsRef.current = currentIds;
  }, [complaints, userId, partnerProfile, partnerName]);

  const welcomeName = profile?.display_name || session?.user?.email?.split('@')[0] || 'there';
  const relationshipAdvice = (() => {
    const partnerNameVal = partnerProfile?.display_name || partnerName || 'your partner';
    switch (partnerMood) {
      case 'Happy':
        return `${partnerNameVal} is feeling Happy today. Plan a sweet dessert date, share a high-energy activity, or celebrate this vibe together.`;
      case 'Overwhelmed':
        return `${partnerNameVal} is feeling Overwhelmed. Take care of any pending chores, keep your communication extremely soft, and defer deep or stressful debates for later.`;
      case 'Exhausted':
        return `${partnerNameVal} is Exhausted. Create a cozy, quiet sanctuary at home, offer a soothing warm beverage, and keep the environment restful.`;
      case 'Low Energy':
        return `${partnerNameVal} has Low Energy. Gentle cuddles, warm physical presence, and check-in without placing demands will make them feel loved.`;
      default:
        return `${partnerNameVal} is feeling balanced. Send a cute meme, check in with a thoughtful text, or plan a tiny shared moment.`;
    }
  })();

  const getCyclePhaseAndTips = (latestRecord: any, datePredictions: any) => {
    if (!latestRecord) {
      return {
        phase: datePredictions?.currentPhase || 'Unknown',
        color: '#FF6B00',
        badge: 'Neutral Phase',
        forecast: 'No active physical symptoms logged yet. Keeping standard track!',
        tips: 'Plan a cozy checking-in date, ask her how her day is going, and send a cute message!'
      };
    }

    const symptoms = latestRecord.symptoms || [];
    
    // Find specific symptom categories
    const bleeding = symptoms.find((s: string) => s.startsWith('bleeding:'))?.split(':')[1] || 'none';
    const physical = symptoms.find((s: string) => s.startsWith('physical:'))?.split(':')[1] || 'none';
    const fluid = symptoms.find((s: string) => s.startsWith('fluid:'))?.split(':')[1] || 'none';
    const emotion = symptoms.find((s: string) => s.startsWith('emotion:'))?.split(':')[1] || 'calm';
    const energy = symptoms.find((s: string) => s.startsWith('energy:'))?.split(':')[1] || 'normal';

    let phase = datePredictions?.currentPhase || 'Unknown';
    let badge = 'Follicular Phase';
    let color = '#44D7B6'; // tealish green
    let forecast = '';
    let tips = '';

    // Rule engine for phase determination based on questionnaire
    if (bleeding !== 'none') {
      phase = 'Menstruation';
      badge = 'Menstruation (Bleeding)';
      color = '#FF4D4D'; // soft red
    } else if (fluid === 'eggwhite') {
      phase = 'Ovulation';
      badge = 'Ovulation (High Fertility)';
      color = '#FF9F43'; // peach orange
    } else if (
      physical === 'cramps' || 
      physical === 'bloating' || 
      physical === 'tender' || 
      emotion === 'irritable' || 
      emotion === 'sad' || 
      emotion === 'anxious' || 
      energy === 'low'
    ) {
      phase = 'Luteal';
      badge = 'Luteal Phase (PMS)';
      color = '#9B5DE5'; // purple
    } else {
      phase = 'Follicular';
      badge = 'Follicular (Rising Energy)';
      color = '#44D7B6';
    }

    // Create highly tailored forecast and tips
    if (phase === 'Menstruation') {
      forecast = `Bleeding is active (${bleeding} flow). `;
      if (physical === 'cramps') {
        forecast += `She is feeling physical cramps. Undergoing uterine contractions and shedding the uterine lining. `;
      } else {
        forecast += `Her body is active in shedding the lining, feeling general pelvic weight. `;
      }
      if (energy === 'low') {
        forecast += `Energy is low, body is working hard.`;
      } else {
        forecast += `Energy is feeling relatively ${energy}.`;
      }

      tips = `1. Prepare a warm hot-water bottle or heating pad for her lower abdomen.
2. Brew her favorite hot tea (chamomile or peppermint is wonderful for cramps).
3. Bring her favorite chocolates, comfort snacks, or prepare a cozy movie night.
4. Offer a gentle back rub or lower leg massage to ease discomfort.
5. Handle house chores proactively. Let her rest without any guilt.`;
    } else if (phase === 'Ovulation') {
      forecast = `Cervical fluid is egg-white/fertile, showing peak estrogen and LH surge. Biological fertility is at its highest. `;
      if (physical === 'energized') {
        forecast += `Estrogen is boosting physical stamina and skin radiance. `;
      }
      if (emotion === 'happy') {
        forecast += `Feeling emotionally upbeat and highly connected.`;
      }

      tips = `1. Plan a cute romantic date night. Excellent time for going out, dinner, or social events.
2. Compliment her aesthetics and express your love. Confidence is highly resonant right now.
3. Take photos together; capture this vibrant phase.
4. Schedule some quality couple communication time to dream and connect deeply.`;
    } else if (phase === 'Luteal') {
      forecast = `Progesterone is dominant. Estrogen is dropping. `;
      if (physical === 'cramps' || physical === 'bloating') {
        forecast += `Experiencing physical PMS signs: ${physical}. `;
      }
      if (emotion === 'irritable' || emotion === 'sad' || emotion === 'anxious') {
        forecast += `Hormones may trigger emotional waves of feeling ${emotion}. `;
      }
      if (energy === 'low') {
        forecast += `Energy is lower, feeling tired or easily stressed.`;
      }

      tips = `1. Give her extra grace and absolute patience. Avoid debating or logical problem-solving.
2. Create a quiet, cozy sanctuary at home. Soft lighting, calm vibe.
3. Listen intently, hold her hand, and reassure her of your presence. "I am here, you are safe."
4. Fetch her comfort desserts or small sweet gestures without being asked.
5. Proactively keep things tidy to minimize sensory overload.`;
    } else {
      // Follicular
      forecast = `Estrogen is gradually rising, prepping new follicles. Standard recovery phase. `;
      if (energy === 'high') {
        forecast += `Energy is bouncing back strong! Estrogen is active.`;
      } else {
        forecast += `Estrogen levels are supporting a gradual rebound of physical and emotional balance.`;
      }

      tips = `1. Plan a light outdoor activity, walk in the park, or try something fresh.
2. Talk about your weekly goals and support each other.
3. Surprise her with her favorite coffee/tea to start the day.
4. Help her with any creative or active project she's excited to start.`;
    }

    return { phase, badge, color, forecast, tips };
  };

  if (authLoading) {
    return (
      <View style={[styles.center, { backgroundColor: THEME.colors.background }]}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={[styles.mutedText, { marginTop: 10 }]}>Loading NOVIA...</Text>
      </View>
    );
  }

  return (
    <View style={styles.appShell}>
      <SpaceBackdrop />
      <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {!session ? (
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>NOVIA</Text>
            
            <View style={styles.authTabRow}>
              <TouchableOpacity 
                style={[styles.authTab, !isSignUpMode && styles.activeAuthTab]} 
                onPress={() => setIsSignUpMode(false)}
              >
                <Text style={[styles.authTabText, !isSignUpMode && styles.activeAuthTabText]}>SIGN IN</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.authTab, isSignUpMode && styles.activeAuthTab]} 
                onPress={() => setIsSignUpMode(true)}
              >
                <Text style={[styles.authTabText, isSignUpMode && styles.activeAuthTabText]}>REGISTER</Text>
              </TouchableOpacity>
            </View>

            {isSignUpMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>YOUR DISPLAY NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name..."
                  placeholderTextColor="#666"
                  value={authDisplayName}
                  onChangeText={setAuthDisplayName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SECURE EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor="#666"
                value={authEmail}
                onChangeText={setAuthEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSPHRASE</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor="#666"
                secureTextEntry
                value={authPassword}
                onChangeText={setAuthPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleAuthSubmit}>
              <Text style={styles.primaryBtnText}>
                {isSignUpMode ? 'CREATE ACCOUNT' : 'SIGN IN'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.authNote}>
              NOVIA requires valid Supabase DB connectivity to authenticate client sessions.
            </Text>
          </View>
        </ScrollView>
        </SafeAreaView>
      ) : !coupleId ? (
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Partner Sync</Text>
            <Text style={styles.authInfo}>
              Your session is active, but you are not linked to a partner. Sync your client credentials to establish a synchronized bridge.
            </Text>

            <View style={styles.userIdContainer}>
              <Text style={styles.userIdLabel}>YOUR UNIQUE SYNC KEY</Text>
              <TextInput
                style={styles.copyableIdText}
                value={session.user.id}
                editable={false}
                selectTextOnFocus={true}
              />
              <Text style={styles.copyInstructions}>
                Double-tap above to copy and send this key to your partner.
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PARTNER'S SYNC KEY</Text>
              <TextInput
                style={styles.input}
                placeholder="Paste partner's user ID key here..."
                placeholderTextColor="#666"
                value={partnerIdInput}
                onChangeText={setPartnerIdInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handlePairSubmit}>
              <Text style={styles.primaryBtnText}>SYNCHRONIZE MINDS &amp; HEARTS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
              <Text style={styles.signOutBtnText}>SIGN OUT</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        </SafeAreaView>
      ) : (
        <View style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1 }}>
              <TouchableOpacity 
                style={styles.floatingMenuButton} 
                onPress={() => toggleDrawer(true)}
                activeOpacity={0.8}
              >
                <Menu color="#FF6B00" size={22} />
              </TouchableOpacity>
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
              >
                <ScrollView 
                  style={styles.scrollArea}
                  contentContainerStyle={{
                    padding: THEME.spacing.md,
                    paddingTop: 56,
                    paddingBottom: 220
                  }}
                  keyboardShouldPersistTaps="handled"
                >
                <ScreenTransition key={activeTab}>
                {/* Main Hub Tab */}
                {activeTab === 'hub' && (
                  <View style={styles.tabContent}>
                    <Animated.View
                      style={[
                        styles.welcomeCard,
                        {
                          opacity: welcomeAnim,
                          transform: [
                            {
                              translateY: welcomeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [24, 0],
                              }),
                            },
                            {
                              scale: welcomeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.93, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Text style={styles.welcomeTitle}>Hi {welcomeName}</Text>
                      <Text style={styles.welcomeSubtitle}>Welcome back</Text>
                    </Animated.View>

                    {/* Companion Status Row */}
                    <View style={styles.partnerCard}>
                      <Text style={styles.sectionHeading}>COMPANION REAL-TIME TRACKING</Text>
                      <View style={styles.rowBetween}>
                        <Text style={styles.partnerName}>{partnerName}</Text>
                        <View style={[styles.moodBadge, { backgroundColor: (THEME.colors.mood as any)[partnerMood] || THEME.colors.mood.Neutral }]}>
                          <Text style={styles.moodBadgeText}>{partnerMood}</Text>
                        </View>
                      </View>
                      {isPartnerTyping && (
                        <Text style={styles.typingNotice}>Companion is active in shared notes...</Text>
                      )}
                      <View style={styles.suggestionContainer}>
                        <Text style={styles.welcomeCopy}>{relationshipAdvice}</Text>
                      </View>
                    </View>

                    {/* Quick navigation cards */}
                    <View style={styles.navGrid}>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('todos')} activeOpacity={0.85}>
                        <ListChecks size={26} color="#F18F2E" strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Todo List</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('complaints')} activeOpacity={0.85}>
                        <MessageSquareWarning size={26} color="#F18F2E" strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Complaint Box</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('bucket')} activeOpacity={0.85}>
                        <Text style={{ fontSize: 26 }}>🪣</Text>
                        <Text style={styles.navCardLabel}>Bucket List</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('location')} activeOpacity={0.85}>
                        <MapPin size={26} color="#F18F2E" strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Location</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Word of the Day */}
                    {(() => {
                      const w = getWordOfDay();
                      return (
                        <View style={styles.sectionCard}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.sectionHeading}>WORD OF THE DAY</Text>
                            <BookOpen size={16} color="#F18F2E" />
                          </View>
                          <Text style={styles.vocabWord}>{w.word}</Text>
                          <Text style={styles.vocabMeaning}>{w.meaning}</Text>
                          {w.example ? <Text style={styles.vocabExample}>“{w.example}”</Text> : null}
                        </View>
                      );
                    })()}

                    {/* Mood Selector Updates */}
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>UPDATE MY EMOTIONAL CAPACITY</Text>
                      <View style={styles.moodRow}>
                        {['Happy', 'Overwhelmed', 'Exhausted', 'Low Energy'].map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.moodBtn,
                              currentMood === m && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }
                            ]}
                            onPress={() => updateMood(m)}
                          >
                            <Text style={styles.moodBtnText}>{m}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Offline First-Aid Recommendations */}
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>MEDICAL RECOMMENDATIONS &amp; MEDICATION NOTES</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Search symptoms (e.g. low blood pressure, dizzy, burn)..."
                        placeholderTextColor="#666"
                        value={firstAidSearch}
                        onChangeText={handleFirstAidSearch}
                      />
                      {matchingFirstAid ? (
                        <View style={styles.firstAidResponse}>
                          <Text style={styles.firstAidTitle}>{matchingFirstAid.title}</Text>
                          <Text style={styles.firstAidSub}>First-Aid Instructions:</Text>
                          {matchingFirstAid.steps.map((s: string, idx: number) => (
                            <Text key={idx} style={styles.firstAidStep}>{idx + 1}. {s}</Text>
                          ))}
                          <Text style={styles.firstAidSub}>Medication Notes:</Text>
                          {matchingFirstAid.medications.map((m: string, idx: number) => (
                            <Text key={idx} style={styles.firstAidStep}>{idx + 1}. {m}</Text>
                          ))}
                          <Text style={styles.firstAidSub}>Contraindications &amp; Warnings:</Text>
                          {matchingFirstAid.warnings.map((w: string, idx: number) => (
                            <Text key={idx} style={[styles.firstAidStep, { color: THEME.colors.danger }]}>• {w}</Text>
                          ))}
                        </View>
                      ) : firstAidSearch ? (
                        <Text style={styles.noMatchText}>No direct match found. Try typing 'blood pressure' or 'sugar'.</Text>
                      ) : null}
                    </View>
                  </View>
                )}

                {/* Location Sharing Tab */}
                {activeTab === 'location' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity style={styles.backRow} onPress={() => setActiveTab('hub')}>
                      <ChevronLeft size={20} color="#F18F2E" />
                      <Text style={styles.backRowText}>Hub</Text>
                    </TouchableOpacity>
                    {/* Partner's shared location */}
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>
                        {(partnerProfile?.display_name || partnerName || 'PARTNER').toUpperCase()}'S LOCATION
                      </Text>
                      {partnerLocation ? (
                        <>
                          <Text style={styles.locationPlace}>
                            {partnerLocation.place_label || 'Location shared'}
                          </Text>
                          <Text style={styles.locationCoords}>
                            {partnerLocation.latitude.toFixed(5)}, {partnerLocation.longitude.toFixed(5)}
                          </Text>
                          <Text style={styles.locationMeta}>
                            Updated {formatUpdatedAgo(partnerLocation.updated_at)}
                            {partnerLocation.accuracy ? ` · ±${Math.round(partnerLocation.accuracy)} m` : ''}
                          </Text>
                          {myLocation ? (
                            <Text style={styles.locationDistance}>
                              {formatDistance(haversineMeters(myLocation, partnerLocation))} away
                            </Text>
                          ) : null}
                          <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() =>
                              Linking.openURL(
                                mapsUrl(
                                  partnerLocation.latitude,
                                  partnerLocation.longitude,
                                  partnerLocation.place_label
                                )
                              )
                            }
                          >
                            <Text style={styles.primaryBtnText}>Open in Maps</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <Text style={styles.welcomeCopy}>
                          {(partnerProfile?.display_name || partnerName || 'Your partner')} isn't sharing their
                          location right now. Ask them to open the Location tab and tap “Share my location”.
                        </Text>
                      )}
                    </View>

                    {/* My sharing controls */}
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>MY LOCATION</Text>
                      {myLocation ? (
                        <Text style={styles.locationMeta}>
                          Shared {formatUpdatedAgo(myLocation.updated_at)}
                          {isLiveSharing ? ' · live' : ''}
                        </Text>
                      ) : (
                        <Text style={styles.welcomeCopy}>
                          You're not sharing your location. Your partner can only see it after you choose to share.
                        </Text>
                      )}

                      {locationError ? (
                        <Text style={styles.locationErrorText}>{locationError}</Text>
                      ) : null}

                      <TouchableOpacity
                        style={[styles.primaryButton, locationBusy && { opacity: 0.6 }]}
                        onPress={shareMyLocation}
                        disabled={locationBusy}
                      >
                        {locationBusy ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryBtnText}>
                            {myLocation ? 'Update my location' : 'Share my location'}
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.locationSecondaryBtn}
                        onPress={() => setLiveSharing(!isLiveSharing)}
                      >
                        <Text style={styles.locationSecondaryBtnText}>
                          {isLiveSharing ? 'Stop live sharing' : 'Share live while app is open'}
                        </Text>
                      </TouchableOpacity>

                      {myLocation ? (
                        <TouchableOpacity style={styles.locationStopBtn} onPress={stopLocationSharing}>
                          <Text style={styles.locationStopBtnText}>Stop sharing &amp; remove my location</Text>
                        </TouchableOpacity>
                      ) : null}

                      <Text style={styles.locationHint}>
                        NOVIA never tracks you in the background — your location updates only while this screen is open.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Collaborative Canvas Tab */}
                {activeTab === 'notes' && (
                  <View style={styles.tabContent}>
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>SHARED NOTES</Text>
                      <TextInput
                        multiline
                        textAlignVertical="top"
                        style={[styles.input, styles.noteInput]}
                        value={newNoteContent}
                        onChangeText={setNewNoteContent}
                        placeholder="Write a note for both partners..."
                        placeholderTextColor="#444"
                      />
                      <TouchableOpacity style={styles.primaryButton} onPress={handleAddNote}>
                        <Text style={styles.primaryBtnText}>Add Shared Note</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.noteGrid}>
                      {notes.length === 0 ? (
                        <View style={styles.emptyCard}>
                          <Text style={styles.emptyText}>No shared notes yet.</Text>
                        </View>
                      ) : (
                        notes.map((note) => (
                          <View key={note.id} style={styles.noteCard}>
                            <View style={styles.rowBetween}>
                              <Text style={styles.noteAuthor}>{getCreatorName(note.created_by || note.updated_by)}</Text>
                              <TouchableOpacity onPress={() => removeNote(note.id)}>
                                <Text style={styles.removeText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                            <Text style={styles.noteBody}>{note.content}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                )}

                {/* Shared Todo List (Hub sub-screen) */}
                {activeTab === 'todos' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity style={styles.backRow} onPress={() => setActiveTab('hub')}>
                      <ChevronLeft size={20} color="#F18F2E" />
                      <Text style={styles.backRowText}>Hub</Text>
                    </TouchableOpacity>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>NEW SHARED TODO</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="What needs doing?"
                        placeholderTextColor="#666"
                        value={newTodoTitle}
                        onChangeText={setNewTodoTitle}
                      />
                      <TextInput
                        style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                        placeholder="Notes (optional)"
                        placeholderTextColor="#666"
                        value={newTodoNotes}
                        onChangeText={setNewTodoNotes}
                        multiline
                      />

                      <View style={[styles.rowBetween, { marginBottom: 10 }]}>
                        <Text style={styles.inputLabel}>FIRST REMINDER DATE</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {todoDate ? (
                            <TouchableOpacity onPress={() => setTodoDate('')} style={{ marginRight: 10 }}>
                              <Text style={{ color: '#E74627', fontSize: 12, fontWeight: '700' }}>Clear</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity style={styles.reminderDateButton} onPress={() => openCalendarFor('todoDate')}>
                            <Text style={styles.reminderDateButtonText}>{todoDate || 'Today'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={[styles.inputLabel, { marginBottom: 8 }]}>REMINDER TIME</Text>
                      <View style={styles.spinnerRow}>
                        <View style={styles.spinnerPanel}>
                          <TouchableOpacity style={styles.spinnerButton} onPress={() => adjustTodoTime('hour', 1)}>
                            <Text style={styles.spinnerButtonText}>+</Text>
                          </TouchableOpacity>
                          <Text style={styles.spinnerValue}>{String(todoHour).padStart(2, '0')}</Text>
                          <Text style={styles.spinnerLabel}>HOUR</Text>
                          <TouchableOpacity style={styles.spinnerButton} onPress={() => adjustTodoTime('hour', -1)}>
                            <Text style={styles.spinnerButtonText}>-</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.spinnerDivider}>
                          <Text style={styles.spinnerColon}>:</Text>
                        </View>
                        <View style={styles.spinnerPanel}>
                          <TouchableOpacity style={styles.spinnerButton} onPress={() => adjustTodoTime('minute', 5)}>
                            <Text style={styles.spinnerButtonText}>+</Text>
                          </TouchableOpacity>
                          <Text style={styles.spinnerValue}>{String(todoMinute).padStart(2, '0')}</Text>
                          <Text style={styles.spinnerLabel}>MIN</Text>
                          <TouchableOpacity style={styles.spinnerButton} onPress={() => adjustTodoTime('minute', -5)}>
                            <Text style={styles.spinnerButtonText}>-</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={[styles.inputLabel, { marginTop: 14, marginBottom: 8 }]}>REPEAT</Text>
                      <View style={styles.chipsRow}>
                        {(['once', 'weekly', 'monthly', 'yearly'] as TodoRecurrence[]).map((r) => (
                          <TouchableOpacity
                            key={r}
                            style={[styles.quickAddChip, todoRecurrence === r && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }]}
                            onPress={() => setTodoRecurrence(r)}
                          >
                            <Text style={styles.quickAddChipText}>
                              {r === 'once' ? 'Once' : r === 'weekly' ? 'Weekly' : r === 'monthly' ? 'Monthly' : 'Yearly'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }]} onPress={handleAddTodo}>
                        <Text style={styles.primaryBtnText}>ADD TODO</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>SHARED TODOS</Text>
                      {todos.length === 0 ? (
                        <Text style={styles.noRemindersText}>No todos yet. Add one above — you'll both be reminded.</Text>
                      ) : (
                        todos.map((t) => {
                          const due = new Date(t.due_at);
                          const timeLabel = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
                          const recLabel = t.recurrence === 'once' ? due.toLocaleDateString() : t.recurrence;
                          return (
                            <View key={t.id} style={styles.reminderItemRow}>
                              <TouchableOpacity
                                style={[styles.reminderCheckbox, t.is_completed && styles.reminderCheckboxCompleted]}
                                onPress={() => toggleTodo(t.id, !t.is_completed)}
                              >
                                {t.is_completed && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                              </TouchableOpacity>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.reminderTitle, t.is_completed && styles.strikethroughText]}>{t.title}</Text>
                                <Text style={{ color: '#F18F2E', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                                  {timeLabel} · {recLabel} · by {getCreatorName(t.created_by)}
                                </Text>
                                {t.notes ? <Text style={{ color: '#A9A09A', fontSize: 12, marginTop: 2 }}>{t.notes}</Text> : null}
                              </View>
                              <TouchableOpacity style={styles.reminderDeleteButton} onPress={() => deleteTodo(t.id)}>
                                <X size={13} color="#E74627" strokeWidth={2.5} />
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      )}
                    </View>
                    <View style={{ height: 100 }} />
                  </View>
                )}

                {/* Complaint Box (Hub sub-screen) */}
                {activeTab === 'complaints' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity
                      style={styles.backRow}
                      onPress={() => { if (openComplaintId) setOpenComplaintId(null); else setActiveTab('hub'); }}
                    >
                      <ChevronLeft size={20} color="#F18F2E" />
                      <Text style={styles.backRowText}>{openComplaintId ? 'All complaints' : 'Hub'}</Text>
                    </TouchableOpacity>

                    {openComplaintId ? (() => {
                      const c = complaints.find((x) => x.id === openComplaintId);
                      if (!c) return <Text style={styles.noRemindersText}>This complaint was removed.</Text>;
                      const thread = repliesFor(c.id);
                      return (
                        <View style={styles.sectionCard}>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.sectionHeading, { flex: 1 }]}>{c.title}</Text>
                            <View style={[styles.statusChip, { backgroundColor: c.status === 'resolved' ? 'rgba(46,204,113,0.18)' : 'rgba(231,70,39,0.18)' }]}>
                              <Text style={{ color: c.status === 'resolved' ? '#2ECC71' : '#E74627', fontSize: 10, fontWeight: '800' }}>{c.status.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={{ color: '#A9A09A', fontSize: 11, marginBottom: 6 }}>Filed by {getCreatorName(c.created_by)}</Text>
                          {c.body ? <Text style={{ color: '#E5E0DC', fontSize: 14, marginBottom: 12 }}>{c.body}</Text> : null}

                          <View style={{ gap: 8, marginBottom: 12 }}>
                            {thread.length === 0 ? (
                              <Text style={styles.noRemindersText}>No replies yet.</Text>
                            ) : thread.map((r) => {
                              const mine = r.author_id === userId;
                              return (
                                <View key={r.id} style={[styles.replyBubble, mine ? styles.replyMine : styles.replyTheirs]}>
                                  <Text style={{ color: '#F18F2E', fontSize: 10, fontWeight: '800', marginBottom: 2 }}>{getCreatorName(r.author_id)}</Text>
                                  <Text style={{ color: '#E5E0DC', fontSize: 13 }}>{r.body}</Text>
                                </View>
                              );
                            })}
                          </View>

                          <View style={styles.addReminderRow}>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder="Write a reply..."
                              placeholderTextColor="#666"
                              value={replyText}
                              onChangeText={setReplyText}
                            />
                            <TouchableOpacity style={styles.plusAddButton} onPress={() => handleAddReply(c.id)}>
                              <Send size={18} color="#030202" />
                            </TouchableOpacity>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                              style={[styles.secondaryButton, { flex: 1 }]}
                              onPress={() => setComplaintStatus(c.id, c.status === 'resolved' ? 'open' : 'resolved')}
                            >
                              <Text style={styles.secondaryBtnText}>{c.status === 'resolved' ? 'Reopen' : 'Mark resolved'}</Text>
                            </TouchableOpacity>
                            {c.created_by === userId ? (
                              <TouchableOpacity
                                style={[styles.secondaryButton, { flex: 1, backgroundColor: 'rgba(231,70,39,0.16)' }]}
                                onPress={() => { deleteComplaint(c.id); setOpenComplaintId(null); }}
                              >
                                <Text style={[styles.secondaryBtnText, { color: '#E74627' }]}>Delete</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      );
                    })() : (
                      <>
                        <View style={styles.sectionCard}>
                          <Text style={styles.sectionHeading}>FILE A COMPLAINT</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Title (e.g. You left the lights on)"
                            placeholderTextColor="#666"
                            value={newComplaintTitle}
                            onChangeText={setNewComplaintTitle}
                          />
                          <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                            placeholder="Describe it (optional)"
                            placeholderTextColor="#666"
                            value={newComplaintBody}
                            onChangeText={setNewComplaintBody}
                            multiline
                          />
                          <TouchableOpacity style={styles.primaryButton} onPress={handleAddComplaint}>
                            <Text style={styles.primaryBtnText}>SUBMIT COMPLAINT</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.sectionCard}>
                          <Text style={styles.sectionHeading}>COMPLAINT TICKETS</Text>
                          {complaints.length === 0 ? (
                            <Text style={styles.noRemindersText}>No complaints. All is well.</Text>
                          ) : complaints.map((c) => {
                            const count = repliesFor(c.id).length;
                            return (
                              <TouchableOpacity key={c.id} style={styles.ticketRow} onPress={() => setOpenComplaintId(c.id)}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.ticketTitle}>{c.title}</Text>
                                  <Text style={{ color: '#A9A09A', fontSize: 11, marginTop: 2 }}>
                                    by {getCreatorName(c.created_by)} · {count} {count === 1 ? 'reply' : 'replies'}
                                  </Text>
                                </View>
                                <View style={[styles.statusChip, { backgroundColor: c.status === 'resolved' ? 'rgba(46,204,113,0.18)' : 'rgba(231,70,39,0.18)' }]}>
                                  <Text style={{ color: c.status === 'resolved' ? '#2ECC71' : '#E74627', fontSize: 10, fontWeight: '800' }}>{c.status.toUpperCase()}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    )}
                    <View style={{ height: 100 }} />
                  </View>
                )}

                {/* Subscriptions & Borrowings Tab */}
                {activeTab === 'finances' && (() => {
                  // Calculate liabilities. `yourOwed` / `partnerOwed` power the
                  // per-person liability bars (total each is on the hook for).
                  // The inter-partner net settlement is tracked separately from
                  // borrowings only — self-liabilities are personal and must not
                  // leak into who-owes-whom.
                  let yourOwed = 0;
                  let partnerOwed = 0;
                  let combinedTotal = 0;
                  let totalMonthlySubscriptions = 0;
                  let yourBorrowings = 0;    // what you owe partner (borrowings)
                  let partnerBorrowings = 0; // what partner owes you (borrowings)

                  const partnerDisplayName = partnerProfile?.display_name || partnerName || 'Partner';
                  // Only recurring (monthly/yearly) subscriptions belong in the
                  // MONTHLY SUBSCRIPTION FORECAST — one-time ('none') items are not
                  // a recurring burden, so the count stays consistent with the cost.
                  const activeSubscriptions = financeItems.filter(item =>
                    item.type === 'subscription' &&
                    !item.item_name.startsWith('[SELF_LIABILITY] ') &&
                    (item.renewal_cycle === 'monthly' || item.renewal_cycle === 'yearly')
                  );

                  financeItems.forEach((item) => {
                    if (item.status === 'paid') return;
                    const amt = Number(item.amount) || 0;
                    combinedTotal += amt;

                    if (item.item_name.startsWith('[SELF_LIABILITY] ')) {
                      if (item.created_by === userId) {
                        yourOwed += amt;
                      } else {
                        partnerOwed += amt;
                      }
                    } else if (item.type === 'subscription') {
                      yourOwed += amt / 2;
                      partnerOwed += amt / 2;
                      if (item.renewal_cycle === 'monthly') {
                        totalMonthlySubscriptions += amt;
                      } else if (item.renewal_cycle === 'yearly') {
                        totalMonthlySubscriptions += amt / 12;
                      }
                      // 'none' (one-time) subscriptions are not a recurring
                      // monthly burden, so they are excluded from the forecast.
                    } else if (item.type === 'borrowing') {
                      if (item.borrower_id === userId) {
                        yourOwed += amt;
                        yourBorrowings += amt;
                      } else if (item.borrower_id === partnerProfile?.id) {
                        partnerOwed += amt;
                        partnerBorrowings += amt;
                      }
                    }
                  });

                  // Helper for generating next 30 days
                  const getNext30Days = () => {
                    const days = [];
                    const today = new Date();
                    for (let i = 0; i < 30; i++) {
                      const current = new Date(today);
                      current.setDate(today.getDate() + i);
                      days.push(current);
                    }
                    return days;
                  };

                  return (
                    <View style={styles.tabContent}>
                      {/* Proportional Spend Analytics Dashboard */}
                      <View style={styles.sectionCard}>
                        <Text style={styles.sectionHeading}>SPEND ANALYSIS &amp; LEDGER COMPARISON</Text>
                        
                        <View style={styles.analyticsCombinedRow}>
                          <View>
                            <Text style={styles.analyticsLabel}>COMBINED RUNNING TOTAL</Text>
                            <Text style={styles.analyticsCombinedValue}>₹{combinedTotal.toFixed(2)}</Text>
                          </View>
                        </View>

                        {/* Progress Bar 1 - You Owe */}
                        <View style={styles.progressGroup}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.progressLabel}>YOUR LIABILITY (YOU OWE)</Text>
                            <Text style={styles.progressValue}>₹{yourOwed.toFixed(2)}</Text>
                          </View>
                          <View style={styles.progressBarBg}>
                            <View 
                              style={[
                                styles.progressBarFill, 
                                { 
                                  width: combinedTotal > 0 ? `${Math.min((yourOwed / combinedTotal) * 100, 100)}%` : '0%',
                                  backgroundColor: '#FF6B00' 
                                }
                              ]} 
                            />
                          </View>
                        </View>

                        {/* Progress Bar 2 - Partner Owes */}
                        <View style={styles.progressGroup}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.progressLabel}>{partnerDisplayName.toUpperCase()}'S LIABILITY (OWES YOU)</Text>
                            <Text style={styles.progressValue}>₹{partnerOwed.toFixed(2)}</Text>
                          </View>
                          <View style={styles.progressBarBg}>
                            <View 
                              style={[
                                styles.progressBarFill, 
                                { 
                                  width: combinedTotal > 0 ? `${Math.min((partnerOwed / combinedTotal) * 100, 100)}%` : '0%',
                                  backgroundColor: '#FF8A00' 
                                }
                              ]} 
                            />
                          </View>
                        </View>
                      </View>

                      {/* Net Settlement Ledger Card */}
                      {(() => {
                        // Net settlement is strictly between partners — only
                        // borrowings count (subscriptions cancel 50/50, self-
                        // liabilities are personal and excluded entirely).
                        const netOwed = partnerBorrowings - yourBorrowings;
                        return (
                          <View style={[styles.settlementCard, netOwed > 0 ? { backgroundColor: 'rgba(68, 215, 182, 0.10)' } : netOwed < 0 ? { backgroundColor: THEME.glass.accent } : {}]}>
                            <Text style={[styles.sectionHeading, { color: netOwed > 0 ? '#44D7B6' : netOwed < 0 ? '#FF6B00' : '#E5E5EA' }]}>NET SETTLEMENT LEDGER</Text>
                            {netOwed > 0 ? (
                              <View>
                                <Text style={[styles.predText, { fontSize: 13, color: '#E5E5EA', marginBottom: 12 }]}>
                                  Overall, <Text style={{ color: '#44D7B6', fontWeight: 'bold' }}>{partnerDisplayName}</Text> owes you <Text style={{ color: '#44D7B6', fontWeight: 'bold', fontSize: 15 }}>₹{netOwed.toFixed(2)}</Text> net.
                                </Text>
                                <TouchableOpacity 
                                  style={[styles.primaryButton, { backgroundColor: 'rgba(68, 215, 182, 0.22)', shadowColor: '#44D7B6' }]}
                                  onPress={() => Alert.alert("Reminder Sent", `Pinged ${partnerDisplayName} to settle the ₹${netOwed.toFixed(2)} debt.`)}
                                >
                                  <Text style={[styles.primaryBtnText, { color: '#44D7B6' }]}>Ping Partner</Text>
                                </TouchableOpacity>
                              </View>
                            ) : netOwed < 0 ? (
                              <View>
                                <Text style={[styles.predText, { fontSize: 13, color: '#E5E5EA', marginBottom: 12 }]}>
                                  Overall, you owe <Text style={{ color: '#FF6B00', fontWeight: 'bold' }}>{partnerDisplayName}</Text> <Text style={{ color: '#FF6B00', fontWeight: 'bold', fontSize: 15 }}>₹{Math.abs(netOwed).toFixed(2)}</Text> net.
                                </Text>
                                <TouchableOpacity 
                                  style={styles.primaryButton} 
                                  onPress={handleFastSettleUp}
                                >
                                  <Text style={styles.primaryBtnText}>Fast Settle Up</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <Text style={[styles.predText, { fontSize: 13, color: '#A0A0A0', textAlign: 'center', marginVertical: 6 }]}>
                                Balances are perfectly settled. No outstanding debts.
                              </Text>
                            )}
                          </View>
                        );
                      })()}

                      {/* Subscription Forecast Card */}
                      {activeSubscriptions.length > 0 && (
                        <View style={styles.subscriptionForecastCard}>
                          <Text style={styles.sectionHeading}>MONTHLY SUBSCRIPTION FORECAST</Text>
                          <Text style={[styles.predText, { fontSize: 13, color: '#E5E5EA', marginBottom: 8 }]}>
                            Tracked Subscriptions: <Text style={{ color: '#FF6B00', fontWeight: 'bold' }}>{activeSubscriptions.length}</Text>
                          </Text>
                          <View style={[styles.rowBetween, { marginTop: 12, paddingTop: 12 }]}>
                            <Text style={styles.progressLabel}>TOTAL MONTHLY BURDEN</Text>
                            <Text style={[styles.financeAmount, { color: '#FFD66B' }]}>₹{totalMonthlySubscriptions.toFixed(2)}/mo</Text>
                          </View>
                          <View style={[styles.rowBetween, { marginTop: 4 }]}>
                            <Text style={styles.progressLabel}>INDIVIDUAL BURDEN (50% SPLIT)</Text>
                            <Text style={[styles.financeMeta, { fontSize: 11, color: '#A0A0A0' }]}>₹{(totalMonthlySubscriptions / 2).toFixed(2)}/mo each</Text>
                          </View>
                        </View>
                      )}

                      <View style={styles.sectionCard}>
                        <Text style={styles.sectionHeading}>LOG BORROWINGS &amp; SUBSCRIPTIONS</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Item or Subscription Name..."
                          placeholderTextColor="#666"
                          value={newItemName}
                          onChangeText={setNewItemName}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Amount (₹)..."
                          placeholderTextColor="#666"
                          keyboardType="numeric"
                          value={newAmount}
                          onChangeText={setNewAmount}
                        />
                        
                        {/* Horizontal Date Selector Strip instead of text input */}
                        <Text style={styles.inputLabel}>SELECT DUE OR RENEWAL DATE</Text>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false} 
                          style={styles.dateStrip}
                          contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
                        >
                          {getNext30Days().map((dateObj) => {
                            const dateStr = dateObj.toISOString().split('T')[0];
                            const isSelected = financeDueDate === dateStr;
                            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = dateObj.getDate();
                            const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
                            
                            return (
                              <TouchableOpacity
                                key={dateStr}
                                style={[styles.dateCard, isSelected && styles.activeDateCard]}
                                onPress={() => setFinanceDueDate(dateStr)}
                              >
                                <Text style={[styles.dateCardDay, isSelected && styles.activeDateCardText]}>{dayName.toUpperCase()}</Text>
                                <Text style={[styles.dateCardNum, isSelected && styles.activeDateCardText]}>{dayNum}</Text>
                                <Text style={[styles.dateCardMonth, isSelected && styles.activeDateCardText]}>{monthName}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        <TouchableOpacity 
                          style={[styles.calendarPickerBtn, { marginTop: 4 }]} 
                          onPress={() => openCalendarFor('financeDueDate')}
                        >
                          <Text style={styles.calendarPickerBtnText}>
                            {financeDueDate ? `DUE DATE: ${financeDueDate}` : 'OR CHOOSE CUSTOM DUE DATE FROM CALENDAR'}
                          </Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
                          <TouchableOpacity 
                            style={[styles.smallBtn, { flex: 1 }, newType === 'borrowing' && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }]}
                            onPress={() => setNewType('borrowing')}
                          >
                            <Text style={styles.btnText}>Borrowing</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.smallBtn, { flex: 1 }, newType === 'subscription' && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }]}
                            onPress={() => setNewType('subscription')}
                          >
                            <Text style={styles.btnText}>Subscription</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.smallBtn, { flex: 1 }, newType === 'self_liability' && { backgroundColor: 'rgba(168, 85, 247, 0.20)', shadowColor: '#A855F7', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }]}
                            onPress={() => setNewType('self_liability')}
                          >
                            <Text style={[styles.btnText, newType === 'self_liability' && { color: '#A855F7', fontWeight: 'bold' }]}>Self Liability</Text>
                          </TouchableOpacity>
                        </View>

                        {newType === 'borrowing' && (
                          <View style={{ marginBottom: 12 }}>
                            <Text style={styles.inputLabel}>LENDER DIRECTION (WHO OWE WHO?)</Text>
                            <View style={styles.rowBetween}>
                              <TouchableOpacity 
                                style={[styles.smallBtn, financeLenderDirection === 'me' && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }, { flex: 1, marginRight: 6 }]}
                                onPress={() => setFinanceLenderDirection('me')}
                              >
                                <Text style={styles.btnText}>You lent to {partnerDisplayName}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.smallBtn, financeLenderDirection === 'partner' && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }, { flex: 1, marginLeft: 6 }]}
                                onPress={() => setFinanceLenderDirection('partner')}
                              >
                                <Text style={styles.btnText}>{partnerDisplayName} lent to You</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {newType === 'subscription' && (
                          <View style={styles.segmentControl}>
                            {(['none', 'monthly', 'yearly'] as const).map((cycle) => (
                              <TouchableOpacity
                                key={cycle}
                                style={[styles.segmentOption, financeRenewalCycle === cycle && styles.activeSegmentOption]}
                                onPress={() => setFinanceRenewalCycle(cycle)}
                              >
                                <Text style={[styles.segmentText, financeRenewalCycle === cycle && styles.activeSegmentText]}>
                                  {cycle.toUpperCase()}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        <TouchableOpacity style={styles.primaryButton} onPress={handleAddFinance}>
                          <Text style={styles.primaryBtnText}>Log Financial Item</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.sectionTitle}>Shared Finance Ledger</Text>
                      {financeItems.length === 0 ? (
                        <Text style={styles.mutedText}>No shared finance items recorded.</Text>
                      ) : (
                        financeItems.map((item) => {
                          const isSelf = item.item_name.startsWith('[SELF_LIABILITY] ');
                          const displayItemName = isSelf ? item.item_name.replace('[SELF_LIABILITY] ', '') : item.item_name;
                          const cardStyle = isSelf ? [
                            styles.financeCard,
                            {
                              backgroundColor: 'rgba(168, 85, 247, 0.12)',
                              shadowColor: '#A855F7',
                              shadowOffset: { width: 0, height: 10 },
                              shadowOpacity: 0.35,
                              shadowRadius: 18,
                            }
                          ] : styles.financeCard;

                          return (
                            <View key={item.id} style={cardStyle}>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.financeName}>{displayItemName}</Text>
                                <Text style={styles.financeMeta}>Due: {new Date(item.due_date).toLocaleDateString()} | Type: {isSelf ? 'SELF LIABILITY' : item.type.toUpperCase()} | {item.status.toUpperCase()}{isSelf ? ` | Owner: ${getCreatorName(item.created_by)}` : ''}</Text>
                              </View>
                              <View style={styles.financeActions}>
                                <Text style={styles.financeAmount}>₹{Number(item.amount).toFixed(2)}</Text>
                                {item.status !== 'paid' && (
                                  <TouchableOpacity style={styles.miniActionButton} onPress={() => markFinancePaid(item.id)}>
                                    <Text style={styles.btnText}>Paid</Text>
                                  </TouchableOpacity>
                                )}
                                <TouchableOpacity style={styles.miniDangerButton} onPress={() => removeFinance(item.id)}>
                                  <Text style={styles.btnText}>Remove</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  );
                })()}

                {/* Periods & Health Tab */}
                {activeTab === 'health' && (
                  <View style={styles.tabContent}>
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>MENSTRUAL REMINDER &amp; PREDICTION</Text>
                      {(!records || records.length === 0 || isEditingCycle) ? (
                        <>
                          <Text style={styles.inputLabel}>CHOOSE CYCLE START DATE</Text>
                          <TouchableOpacity 
                            style={styles.calendarPickerBtn} 
                            onPress={() => openCalendarFor('periodStartDate')}
                          >
                            <Text style={styles.calendarPickerBtnText}>
                              {periodStartDate ? `START: ${periodStartDate}` : 'CHOOSE START DATE'}
                            </Text>
                          </TouchableOpacity>

                          <Text style={styles.inputLabel}>CHOOSE CYCLE END DATE (OPTIONAL)</Text>
                          <TouchableOpacity 
                            style={styles.calendarPickerBtn} 
                            onPress={() => openCalendarFor('periodEndDate')}
                          >
                            <Text style={styles.calendarPickerBtnText}>
                              {periodEndDate ? `END: ${periodEndDate}` : 'CHOOSE END DATE (OPTIONAL)'}
                            </Text>
                          </TouchableOpacity>

                          <Text style={styles.inputLabel}>GIRLFRIEND SYMPTOMS QUESTIONNAIRE</Text>
                          <View style={styles.questionnaireCard}>
                            {/* Question 1: Bleeding Flow */}
                            <Text style={styles.questionTitle}>1. Bleeding / Flow</Text>
                            <View style={styles.optionsRow}>
                              {(['none', 'spotting', 'light', 'heavy'] as const).map((opt) => (
                                <TouchableOpacity
                                  key={opt}
                                  style={[styles.optionChip, gfBleeding === opt && styles.optionChipSelected]}
                                  onPress={() => setGfBleeding(opt)}
                                >
                                  <Text style={[styles.optionText, gfBleeding === opt && styles.optionTextSelected]}>
                                    {opt.toUpperCase()}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            {/* Question 2: Physical Sensations */}
                            <Text style={styles.questionTitle}>2. Physical Sensations</Text>
                            <View style={styles.optionsRow}>
                              {(['none', 'cramps', 'tender', 'bloating', 'energized'] as const).map((opt) => (
                                <TouchableOpacity
                                  key={opt}
                                  style={[styles.optionChip, gfPhysical === opt && styles.optionChipSelected]}
                                  onPress={() => setGfPhysical(opt)}
                                >
                                  <Text style={[styles.optionText, gfPhysical === opt && styles.optionTextSelected]}>
                                    {opt === 'tender' ? 'TENDER BREASTS' : opt.toUpperCase()}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            {/* Question 3: Cervical Fluid */}
                            <Text style={styles.questionTitle}>3. Cervical Fluid Type</Text>
                            <View style={styles.optionsRow}>
                              {(['none', 'dry', 'sticky', 'creamy', 'eggwhite'] as const).map((opt) => (
                                <TouchableOpacity
                                  key={opt}
                                  style={[styles.optionChip, gfFluid === opt && styles.optionChipSelected]}
                                  onPress={() => setGfFluid(opt)}
                                >
                                  <Text style={[styles.optionText, gfFluid === opt && styles.optionTextSelected]}>
                                    {opt === 'eggwhite' ? 'EGG-WHITE (FERTILE)' : opt.toUpperCase()}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            {/* Question 4: Emotional Vibe */}
                            <Text style={styles.questionTitle}>4. Emotional Vibe</Text>
                            <View style={styles.optionsRow}>
                              {(['calm', 'irritable', 'sad', 'anxious', 'happy'] as const).map((opt) => (
                                <TouchableOpacity
                                  key={opt}
                                  style={[styles.optionChip, gfEmotion === opt && styles.optionChipSelected]}
                                  onPress={() => setGfEmotion(opt)}
                                >
                                  <Text style={[styles.optionText, gfEmotion === opt && styles.optionTextSelected]}>
                                    {opt === 'calm' ? 'CALM/BALANCED' : opt.toUpperCase()}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>

                            {/* Question 5: Energy & Sleep */}
                            <Text style={styles.questionTitle}>5. Energy &amp; Sleep</Text>
                            <View style={styles.optionsRow}>
                              {(['low', 'normal', 'stressed', 'high'] as const).map((opt) => (
                                <TouchableOpacity
                                  key={opt}
                                  style={[styles.optionChip, gfEnergy === opt && styles.optionChipSelected]}
                                  onPress={() => setGfEnergy(opt)}
                                >
                                  <Text style={[styles.optionText, gfEnergy === opt && styles.optionTextSelected]}>
                                    {opt === 'low' ? 'LOW ENERGY' : opt === 'stressed' ? 'STRESSED/RESTLESS' : opt.toUpperCase()}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>

                          <TouchableOpacity style={styles.primaryButton} onPress={handleAddPeriodLog}>
                            <Text style={styles.primaryBtnText}>Save Cycle Data</Text>
                          </TouchableOpacity>

                          {records && records.length > 0 && (
                            <TouchableOpacity 
                              style={[styles.calendarPickerBtn, { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.06)' }]} 
                              onPress={() => setIsEditingCycle(false)}
                            >
                              <Text style={styles.calendarPickerBtnText}>Cancel Editing</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : (
                        (() => {
                          const latestRecord = records && records.length > 0 ? records[0] : null;
                          const phaseData = getCyclePhaseAndTips(latestRecord, predictions);
                          
                          return (
                            <View>
                              <View style={[styles.periodResultCard, { backgroundColor: phaseData.color + '22' }]}>
                                <Text style={[styles.predText, { color: phaseData.color, fontWeight: 'bold', fontSize: 14, marginBottom: 8 }]}>
                                  Current Status: {phaseData.badge}
                                </Text>
                                {predictions && (
                                  <>
                                    <Text style={styles.predText}>Next Predicted Period: {new Date(predictions.nextPeriodStart).toLocaleDateString()}</Text>
                                    <Text style={styles.predText}>Predicted Ovulation Day: {new Date(predictions.predictedOvulation).toLocaleDateString()}</Text>
                                  </>
                                )}
                                <Text style={[styles.predText, { opacity: 0.8, fontSize: 12 }]}>Reminder: Both partners get a notification 1 day before.</Text>
                              </View>

                              <View style={styles.adviceCard}>
                                <Text style={styles.adviceHeading}>BIOLOGICAL FORECAST</Text>
                                <Text style={[styles.adviceBody, { marginBottom: 12 }]}>
                                  {phaseData.forecast}
                                </Text>
                                
                                <Text style={styles.adviceHeading}>COZY RELATIONSHIP TIPS FOR BOYFRIEND</Text>
                                <Text style={styles.adviceBody}>
                                  {phaseData.tips}
                                </Text>
                              </View>

                              <TouchableOpacity 
                                style={[styles.primaryButton, { marginTop: 16 }]} 
                                onPress={() => setIsEditingCycle(true)}
                              >
                                <Text style={styles.primaryBtnText}>Edit Details / Log Symptoms</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })()
                      )}
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>HOSPITAL VISIT LOG</Text>
                      <Text style={styles.inputLabel}>VISIT DATE</Text>
                      <TouchableOpacity 
                        style={styles.calendarPickerBtn} 
                        onPress={() => openCalendarFor('hospitalDate')}
                      >
                        <Text style={styles.calendarPickerBtnText}>
                          {hospitalDate ? `VISIT DATE: ${hospitalDate}` : 'CHOOSE VISIT DATE'}
                        </Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.input}
                        placeholder="Reason for visit..."
                        placeholderTextColor="#666"
                        value={hospitalReason}
                        onChangeText={setHospitalReason}
                      />
                      <TextInput
                        multiline
                        textAlignVertical="top"
                        style={[styles.input, styles.noteInput]}
                        placeholder="Test results / doctor notes..."
                        placeholderTextColor="#666"
                        value={hospitalResults}
                        onChangeText={setHospitalResults}
                      />
                      <TouchableOpacity style={styles.primaryButton} onPress={logHospitalVisit}>
                        <Text style={styles.primaryBtnText}>Save Hospital Visit</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Hospital Visit History</Text>
                    {medLogs.map((log) => (
                      <View key={log.id} style={styles.vaultRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.vaultText}>{getCreatorName(log.user_id)}: {log.value_json?.reason || 'Hospital visit'}</Text>
                          <Text style={styles.financeMeta}>{log.value_json?.test_results || 'No test results added.'}</Text>
                        </View>
                        <Text style={styles.vaultDate}>{new Date(log.record_date).toLocaleDateString()}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Bucket List Tab */}
                {activeTab === 'bucket' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity style={styles.backRow} onPress={() => setActiveTab('hub')}>
                      <ChevronLeft size={20} color="#F18F2E" />
                      <Text style={styles.backRowText}>Hub</Text>
                    </TouchableOpacity>
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>ADD EXPERIENCES GOAL</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Header..."
                        placeholderTextColor="#666"
                        value={newBucketTitle}
                        onChangeText={setNewBucketTitle}
                      />
                      <TextInput
                        multiline
                        textAlignVertical="top"
                        style={[styles.input, styles.noteInput]}
                        placeholder="Description..."
                        placeholderTextColor="#666"
                        value={newBucketDescription}
                        onChangeText={setNewBucketDescription}
                      />
                      <TouchableOpacity style={styles.primaryButton} onPress={handleAddBucket}>
                        <Text style={styles.primaryBtnText}>Add experience to list</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Our Aspirations Checklist</Text>
                    {bucketList.length === 0 ? (
                      <Text style={styles.mutedText}>Bucket list is currently empty.</Text>
                    ) : (
                      bucketList.map((item) => (
                        <BlinkingBucketRow 
                          key={item.id} 
                          item={item} 
                          getCreatorName={getCreatorName} 
                          onToggle={() => toggleBucketItemShared(item)}
                          onDelete={() => deleteBucketItem(item.id)}
                        />
                      ))
                    )}
                  </View>
                )}
                </ScreenTransition>
              </ScrollView>
            </KeyboardAvoidingView>
            </SafeAreaView>

          {/* Bottom Absolute Black Fade Vignette Overlay */}
          <View style={styles.bottomOverlayFade} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <SvgLinearGradient id="bottomOverlayBlackFade" x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0%" stopColor="#080807" stopOpacity="1" />
                  <Stop offset="15%" stopColor="#080807" stopOpacity="1" />
                  <Stop offset="45%" stopColor="#080807" stopOpacity="0.9" />
                  <Stop offset="70%" stopColor="#080807" stopOpacity="0.5" />
                  <Stop offset="100%" stopColor="#080807" stopOpacity="0" />
                </SvgLinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#bottomOverlayBlackFade)" />
            </Svg>
          </View>

          {/* Premium Bottom Tab Bar */}
          <AnimatedTabBar
            tabs={['hub', 'notes', 'finances', 'health'] as const}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {/* Visual Calendar Modal */}
          <Modal
            visible={isCalendarVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              setIsCalendarVisible(false);
              setCalendarTarget(null);
            }}
          >
            <View style={styles.calendarModalOverlay}>
              <View style={styles.calendarModalContent}>
                <Text style={styles.calendarModalTitle}>
                  SELECT {calendarTarget === 'periodStartDate' ? 'START DATE' :
                          calendarTarget === 'periodEndDate' ? 'END DATE' :
                          calendarTarget === 'hospitalDate' ? 'VISIT DATE' :
                          calendarTarget === 'todoDate' ? 'TODO DATE' : 'DUE DATE'}
                </Text>
                <Calendar
                  onDayPress={(day: any) => handleDateSelect(day.dateString)}
                  theme={{
                    backgroundColor: '#1C1C1E',
                    calendarBackground: '#1C1C1E',
                    textSectionTitleColor: '#FFD66B',
                    selectedDayBackgroundColor: '#FF6B00',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#FF8A00',
                    dayTextColor: '#E5E5EA',
                    textDisabledColor: '#444444',
                    dotColor: '#FF6B00',
                    selectedDotColor: '#ffffff',
                    arrowColor: '#FF6B00',
                    monthTextColor: '#FFFFFF',
                    textDayFontWeight: '500',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 13,
                    textMonthFontSize: 15,
                    textDayHeaderFontSize: 11
                  }}
                />
                <TouchableOpacity 
                  style={styles.calendarCloseBtn} 
                  onPress={() => {
                    setIsCalendarVisible(false);
                    setCalendarTarget(null);
                  }}
                >
                  <Text style={styles.calendarCloseBtnText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Sliding Side Drawer Overlay */}
          {isDrawerOpen && (
            <View style={styles.drawerBackdrop}>
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: drawerAnim }]}>
                <TouchableOpacity 
                  style={{ flex: 1 }} 
                  activeOpacity={1} 
                  onPress={() => toggleDrawer(false)} 
                />
              </Animated.View>

              <Animated.View 
                style={[
                  styles.drawerPanel,
                  {
                    transform: [{
                      translateX: drawerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-280, 0]
                      })
                    }]
                  }
                ]}
              >
                <TouchableOpacity 
                  style={styles.drawerCloseButton} 
                  onPress={() => toggleDrawer(false)}
                >
                  <X color="#E5E5EA" size={20} />
                </TouchableOpacity>

                <View style={styles.drawerProfileSection}>
                  <View style={styles.drawerAvatar}>
                    <Text style={styles.drawerAvatarText}>
                      {welcomeName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.drawerProfileName}>{welcomeName}</Text>
                  <Text style={styles.drawerProfileEmail}>{session?.user?.email}</Text>
                  {partnerProfile && (
                    <View style={styles.drawerPartnerRow}>
                      <Heart size={12} color="#FF6B00" fill="#FF6B00" style={{ marginRight: 4 }} />
                      <Text style={styles.drawerPartnerText}>Paired with {partnerProfile.display_name || partnerName}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity 
                  style={styles.drawerMenuItem} 
                  onPress={() => {
                    toggleDrawer(false);
                    setIsSettingsVisible(true);
                    markUpdatesViewed();
                  }}
                >
                  <SettingsIcon color="#FF6B00" size={20} style={{ marginRight: 12 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.drawerMenuText}>Settings</Text>
                    {hasUnseenUpdate && <View style={styles.unseenDot} />}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.drawerMenuItem, styles.drawerMenuItemLogout]} 
                  onPress={() => {
                    toggleDrawer(false);
                    Alert.alert(
                      "Sign Out",
                      "Are you sure you want to end your synchronized session?",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Sign Out", style: "destructive", onPress: signOut }
                      ]
                    );
                  }}
                >
                  <LogOut color="#FF453A" size={20} style={{ marginRight: 12 }} />
                  <Text style={[styles.drawerMenuText, { color: '#FF453A' }]}>Sign Out</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}

          {/* Account & Pairing Settings Modal */}
          <Modal
            visible={isSettingsVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setIsSettingsVisible(false)}
          >
            <View style={styles.settingsModalOverlay}>
              <View style={styles.settingsModalContent}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>ACCOUNT &amp; PAIRING</Text>
                  <TouchableOpacity onPress={() => setIsSettingsVisible(false)}>
                    <X color="#E5E5EA" size={20} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.settingsBody} keyboardShouldPersistTaps="handled">
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>My Profile</Text>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>YOUR DISPLAY NAME</Text>
                      <TextInput
                        style={styles.settingsInput}
                        placeholder="Enter name..."
                        placeholderTextColor="#666"
                        value={tempDisplayName}
                        onChangeText={setTempDisplayName}
                      />
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.settingsSaveButton} 
                      onPress={handleSaveDisplayName}
                    >
                      <Text style={styles.settingsSaveBtnText}>SAVE NAME</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>Sync Key</Text>
                    <Text style={styles.settingsHelpText}>
                      Share this unique key if your partner needs to sync with you.
                    </Text>
                    <View style={[styles.userIdContainer, { marginTop: 0 }]}>
                      <TextInput
                        style={styles.copyableIdText}
                        value={session?.user?.id}
                        editable={false}
                        selectTextOnFocus={true}
                      />
                      <Text style={styles.copyInstructions}>
                        Hold or double-tap to select and copy key.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>What's New</Text>
                    <Text style={styles.settingsHelpText}>
                      Updates pushed to NOVIA. Your partner sees the same list.
                    </Text>
                    {appUpdates.length === 0 ? (
                      <Text style={styles.settingsHelpText}>No updates published yet.</Text>
                    ) : (
                      appUpdates.map((u) => (
                        <View key={u.id} style={styles.updateEntry}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.updateVersion}>v{u.version}</Text>
                            <Text style={styles.updateDate}>{new Date(u.created_at).toLocaleDateString()}</Text>
                          </View>
                          <Text style={styles.updateTitle}>{u.title}</Text>
                          {u.body ? <Text style={styles.updateBody}>{u.body}</Text> : null}
                        </View>
                      ))
                    )}
                  </View>

                  {coupleId && (
                    <View style={[styles.settingsSection, { marginBottom: 0, paddingBottom: 0 }]}>
                      <Text style={styles.settingsSectionTitle}>Danger Zone</Text>
                      <Text style={styles.settingsHelpText}>
                        Unpairing will decouple your screens. Your data remains safe on Supabase.
                      </Text>
                      
                      <TouchableOpacity 
                        style={styles.unpairButton} 
                        onPress={handleUnpairPress}
                      >
                        <Text style={styles.unpairBtnText}>UNPAIR PARTNER</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#080807',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingVertical: THEME.spacing.sm,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: THEME.colors.primary,
    letterSpacing: 3,
  },
  headerSubtitle: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  authContainer: {
    padding: THEME.spacing.md,
    alignItems: 'center',
  },
  card: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.lg,
    borderRadius: THEME.borderRadius.lg,
    width: '100%',
    marginTop: THEME.spacing.xl,
    ...THEME.shadow.lifted,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: THEME.spacing.md,
    textAlign: 'center',
  },
  authInfo: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
  },
  authNote: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 16,
  },
  scrollArea: {
    flex: 1,
  },
  tabContent: {
    paddingBottom: 140,
  },
  welcomeCard: {
    paddingHorizontal: THEME.spacing.xs,
    paddingVertical: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  welcomeKicker: {
    color: '#FFD66B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: THEME.spacing.xs,
  },
  welcomeTitle: {
    color: THEME.colors.text,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 2,
  },
  welcomeSubtitle: {
    color: '#E5E5EA',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: THEME.spacing.xs,
  },
  suggestionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  welcomeCopy: {
    color: '#A29AA8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  partnerCard: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.soft,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 1.5,
    marginBottom: THEME.spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerName: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  moodBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.round,
  },
  moodBadgeText: {
    color: THEME.colors.text,
    fontWeight: '700',
    fontSize: 11,
  },
  typingNotice: {
    fontSize: 11,
    color: THEME.colors.primary,
    fontStyle: 'italic',
    marginTop: THEME.spacing.sm,
  },
  sectionCard: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.soft,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodBtn: {
    backgroundColor: THEME.glass.surface,
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
    ...THEME.shadow.soft,
  },
  moodBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  input: {
    backgroundColor: THEME.glass.inset,
    color: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 14,
    fontSize: 19,
    marginBottom: THEME.spacing.sm,
  },
  primaryButton: {
    backgroundColor: '#E74627',
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    marginTop: THEME.spacing.xs,
    ...THEME.shadow.glowAccent,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 19,
    letterSpacing: 1.5,
  },
  firstAidResponse: {
    backgroundColor: THEME.glass.success,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
  },
  firstAidTitle: {
    color: '#2ECC71',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: THEME.spacing.xs,
  },
  firstAidSub: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    marginTop: THEME.spacing.sm,
    marginBottom: THEME.spacing.xs,
  },
  firstAidStep: {
    color: '#FF8A80',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  noMatchText: {
    color: '#555555',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: THEME.spacing.xs,
  },
  canvasCard: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    minHeight: 350,
    ...THEME.shadow.soft,
  },
  canvasText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 300,
  },
  noteInput: {
    minHeight: 96,
  },
  noteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  noteCard: {
    backgroundColor: THEME.glass.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    width: '48%',
    marginBottom: THEME.spacing.md,
    minHeight: 128,
    ...THEME.shadow.soft,
  },
  noteAuthor: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  noteBody: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 19,
    marginTop: THEME.spacing.sm,
  },
  removeText: {
    color: THEME.colors.danger,
    fontSize: 10,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
    letterSpacing: 1,
  },
  alarmHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  alarmHeaderSub: {
    color: '#A9A09A',
    fontSize: 14,
    marginTop: -4,
    marginBottom: THEME.spacing.xs,
  },
  addAlarmButton: {
    backgroundColor: THEME.glass.accentStrong,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minWidth: 74,
    alignItems: 'center',
  },
  addAlarmButtonText: {
    color: '#E74627',
    fontSize: 14,
    fontWeight: '900',
  },
  deleteAlarmButton: {
    backgroundColor: 'rgba(239, 83, 80, 0.12)',
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
    padding: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
  },
  deleteAlarmButtonText: {
    color: '#EF5350',
    fontSize: 15,
    fontWeight: '900',
  },
  alarmCreatorCard: {
    backgroundColor: THEME.glass.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.lifted,
  },
  alarmPreview: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: THEME.spacing.sm,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
  },
  spinnerPanel: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.sm,
  },
  spinnerButton: {
    width: 44,
    height: 36,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.glass.accentStrong,
  },
  spinnerButtonText: {
    color: '#E74627',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
  },
  spinnerValue: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    marginTop: THEME.spacing.sm,
  },
  spinnerLabel: {
    color: '#CCCCCC',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: THEME.spacing.sm,
  },
  spinnerDivider: {
    width: 28,
    alignItems: 'center',
  },
  spinnerColon: {
    color: '#E74627',
    fontSize: 32,
    fontWeight: '900',
  },
  daySelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.md,
  },
  dayChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.glass.surface,
    ...THEME.shadow.soft,
  },
  activeDayChip: {
    backgroundColor: '#E74627',
    ...THEME.shadow.glowAccent,
  },
  dayChipText: {
    color: '#CCCCCC',
    fontWeight: '900',
    fontSize: 14,
  },
  activeDayChipText: {
    color: '#FFFFFF',
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.sm,
    padding: 5,
    marginBottom: THEME.spacing.sm,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: THEME.borderRadius.sm,
  },
  activeSegmentOption: {
    backgroundColor: 'rgba(231, 70, 39, 0.12)',
  },
  segmentText: {
    color: '#A0A0A0',
    fontSize: 11,
    fontWeight: '900',
  },
  activeSegmentText: {
    color: '#E74627',
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    padding: THEME.spacing.lg,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  emptyText: {
    color: '#CCCCCC',
    fontSize: 15,
    textAlign: 'center',
  },
  alarmRowCard: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
    gap: 10,
    ...THEME.shadow.soft,
  },
  alarmTime: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  alarmSyncMode: {
    fontSize: 12,
    color: '#A0A0A0',
    marginTop: 2,
  },
  alarmPurpose: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 2,
  },
  alarmDaysText: {
    fontSize: 12,
    color: '#E74627',
    marginTop: 3,
    fontWeight: '700',
  },
  alarmCreatorText: {
    fontSize: 11,
    color: '#8A817C',
    marginTop: 4,
    fontStyle: 'italic',
  },
  reminderDateButton: {
    backgroundColor: THEME.glass.inset,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  reminderDateButtonText: {
    color: '#FFD66B',
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  actionBtnSnooze: {
    backgroundColor: THEME.glass.accentStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.sm,
    marginRight: 6,
  },
  actionBtnDismiss: {
    backgroundColor: THEME.glass.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.sm,
  },
  disabledActionButton: {
    opacity: 0.5,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  smallBtn: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
    backgroundColor: THEME.glass.surface,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.soft,
  },
  financeCard: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.soft,
  },
  financeName: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  financeMeta: {
    fontSize: 11,
    color: '#A0A0A0',
    marginTop: 2,
  },
  financeAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E74627',
  },
  financeActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  miniActionButton: {
    backgroundColor: THEME.glass.accentStrong,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniDangerButton: {
    backgroundColor: THEME.glass.danger,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  periodResultCard: {
    backgroundColor: THEME.glass.accent,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.md,
  },
  predText: {
    color: '#E74627',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  vaultRow: {
    backgroundColor: THEME.glass.surface,
    borderRadius: THEME.borderRadius.sm,
    marginBottom: THEME.spacing.xs,
    padding: THEME.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vaultText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  vaultDate: {
    color: '#A0A0A0',
    fontSize: 11,
  },
  bucketRow: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.sm,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.soft,
  },
  bucketText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bucketDescription: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.xs,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: THEME.colors.textMuted,
  },
  locationPlace: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  locationCoords: {
    color: '#A29AA8',
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  locationMeta: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  locationDistance: {
    color: THEME.colors.accent,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: THEME.spacing.sm,
  },
  locationErrorText: {
    color: THEME.colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: THEME.spacing.sm,
    marginBottom: THEME.spacing.xs,
  },
  locationSecondaryBtn: {
    marginTop: THEME.spacing.sm,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: 'rgba(241, 143, 46, 0.16)',
    alignItems: 'center',
  },
  locationSecondaryBtnText: {
    color: THEME.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  locationStopBtn: {
    marginTop: THEME.spacing.sm,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.glass.danger,
    alignItems: 'center',
  },
  locationStopBtnText: {
    color: '#FF6B5A',
    fontSize: 13,
    fontWeight: '700',
  },
  locationHint: {
    color: '#5F5F5F',
    fontSize: 11,
    lineHeight: 15,
    marginTop: THEME.spacing.md,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(18, 17, 16, 0.82)',
    borderRadius: 34,
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 76 : 64,
    left: 16,
    right: 16,
    height: 66,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    zIndex: 10,
    elevation: 16,
  },
  tabIndicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(231, 70, 39, 0.18)',
    shadowColor: '#E74627',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  bottomOverlayFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 8,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  activeTabItem: {
    borderRadius: 24,
    backgroundColor: 'rgba(231, 70, 39, 0.15)',
  },
  tabLabel: {
    color: '#777777',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  activeTabLabel: {
    color: '#E74627',
    fontWeight: '900',
  },
  punishmentOverlay: {
    flex: 1,
    backgroundColor: '#080807',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  punishTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: THEME.colors.danger,
    marginBottom: THEME.spacing.md,
    letterSpacing: 2,
  },
  punishDescription: {
    color: '#AAA',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: THEME.spacing.lg,
  },
  penaltyCard: {
    backgroundColor: THEME.glass.danger,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    width: '100%',
    marginBottom: THEME.spacing.xl,
  },
  penaltyText: {
    color: '#FF6B6B',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  resolveButton: {
    backgroundColor: '#E74C3C',
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.borderRadius.sm,
  },
  resolveBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  mutedText: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: THEME.spacing.xs,
  },
  authTabRow: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.md,
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.sm,
    padding: 5,
  },
  authTab: {
    flex: 1,
    paddingVertical: THEME.spacing.sm,
    alignItems: 'center',
    borderRadius: THEME.borderRadius.sm,
  },
  activeAuthTab: {
    backgroundColor: THEME.glass.accentStrong,
  },
  authTabText: {
    color: '#A0A0A0',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  activeAuthTabText: {
    color: THEME.colors.primary,
  },
  inputGroup: {
    marginBottom: THEME.spacing.md,
    width: '100%',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#CCCCCC',
    letterSpacing: 1,
    marginBottom: THEME.spacing.xs,
  },
  userIdContainer: {
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    width: '100%',
    marginBottom: THEME.spacing.md,
    alignItems: 'center',
  },
  userIdLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 1.5,
    marginBottom: THEME.spacing.sm,
  },
  copyableIdText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: THEME.glass.surfaceStrong,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.sm,
    width: '100%',
    textAlign: 'center',
  },
  copyInstructions: {
    fontSize: 10,
    color: '#A0A0A0',
    marginTop: THEME.spacing.xs,
    fontStyle: 'italic',
  },
  divider: {
    height: 0,
    backgroundColor: 'transparent',
    width: '100%',
    marginVertical: THEME.spacing.md,
  },
  signOutButton: {
    backgroundColor: THEME.glass.danger,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
    marginTop: THEME.spacing.md,
    width: '100%',
  },
  signOutBtnText: {
    color: THEME.colors.danger,
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 1,
  },
  reminderDeleteButton: {
    marginLeft: THEME.spacing.sm,
    padding: 8,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.glass.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderDeleteText: {
    color: '#E74627',
    fontSize: 12,
    fontWeight: '900',
  },
  analyticsCombinedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    backgroundColor: THEME.glass.accent,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
  },
  analyticsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A0A0A0',
    letterSpacing: 1.5,
  },
  analyticsCombinedValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#E74627',
    marginTop: 4,
  },
  progressGroup: {
    marginBottom: THEME.spacing.sm,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#E74627',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  dateStrip: {
    flexDirection: 'row',
    marginVertical: THEME.spacing.xs,
  },
  dateCard: {
    width: 58,
    height: 72,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.glass.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: THEME.spacing.xs,
    ...THEME.shadow.soft,
  },
  activeDateCard: {
    backgroundColor: '#E74627',
    ...THEME.shadow.glowAccent,
  },
  dateCardDay: {
    fontSize: 9,
    fontWeight: '800',
    color: '#CCCCCC',
    letterSpacing: 1,
  },
  activeDateCardText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dateCardNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  dateCardMonth: {
    fontSize: 9,
    fontWeight: '800',
    color: '#CCCCCC',
    letterSpacing: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  quickAddChip: {
    backgroundColor: THEME.glass.accentStrong,
    borderRadius: THEME.borderRadius.round,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickAddChipText: {
    color: '#E74627',
    fontSize: 12,
    fontWeight: '800',
  },
  addReminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  plusAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E74627',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E74627',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  plusAddButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 26,
  },
  remindersList: {
    gap: THEME.spacing.sm,
  },
  noRemindersText: {
    color: '#A0A0A0',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: THEME.spacing.md,
    fontStyle: 'italic',
  },
  reminderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.glass.surface,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    ...THEME.shadow.soft,
  },
  reminderCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.glass.inset,
  },
  reminderCheckboxCompleted: {
    backgroundColor: '#E74627',
    ...THEME.shadow.glowAccent,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  reminderTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: THEME.spacing.sm,
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
    color: '#A0A0A0',
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 7, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(24, 22, 21, 0.94)',
    borderRadius: 24,
    padding: 18,
    ...THEME.shadow.lifted,
  },
  calendarModalTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FF6B00',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
  },
  calendarCloseBtn: {
    marginTop: 16,
    backgroundColor: THEME.glass.surfaceStrong,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  calendarCloseBtnText: {
    color: '#E5E5EA',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  calendarPickerBtn: {
    backgroundColor: THEME.glass.inset,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarPickerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  questionnaireCard: {
    backgroundColor: THEME.glass.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadow.soft,
  },
  questionTitle: {
    color: '#FFD66B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  optionChip: {
    backgroundColor: THEME.glass.surface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  optionChipSelected: {
    backgroundColor: THEME.glass.accentStrong,
  },
  optionText: {
    color: '#E5E5EA',
    fontSize: 11,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#FF6B00',
    fontWeight: '700',
  },
  adviceCard: {
    backgroundColor: THEME.glass.accent,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  adviceHeading: {
    color: '#FFD66B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  adviceBody: {
    color: '#E5E5EA',
    fontSize: 12,
    lineHeight: 18,
  },
  settlementCard: {
    backgroundColor: THEME.glass.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadow.soft,
  },
  subscriptionForecastCard: {
    backgroundColor: THEME.glass.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadow.soft,
  },
  floatingMenuButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 12 : 16,
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(28, 26, 25, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    ...THEME.shadow.soft,
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    backgroundColor: 'rgba(14, 13, 12, 0.96)',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },
  drawerCloseButton: {
    alignSelf: 'flex-end',
    padding: 10,
    borderRadius: 12,
    backgroundColor: THEME.glass.surface,
    marginBottom: 20,
  },
  drawerProfileSection: {
    alignItems: 'center',
    paddingBottom: 24,
    marginBottom: 24,
  },
  drawerAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: THEME.glass.accentStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...THEME.shadow.glowAccent,
  },
  drawerAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  drawerProfileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  drawerProfileEmail: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    marginBottom: 8,
  },
  drawerPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.glass.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  drawerPartnerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFD66B',
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  drawerMenuItemLogout: {
    marginTop: 'auto',
    marginBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: 'rgba(255, 69, 58, 0.05)',
  },
  drawerMenuText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 7, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  settingsModalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(20, 19, 18, 0.95)',
    borderRadius: 24,
    padding: 22,
    ...THEME.shadow.lifted,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
  },
  settingsTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FF6B00',
    letterSpacing: 1.5,
  },
  settingsBody: {
    maxHeight: 400,
  },
  settingsSection: {
    marginBottom: 20,
    paddingBottom: 16,
  },
  settingsSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD66B',
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  settingsInput: {
    backgroundColor: THEME.glass.inset,
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  settingsSaveButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    ...THEME.shadow.glowAccent,
  },
  settingsSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  settingsHelpText: {
    color: '#A0A0A0',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  unpairButton: {
    backgroundColor: 'rgba(255, 69, 58, 0.14)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  unpairBtnText: {
    color: '#FF453A',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  ringingOverlayBg: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 10, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ringingGlassContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(22, 21, 24, 0.9)',
    borderRadius: 30,
    padding: 32,
    alignItems: 'center',
    ...THEME.shadow.glowAccent,
  },
  ringingCatRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: THEME.glass.accentStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#FF6B00',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  ringingCatGlow: {
    width: 84,
    height: 84,
    tintColor: '#FF6B00',
  },
  ringingTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FF6B00',
    letterSpacing: 3,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  ringingTime: {
    fontSize: 54,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 12,
  },
  ringingPurpose: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  ringingSubText: {
    fontSize: 12,
    color: '#A0A0A0',
    fontWeight: '500',
    marginBottom: 32,
    letterSpacing: 1,
  },
  ringingActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 16,
  },
  ringingButton: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringingSnoozeBtn: {
    backgroundColor: THEME.glass.surfaceStrong,
  },
  ringingDismissBtn: {
    backgroundColor: '#FF6B00',
    ...THEME.shadow.glowAccent,
  },
  ringingBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.5,
  },

  // ---- Navigation / Todo / Complaint / Updates additions -------------------
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backRowText: {
    color: '#F18F2E',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navCard: {
    width: '48%',
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...THEME.shadow.soft,
  },
  navCardLabel: {
    color: '#E5E0DC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.3,
  },
  vocabWord: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  vocabMeaning: {
    color: '#E5E0DC',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  vocabExample: {
    color: '#A9A09A',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.glass.inset,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  ticketTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  replyBubble: {
    borderRadius: 14,
    padding: 10,
    maxWidth: '88%',
  },
  replyMine: {
    backgroundColor: 'rgba(241,143,46,0.16)',
    alignSelf: 'flex-end',
  },
  replyTheirs: {
    backgroundColor: THEME.glass.inset,
    alignSelf: 'flex-start',
  },
  secondaryButton: {
    height: 46,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.glass.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#E5E0DC',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  updateEntry: {
    backgroundColor: THEME.glass.inset,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  updateVersion: {
    color: '#F18F2E',
    fontSize: 13,
    fontWeight: '800',
  },
  updateDate: {
    color: '#A9A09A',
    fontSize: 11,
  },
  updateTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  updateBody: {
    color: '#E5E0DC',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  unseenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E74627',
    marginLeft: 8,
  },
});
