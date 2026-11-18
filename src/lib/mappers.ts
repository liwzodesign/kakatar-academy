/** Conversion des réponses de l'API (snake_case) vers les types du frontend. */
import {
  Course, CourseDetail, Enrollment, InstructorSummary, Lesson, Module, Order, Payment, Product, Review, Session, User,
} from '../types';

const num = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const date = (v: any) => (v ? new Date(v) : new Date());

export const FALLBACK_THUMBNAIL =
  'https://images.pexels.com/photos/301926/pexels-photo-301926.jpeg?auto=compress&cs=tinysrgb&w=800';

export function mapUser(u: any): User {
  return {
    id: u.id,
    name: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
    firstName: u.first_name || '',
    lastName: u.last_name || '',
    email: u.email,
    role: u.role,
    avatar: u.avatar_url || undefined,
    verified: u.is_verified,
    verificationStatus: u.verification_status,
    bio: u.bio || '',
    phone: u.phone_number || '',
    country: u.country || '',
    city: u.city || '',
    company: u.company || '',
    website: u.website || '',
    linkedin: u.linkedin || '',
    twoFactorEnabled: u.two_factor_enabled,
    emailNotifications: u.email_notifications !== false,
    createdAt: date(u.date_joined),
  };
}

export function mapInstructor(i: any): InstructorSummary {
  if (!i) return { id: '', name: '' };
  return {
    id: i.id,
    name: i.name,
    avatar: i.avatar,
    bio: i.bio,
    verified: i.is_verified,
    rating: num(i.rating_average ?? i.rating),
    totalStudents: i.total_students,
    totalCourses: i.total_courses,
  };
}

export function mapCourse(c: any): Course {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    subtitle: c.subtitle,
    description: c.short_description || c.description || '',
    shortDescription: c.short_description,
    thumbnail: c.thumbnail || FALLBACK_THUMBNAIL,
    price: num(c.price),
    originalPrice: c.original_price ? num(c.original_price) : null,
    currency: c.currency || 'XOF',
    priceDisplay: c.price_display || '',
    discountPercentage: c.discount_percentage || 0,
    type: c.type,
    level: c.level,
    category: c.category?.name || '',
    categorySlug: c.category?.slug,
    categoryId: c.category?.id,
    duration: num(c.duration),
    lessonsCount: num(c.lessons_count),
    rating: Math.round(num(c.rating_average) * 10) / 10,
    ratingCount: num(c.rating_count),
    studentsCount: num(c.students_count),
    completionRate: num(c.completion_rate),
    instructor: mapInstructor(c.instructor),
    status: c.status,
    isFeatured: c.is_featured,
    tags: c.tags || [],
    createdAt: date(c.created_at),
    updatedAt: date(c.updated_at),
  };
}

export function mapLesson(l: any): Lesson {
  const minutes = l.video_duration ? Math.max(1, Math.round(l.video_duration / 60)) : num(l.estimated_duration);
  return {
    id: l.id,
    moduleId: l.module_id,
    title: l.title,
    description: l.description || '',
    type: l.type,
    duration: minutes,
    order: l.order,
    videoUrl: l.playback_url || l.video_url || '',
    videoStatus: l.video_status,
    content: l.content || '',
    isFree: !!l.is_free,
    locked: !!l.locked,
    completed: !!l.is_completed,
    quiz: l.quiz || [],
    passingScore: l.passing_score ?? 70,
    summary: l.summary || '',
    resources: l.resources || [],
    status: l.status,
  };
}

export function mapModule(m: any): Module {
  return {
    id: m.id,
    title: m.title,
    description: m.description || '',
    order: m.order,
    isFree: !!m.is_free,
    duration: num(m.duration),
    lessons: (m.lessons || []).map(mapLesson),
  };
}

export function mapReview(r: any): Review {
  return {
    id: r.id,
    userName: r.user?.name || 'Anonyme',
    userAvatar: r.user?.avatar,
    rating: r.rating,
    title: r.title,
    comment: r.comment || '',
    createdAt: date(r.created_at),
    instructorReply: r.instructor_reply || '',
    repliedAt: r.replied_at ? new Date(r.replied_at) : null,
  };
}

