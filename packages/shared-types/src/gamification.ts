export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type BadgeCategory = 'trading' | 'learning' | 'social' | 'streak';
export type LessonStatus = 'not_started' | 'in_progress' | 'completed';
export type ModuleDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Level {
  id: number;
  name: string;
  minXp: number;
  badgeColor: string;
  iconUrl?: string;
}

export const LEVELS: Level[] = [
  { id: 1, name: 'Rookie',        minXp: 0,     badgeColor: '#9CA3AF' },
  { id: 2, name: 'Novice',        minXp: 500,   badgeColor: '#6EE7B7' },
  { id: 3, name: 'Apprentice',    minXp: 1500,  badgeColor: '#67E8F9' },
  { id: 4, name: 'Analyst',       minXp: 3500,  badgeColor: '#93C5FD' },
  { id: 5, name: 'Trader',        minXp: 7000,  badgeColor: '#A78BFA' },
  { id: 6, name: 'Investor',      minXp: 12000, badgeColor: '#F472B6' },
  { id: 7, name: 'Strategist',    minXp: 20000, badgeColor: '#FB923C' },
  { id: 8, name: 'Portfolio Mgr', minXp: 30000, badgeColor: '#FBBF24' },
  { id: 9, name: 'Expert',        minXp: 45000, badgeColor: '#34D399' },
  { id: 10, name: 'Legend',       minXp: 65000, badgeColor: '#F59E0B' },
];

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl?: string;
  category: BadgeCategory;
  xpReward: number;
  rarity: BadgeRarity;
  criteriaJson: Record<string, unknown>;
  earnedAt?: string;
}

export interface Module {
  id: string;
  slug: string;
  title: string;
  description: string;
  assetType?: string;
  difficulty: ModuleDifficulty;
  xpReward: number;
  sortOrder: number;
  isPublished: boolean;
  requiresPro: boolean;
  lessonCount?: number;
  completedLessons?: number;
  completionPct?: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  contentJson: LessonBlock[];
  xpReward: number;
  sortOrder: number;
  estimatedMinutes: number;
  status?: LessonStatus;
}

export interface LessonBlock {
  type: 'text' | 'image' | 'callout' | 'key_term' | 'quiz_cta';
  content?: string;
  url?: string;
  alt?: string;
  term?: string;
  definition?: string;
  variant?: 'info' | 'warning' | 'tip';
}

export interface Quiz {
  id: string;
  lessonId: string;
  questionText: string;
  options: QuizOption[];
  explanation: string;
  xpReward: number;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface XPEvent {
  id: string;
  userId: string;
  eventType: string;
  xpAmount: number;
  referenceId?: string;
  createdAt: string;
}

export interface Challenge {
  id: string;
  classId?: string;
  createdBy: string;
  title: string;
  description: string;
  challengeType: 'return_pct' | 'quiz_score' | 'module_complete' | 'streak';
  targetValue: number;
  xpReward: number;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'active' | 'completed';
  participantCount?: number;
  myProgress?: number;
  isCompleted?: boolean;
}
