"""Génération du certificat de réussite en PDF (ReportLab)."""
from io import BytesIO

from django.conf import settings
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

BRAND = colors.HexColor('#E85D04')   # orange Kakatar
INK = colors.HexColor('#1F2937')
MUTED = colors.HexColor('#6B7280')

MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
             'août', 'septembre', 'octobre', 'novembre', 'décembre']


def _date_fr(dt):
    dt = timezone.localtime(dt) if timezone.is_aware(dt) else dt
    return f"{dt.day} {MONTHS_FR[dt.month - 1]} {dt.year}"


def _fit(c, text, font, max_size, max_width):
    size = max_size
    while size > 12 and c.stringWidth(text, font, size) > max_width:
        size -= 1
    return size


def render_certificate_pdf(enrollment) -> bytes:
    buf = BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buf, pagesize=(width, height))
    c.setTitle(f"Certificat - {enrollment.course.title}")
    c.setAuthor('Kakatar Academy')

    # Cadre
    c.setStrokeColor(BRAND)
    c.setLineWidth(6)
    c.rect(24, 24, width - 48, height - 48)
    c.setLineWidth(1)
    c.rect(36, 36, width - 72, height - 72)

    # En-tête
    c.setFillColor(BRAND)
    c.setFont('Helvetica-Bold', 16)
    c.drawCentredString(width / 2, height - 90, 'KAKATAR ACADEMY')
    c.setFillColor(INK)
    c.setFont('Helvetica-Bold', 38)
    c.drawCentredString(width / 2, height - 150, 'Certificat de réussite')

    c.setFillColor(MUTED)
    c.setFont('Helvetica', 14)
    c.drawCentredString(width / 2, height - 200, 'Ce certificat est décerné à')

    name = enrollment.user.get_full_name()
    c.setFillColor(INK)
    size = _fit(c, name, 'Helvetica-Bold', 32, width - 160)
    c.setFont('Helvetica-Bold', size)
    c.drawCentredString(width / 2, height - 245, name)

    c.setFillColor(MUTED)
    c.setFont('Helvetica', 14)
    c.drawCentredString(width / 2, height - 290, 'pour avoir suivi avec succès la formation')

    title = enrollment.course.title
    c.setFillColor(BRAND)
    size = _fit(c, title, 'Helvetica-Bold', 24, width - 160)
    c.setFont('Helvetica-Bold', size)
    c.drawCentredString(width / 2, height - 330, title)

    hours = round((enrollment.course.duration or 0) / 60, 1)
    if hours:
        c.setFillColor(MUTED)
        c.setFont('Helvetica', 12)
        c.drawCentredString(width / 2, height - 355, f"Durée indicative : {hours:g} h".replace(".", ","))

    # Pied : date, formateur, code de vérification
    issued = enrollment.certificate_issued_at or timezone.now()
    c.setFillColor(INK)
    c.setFont('Helvetica', 12)
    c.drawString(90, 110, f"Délivré le {_date_fr(issued)}")
    c.drawRightString(width - 90, 110, enrollment.course.instructor.get_full_name())
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 10)
    c.drawRightString(width - 90, 95, 'Formateur')

    verify_url = f"{settings.FRONTEND_URL.rstrip('/')}/certificats/{enrollment.certificate_code}"
    c.setFont('Helvetica', 9)
    c.drawCentredString(width / 2, 60,
                        f"Code {enrollment.certificate_code} · Vérification : {verify_url}")

    c.showPage()
    c.save()
    return buf.getvalue()