export function mapCourseDetail(c: any): CourseDetail {
  const enrollment = c.enrollment
    ? {
        id: c.enrollment.id,
        status: c.enrollment.status,
        progress: num(c.enrollment.progress),
        currentLesson: c.enrollment.current_lesson,
        completedLessons: c.enrollment.completed_lessons || [],
        certificateCode: c.enrollment.certificate_code,
      }
    : null;
  const modules = (c.modules || []).map(mapModule);
  const done = new Set(enrollment?.completedLessons || []);
  modules.forEach((m: Module) => m.lessons.forEach((l) => (l.completed = l.completed || done.has(l.id))));
  return {
    ...mapCourse(c),
    description: c.description || '',
    objectives: c.objectives || [],
    requirements: c.requirements || [],
    modules,
    reviews: (c.reviews || []).map(mapReview),
    isEnrolled: !!c.is_enrolled,
    isFavorite: !!c.is_favorite,
    isOwner: !!c.is_owner,
    enrollment,
    relatedCourses: (c.related_courses || []).map(mapCourse),
    certificateAvailable: !!c.certificate_available,
    previewVideo: c.preview_video,
    language: c.language || 'fr',
  };
}

export function mapEnrollment(e: any): Enrollment {
  return {
    id: e.id,
    course: mapCourse(e.course),
    status: e.status,
    progress: num(e.progress),
    completedLessons: e.completed_lessons || [],
    currentLesson: e.current_lesson,
    enrolledAt: date(e.enrolled_at),
    lastAccessed: date(e.last_accessed),
    certificateCode: e.certificate_code,
  };
}

export function mapSession(s: any): Session {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    date: date(s.start_at),
    endDate: date(s.end_at),
    duration: s.duration,
    type: s.type,
    location: s.type === 'ONLINE' ? 'En ligne (visioconférence)' : s.location,
    capacity: s.capacity,
    registrations: s.registrations_count,
    spotsLeft: s.spots_left,
    price: num(s.price),
    currency: s.currency,
    status: s.status,
    level: s.level,
    category: s.category_name || 'Général',
    categoryId: s.category,
    instructor: mapInstructor(s.instructor),
    isRegistered: !!s.is_registered,
    registrationStatus: s.registration_status,
    isOwner: !!s.is_owner,
    meetingUrl: s.meeting_url || '',
    recordingUrl: s.recording_url || '',
  };
}

export function mapProduct(p: any): Product {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    type: p.type,
    price: num(p.price),
    currency: p.currency,
    preview: p.preview || FALLBACK_THUMBNAIL,
    deliveryDays: p.delivery_days,
    status: p.status,
    salesCount: p.sales_count,
    rating: num(p.rating_average),
    ratingCount: p.rating_count,
    seller: mapInstructor(p.seller),
    hasFile: !!p.has_file,
    isDigital: !!p.is_digital,
    isOwner: !!p.is_owner,
    hasPurchased: !!p.has_purchased,
  };
}

export function mapOrder(o: any): Order {
  return {
    id: o.id,
    product: mapProduct(o.product),
    buyer: o.buyer,
    status: o.status,
    amount: num(o.amount),
    currency: o.currency,
    requirements: o.requirements || '',
    deliveryMessage: o.delivery_message || '',
    hasDeliveryFile: !!o.has_delivery_file,
    createdAt: date(o.created_at),
  };
}

export function mapPayment(p: any): Payment {
  return {
    id: p.id,
    reference: p.reference,
    amount: num(p.amount),
    currency: p.currency,
    type: p.type,
    status: p.status,
    statusDisplay: p.status_display,
    gateway: p.gateway,
    gatewayDisplay: p.gateway_display,
    description: p.description,
    isSandbox: !!p.is_sandbox,
    courseSlug: p.course_purchase?.course?.slug,
    createdAt: date(p.created_at),
    user: p.user,
    metadata: p.metadata,
  };
}
