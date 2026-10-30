export type Role = 'ETUDIANT' | 'FORMATEUR' | 'ADMIN' | 'MODERATEUR' | 'PARTENAIRE';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: Role;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  avatar_url: string;
  phone_number?: string;
  city?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  courses_count: number;
}

export type Level = 'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE';

export interface CourseSummary {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  short_description: string;
  thumbnail: string | null;
  category: Category;
  level: Level;
  type: 'FREE' | 'PAID' | 'SUBSCRIPTION';
  price: string;
  price_display: string;
  original_price: string | null;
  currency: string;
  is_featured: boolean;
  duration: number;
  lessons_count: number;
  students_count: number;
  rating_average: string;
  rating_count: number;
  instructor: { id: string; name: string; avatar: string; is_verified: boolean };
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'PROJECT' | 'RESOURCE' | 'ASSIGNMENT';
  order: number;
  content: string;
  video_url: string;
  resources: { title?: string; url: string }[];
  is_free: boolean;
  estimated_duration: number;
  duration_display: string;
  is_completed: boolean;
  is_locked: boolean;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
  lessons_count: number;
  duration: number;
  progress: number;
}

export interface EnrollmentProgress {
  id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  progress: string;
  current_lesson: string | null;
  completed_lessons: string[];
  certificate_issued: boolean;
}

export interface CourseDetail extends CourseSummary {
  description: string;
  preview_video: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';
  certificate_available: boolean;
  modules: Module[];
  is_enrolled: boolean;
  enrollment_progress: EnrollmentProgress | null;
  instructor: CourseSummary['instructor'] & { bio: string };
}

export interface Enrollment {
  id: string;
  course: {
    id: string; title: string; slug: string; thumbnail: string | null;
    instructor: string; lessons_count: number; duration: number;
  };
  status: EnrollmentProgress['status'];
  progress: string;
  current_lesson: string | null;
  certificate_issued: boolean;
  certificate_code: string;
}

export interface Payment {
  id: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  gateway: 'WAVE' | 'PAYDUNYA';
  checkout_url: string;
  description: string;
  error_message: string;
  created_at: string;
  course: { slug: string; title: string } | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
