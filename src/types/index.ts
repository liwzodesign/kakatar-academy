export type Role = 'ETUDIANT' | 'FORMATEUR' | 'ADMIN' | 'MODERATEUR' | 'PARTENAIRE';
export type Level = 'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE';

export interface User {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  avatar?: string;
  verified?: boolean;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  bio?: string;
  phone?: string;
  country?: string;
  city?: string;
  company?: string;
  website?: string;
  linkedin?: string;
  twoFactorEnabled?: boolean;
  emailNotifications?: boolean;
  createdAt: Date;
}

export interface InstructorSummary {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  verified?: boolean;
  rating?: number;
  totalStudents?: number;
  totalCourses?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  icon?: string;
  coursesCount: number;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  subtitle?: string;
  description: string;
  shortDescription?: string;
  thumbnail: string;
  price: number;
  originalPrice?: number | null;
  currency: string;
  priceDisplay: string;
  discountPercentage: number;
  type: 'FREE' | 'PAID' | 'SUBSCRIPTION';
  level: Level;
  category: string;
  categorySlug?: string;
  categoryId?: number;
  duration: number; // minutes
  lessonsCount: number;
  rating: number;
  ratingCount: number;
  studentsCount: number;
  completionRate: number;
  instructor: InstructorSummary;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';
  isFeatured?: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer?: number;
  explanation?: string;
}

export interface Lesson {
  id: string;
  moduleId?: string;
  title: string;
  description: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'PROJECT' | 'RESOURCE' | 'ASSIGNMENT';
  duration: number; // minutes
  order: number;
  videoUrl?: string;
  videoStatus?: string;
  content?: string;
  isFree: boolean;
  locked: boolean;
  completed: boolean;
  quiz: QuizQuestion[];
  passingScore: number;
  summary?: string;
  resources: { title: string; url: string }[];
  status?: string;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  order: number;
  isFree: boolean;
  duration: number;
}

export interface Review {
  id: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title?: string;
  comment: string;
  createdAt: Date;
  instructorReply?: string;
  repliedAt?: Date | null;
}

export interface EnrollmentInfo {
  id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  progress: number;
  currentLesson: string | null;
  completedLessons: string[];
  certificateCode: string | null;
}

export interface CourseDetail extends Course {
  objectives: string[];
  requirements: string[];
  modules: Module[];
  reviews: Review[];
  isEnrolled: boolean;
  isFavorite: boolean;
  isOwner: boolean;
  enrollment: EnrollmentInfo | null;
  relatedCourses: Course[];
  certificateAvailable: boolean;
  previewVideo?: string;
  language: string;
}

export interface Enrollment {
  id: string;
  course: Course;
  status: EnrollmentInfo['status'];
  progress: number;
  completedLessons: string[];
  currentLesson: string | null;
  enrolledAt: Date;
  lastAccessed: Date;
  certificateCode: string | null;
}

export interface Session {
  id: string;
  title: string;
  description: string;
  date: Date;
  endDate: Date;
  duration: number;
  type: 'ONLINE' | 'PRESENTIAL' | 'HYBRID';
  location: string;
  capacity: number;
  registrations: number;
  spotsLeft: number;
  price: number;
  currency: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  level: Level;
  category: string;
  categoryId?: number | null;
  instructor: InstructorSummary;
  isRegistered: boolean;
  registrationStatus: string | null;
  isOwner: boolean;
  meetingUrl: string;
  recordingUrl: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: 'TEMPLATE' | 'SOURCE_CODE' | 'EBOOK' | 'RESOURCE' | 'COACHING' | 'SERVICE';
  price: number;
  currency: string;
  preview: string;
  deliveryDays: number;
  status: string;
  salesCount: number;
  rating: number;
  ratingCount: number;
  seller: InstructorSummary;
  hasFile: boolean;
  isDigital: boolean;
  isOwner: boolean;
  hasPurchased: boolean;
}

export interface Order {
  id: string;
  product: Product;
  buyer: { id: string; name: string; email: string };
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  amount: number;
  currency: string;
  requirements: string;
  deliveryMessage: string;
  hasDeliveryFile: boolean;
  createdAt: Date;
}

export interface Payment {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  statusDisplay: string;
  gateway: string;
  gatewayDisplay: string;
  description: string;
  isSandbox: boolean;
  courseSlug?: string;
  createdAt: Date;
  user?: { id: string; name: string; email: string };
  metadata?: Record<string, any>;
}

export interface Gateway {
  code: string;
  label: string;
  sandbox: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
