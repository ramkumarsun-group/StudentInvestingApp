export type UserRole = 'student' | 'teacher' | 'admin';
export type SubscriptionPlan = 'free' | 'student_pro' | 'school_license';

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  avatarUrl?: string;
  dateOfBirth?: string;
  schoolId?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserStats {
  totalXp: number;
  currentLevel: number;
  levelName: string;
  xpToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  badgeCount: number;
  isPro: boolean;
}
