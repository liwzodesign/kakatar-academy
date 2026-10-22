import { useState, useEffect } from 'react';
import { Course, User } from '../types';

// Mock data pour la démo
const mockInstructors: User[] = [
  { id: '2', name: 'Dr. Jean Martin', email: 'jean@example.com', role: 'FORMATEUR', verified: true, bio: 'Expert en développement web', createdAt: new Date() },
  { id: '4', name: 'Sarah Chen', email: 'sarah@example.com', role: 'FORMATEUR', verified: true, bio: 'Data Scientist Senior', createdAt: new Date() },
  { id: '5', name: 'Ahmed Okafor', email: 'ahmed@example.com', role: 'FORMATEUR', verified: true, bio: 'UX/UI Designer', createdAt: new Date() }
];

const mockCourses: Course[] = [
  {
    id: '1',
    title: 'React & Next.js - Formation Complète',
    slug: 'react-nextjs-formation-complete',
    description: 'Maîtrisez React et Next.js de A à Z avec des projets pratiques et des techniques avancées.',
    thumbnail: 'https://images.pexels.com/photos/11035380/pexels-photo-11035380.jpeg?auto=compress&cs=tinysrgb&w=800',
    price: 89000,
    level: 'INTERMEDIAIRE',
    category: 'Développement Web',
    duration: 1800,
    lessonsCount: 45,
    rating: 4.8,
    studentsCount: 1247,
    instructor: mockInstructors[0],
    status: 'PUBLISHED',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-12-01')
  },
  {
    id: '2',
    title: 'Data Science avec Python',
    slug: 'data-science-python',
    description: 'Analysez et visualisez vos données avec Python, Pandas, NumPy et Matplotlib.',
    thumbnail: 'https://images.pexels.com/photos/590020/pexels-photo-590020.jpeg?auto=compress&cs=tinysrgb&w=800',
    price: 125000,
    level: 'AVANCE',
    category: 'Data Science',
    duration: 2400,
    lessonsCount: 38,
    rating: 4.9,
    studentsCount: 892,
    instructor: mockInstructors[1],
    status: 'PUBLISHED',
    createdAt: new Date('2024-02-20'),
    updatedAt: new Date('2024-11-15')
  },
  {
    id: '3',
    title: 'Design UX/UI Moderne',
    slug: 'design-ux-ui-moderne',
    description: 'Créez des interfaces utilisateur exceptionnelles avec Figma et les principes du design thinking.',
    thumbnail: 'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=800',
    price: 67000,
    level: 'DEBUTANT',
    category: 'Design',
    duration: 1200,
    lessonsCount: 32,
    rating: 4.7,
    studentsCount: 1456,
    instructor: mockInstructors[2],
    status: 'PUBLISHED',
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-12-05')
  },
  {
    id: '4',
    title: 'JavaScript ES6+ Avancé',
    slug: 'javascript-es6-avance',
    description: 'Approfondissez vos connaissances JavaScript avec les fonctionnalités modernes et les design patterns.',
    thumbnail: 'https://images.pexels.com/photos/4164418/pexels-photo-4164418.jpeg?auto=compress&cs=tinysrgb&w=800',
    price: 75000,
    level: 'INTERMEDIAIRE',
    category: 'Développement Web',
    duration: 1500,
    lessonsCount: 28,
    rating: 4.6,
    studentsCount: 987,
    instructor: mockInstructors[0],
    status: 'PUBLISHED',
    createdAt: new Date('2024-04-05'),
    updatedAt: new Date('2024-11-20')
  }
];

export const useCourses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setCourses(mockCourses);
      setLoading(false);
    }, 800);
  }, []);

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || course.category === selectedCategory;
    const matchesLevel = !selectedLevel || course.level === selectedLevel;
    
    return matchesSearch && matchesCategory && matchesLevel;
  });

  const categories = Array.from(new Set(courses.map(course => course.category)));
  const levels = ['DEBUTANT', 'INTERMEDIAIRE', 'AVANCE'];

  return {
    courses: filteredCourses,
    allCourses: courses,
    loading,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedLevel,
    setSelectedLevel,
    categories,
    levels
  };
};