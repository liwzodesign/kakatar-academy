export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ETUDIANT' | 'FORMATEUR' | 'ADMIN';
  avatar?: string;
  verified?: boolean;
  bio?: string;
  createdAt: Date;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string;
  price: number;
  level: 'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE';
  category: string;
  duration: number; // en minutes
  lessonsCount: number;
  rating: number;
  studentsCount: number;
  instructor: User;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'PROJECT';
  duration: number;
  order: number;
  videoUrl?: string;
  content?: string;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  order: number;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  progress: number; // 0-100
  completedLessons: string[];
  enrolledAt: Date;
}

export interface Session {
  id: string;
  courseId: string;
  title: string;
  description: string;
  date: Date;
  duration: number;
  location: string;
  capacity: number;
  registrations: number;
  price: number;
  instructor: User;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}