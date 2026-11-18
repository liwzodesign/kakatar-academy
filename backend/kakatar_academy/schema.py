"""Schéma GraphQL (lecture seule) : catalogue de cours et catégories."""
import graphene
from graphene_django import DjangoObjectType

from courses.models import Category, Course, Lesson, Module


class CategoryType(DjangoObjectType):
    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'icon', 'color', 'parent', 'children')


class LessonType(DjangoObjectType):
    class Meta:
        model = Lesson
        fields = ('id', 'title', 'description', 'type', 'order', 'is_free', 'estimated_duration', 'video_duration')


class ModuleType(DjangoObjectType):
    class Meta:
        model = Module
        fields = ('id', 'title', 'description', 'order', 'lessons')


class CourseType(DjangoObjectType):
    instructor_name = graphene.String()

    class Meta:
        model = Course
        fields = (
            'id', 'title', 'slug', 'subtitle', 'short_description', 'description', 'category',
            'level', 'type', 'price', 'currency', 'duration', 'lessons_count', 'students_count',
            'rating_average', 'rating_count', 'modules', 'published_at',
        )

    def resolve_instructor_name(self, info):
        return self.instructor.get_full_name()

    def resolve_modules(self, info):
        return self.modules.all()


class Query(graphene.ObjectType):
    courses = graphene.List(CourseType, search=graphene.String(), category=graphene.String(),
                            first=graphene.Int(default_value=20))
    course = graphene.Field(CourseType, slug=graphene.String(required=True))
    categories = graphene.List(CategoryType)

    def resolve_courses(self, info, search=None, category=None, first=20):
        qs = Course.objects.filter(status=Course.Status.PUBLISHED).select_related('instructor', 'category')
        if search:
            qs = qs.filter(title__icontains=search)
        if category:
            qs = qs.filter(category__slug=category)
        return qs[: min(first, 100)]

    def resolve_course(self, info, slug):
        return Course.objects.filter(slug=slug, status=Course.Status.PUBLISHED).first()

    def resolve_categories(self, info):
        return Category.objects.filter(is_active=True)


schema = graphene.Schema(query=Query)
