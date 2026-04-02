#!/usr/bin/env python3
"""
AICount User Manual PDF Generator
Generates a comprehensive user manual for the AICount Thai Accounting SaaS platform.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, HRFlowable, ListFlowable, ListItem, Flowable
)
from reportlab.pdfgen import canvas
from reportlab.lib import colors

# ── Brand Colors ──────────────────────────────────────────────────
PRIMARY = HexColor("#2563EB")       # Blue
PRIMARY_DARK = HexColor("#1E40AF")
SECONDARY = HexColor("#7C3AED")     # Purple
SUCCESS = HexColor("#059669")       # Green
WARNING = HexColor("#D97706")       # Amber
DESTRUCTIVE = HexColor("#DC2626")   # Red
GRAY_50 = HexColor("#F9FAFB")
GRAY_100 = HexColor("#F3F4F6")
GRAY_200 = HexColor("#E5E7EB")
GRAY_300 = HexColor("#D1D5DB")
GRAY_500 = HexColor("#6B7280")
GRAY_700 = HexColor("#374151")
GRAY_800 = HexColor("#1F2937")
GRAY_900 = HexColor("#111827")
BG_LIGHT = HexColor("#EFF6FF")


# ── Custom Flowables ──────────────────────────────────────────────

class ColoredBox(Flowable):
    """A colored box with text inside, used for tips, warnings, etc."""
    def __init__(self, text, bg_color, border_color, icon="", width=None):
        Flowable.__init__(self)
        self.text = text
        self.bg_color = bg_color
        self.border_color = border_color
        self.icon = icon
        self._width = width or 460

    def wrap(self, availWidth, availHeight):
        self._width = min(self._width, availWidth - 10)
        self.height = 50
        return (self._width, self.height)

    def draw(self):
        self.canv.setFillColor(self.bg_color)
        self.canv.setStrokeColor(self.border_color)
        self.canv.setLineWidth(1.5)
        self.canv.roundRect(0, 0, self._width, self.height, 6, fill=1, stroke=1)
        self.canv.setFillColor(GRAY_800)
        self.canv.setFont("Helvetica-Bold", 9)
        self.canv.drawString(12, self.height - 18, self.icon)
        self.canv.setFont("Helvetica", 8.5)
        # Word wrap the text
        words = self.text.split()
        lines = []
        line = ""
        for w in words:
            test = f"{line} {w}".strip()
            if self.canv.stringWidth(test, "Helvetica", 8.5) < self._width - 30:
                line = test
            else:
                lines.append(line)
                line = w
        if line:
            lines.append(line)
        y = self.height - 34
        for l in lines[:3]:
            self.canv.drawString(12, y, l)
            y -= 12


class SectionDivider(Flowable):
    """A horizontal line divider."""
    def __init__(self, color=GRAY_200, width=None):
        Flowable.__init__(self)
        self.color = color
        self._width = width or 460

    def wrap(self, availWidth, availHeight):
        self._width = min(self._width, availWidth)
        return (self._width, 8)

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(0.5)
        self.canv.line(0, 4, self._width, 4)


# ── Page Templates ────────────────────────────────────────────────

def cover_page(canvas_obj, doc):
    """Draw the cover page."""
    canvas_obj.saveState()
    w, h = A4

    # Blue gradient background
    canvas_obj.setFillColor(PRIMARY)
    canvas_obj.rect(0, h * 0.45, w, h * 0.55, fill=1, stroke=0)

    # Decorative circles
    canvas_obj.setFillColor(HexColor("#3B82F6"))
    canvas_obj.circle(w * 0.85, h * 0.75, 80, fill=1, stroke=0)
    canvas_obj.setFillColor(HexColor("#1D4ED8"))
    canvas_obj.circle(w * 0.15, h * 0.55, 50, fill=1, stroke=0)

    # Title
    canvas_obj.setFillColor(white)
    canvas_obj.setFont("Helvetica-Bold", 42)
    canvas_obj.drawString(50, h * 0.72, "AICount")

    canvas_obj.setFont("Helvetica", 18)
    canvas_obj.drawString(50, h * 0.72 - 35, "User Manual")

    canvas_obj.setFont("Helvetica", 13)
    canvas_obj.drawString(50, h * 0.72 - 65, "Thai Accounting SaaS Platform")

    # Version & date box
    canvas_obj.setFillColor(HexColor("#1E40AF"))
    canvas_obj.roundRect(50, h * 0.72 - 115, 200, 30, 5, fill=1, stroke=0)
    canvas_obj.setFillColor(white)
    canvas_obj.setFont("Helvetica", 11)
    canvas_obj.drawString(65, h * 0.72 - 105, "Version 1.1.0  |  April 2026")

    # Bottom section
    canvas_obj.setFillColor(GRAY_700)
    canvas_obj.setFont("Helvetica", 11)
    canvas_obj.drawString(50, h * 0.35, "Comprehensive guide covering:")

    features = [
        "Document OCR & AI-powered extraction",
        "Journal entries, approvals & workflow",
        "Thai tax compliance (VAT, WHT certificates)",
        "Financial reporting & bank reconciliation",
        "AI learning & cross-tenant intelligence",
        "Backoffice administration & cost management",
    ]
    y = h * 0.30
    canvas_obj.setFont("Helvetica", 10)
    for f in features:
        canvas_obj.setFillColor(PRIMARY)
        canvas_obj.circle(62, y + 3, 3, fill=1, stroke=0)
        canvas_obj.setFillColor(GRAY_700)
        canvas_obj.drawString(75, y, f)
        y -= 18

    # Footer
    canvas_obj.setFillColor(GRAY_500)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawString(50, 30, "CONFIDENTIAL - For authorized users only")
    canvas_obj.drawRightString(w - 50, 30, "AICount by Bossk Technologies")

    canvas_obj.restoreState()


def header_footer(canvas_obj, doc):
    """Standard header/footer for content pages."""
    canvas_obj.saveState()
    w, h = A4

    # Header line
    canvas_obj.setStrokeColor(PRIMARY)
    canvas_obj.setLineWidth(1.5)
    canvas_obj.line(50, h - 40, w - 50, h - 40)

    canvas_obj.setFillColor(PRIMARY_DARK)
    canvas_obj.setFont("Helvetica-Bold", 8)
    canvas_obj.drawString(50, h - 35, "AICount")

    canvas_obj.setFillColor(GRAY_500)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawRightString(w - 50, h - 35, "AICount User Manual v1.1.0")

    # Footer
    canvas_obj.setStrokeColor(GRAY_200)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(50, 40, w - 50, 40)

    canvas_obj.setFillColor(GRAY_500)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawString(50, 28, "AICount - Thai Accounting SaaS Platform")
    canvas_obj.drawRightString(w - 50, 28, f"Page {doc.page}")

    canvas_obj.restoreState()


# ── Styles ────────────────────────────────────────────────────────

def get_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name='ChapterTitle',
        fontName='Helvetica-Bold',
        fontSize=22,
        textColor=PRIMARY_DARK,
        spaceAfter=8,
        spaceBefore=20,
        leading=28,
    ))

    styles.add(ParagraphStyle(
        name='SectionTitle',
        fontName='Helvetica-Bold',
        fontSize=15,
        textColor=GRAY_800,
        spaceAfter=6,
        spaceBefore=14,
        leading=20,
    ))

    styles.add(ParagraphStyle(
        name='SubSection',
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=GRAY_700,
        spaceAfter=4,
        spaceBefore=10,
        leading=16,
    ))

    styles.add(ParagraphStyle(
        name='Body',
        fontName='Helvetica',
        fontSize=10,
        textColor=GRAY_700,
        spaceAfter=6,
        spaceBefore=2,
        leading=14,
        alignment=TA_JUSTIFY,
    ))

    styles.add(ParagraphStyle(
        name='BodyBold',
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=GRAY_700,
        spaceAfter=4,
        spaceBefore=2,
        leading=14,
    ))

    styles.add(ParagraphStyle(
        name='BulletItem',
        fontName='Helvetica',
        fontSize=9.5,
        textColor=GRAY_700,
        spaceAfter=3,
        spaceBefore=1,
        leading=13,
        leftIndent=20,
        bulletIndent=8,
        bulletFontSize=9,
    ))

    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=white,
        alignment=TA_CENTER,
        leading=12,
    ))

    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=8.5,
        textColor=GRAY_700,
        leading=11,
    ))

    styles.add(ParagraphStyle(
        name='Caption',
        fontName='Helvetica-Oblique',
        fontSize=8,
        textColor=GRAY_500,
        spaceAfter=8,
        spaceBefore=2,
        alignment=TA_CENTER,
    ))

    styles.add(ParagraphStyle(
        name='TOCChapter',
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=PRIMARY_DARK,
        spaceAfter=4,
        spaceBefore=10,
        leading=16,
    ))

    styles.add(ParagraphStyle(
        name='TOCSection',
        fontName='Helvetica',
        fontSize=10,
        textColor=GRAY_700,
        spaceAfter=2,
        spaceBefore=1,
        leading=14,
        leftIndent=20,
    ))

    return styles


# ── Helper functions ──────────────────────────────────────────────

def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    s = get_styles()
    header_row = [Paragraph(h, s['TableHeader']) for h in headers]
    data_rows = []
    for row in rows:
        data_rows.append([Paragraph(str(cell), s['TableCell']) for cell in row])

    table_data = [header_row] + data_rows
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 1), (-1, -1), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_50]),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_200),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def tip_box(text):
    return ColoredBox(text, HexColor("#EFF6FF"), PRIMARY, icon="TIP:")

def warning_box(text):
    return ColoredBox(text, HexColor("#FFFBEB"), WARNING, icon="WARNING:")

def note_box(text):
    return ColoredBox(text, HexColor("#F0FDF4"), SUCCESS, icon="NOTE:")

def bullet(text, s):
    return Paragraph(f"<bullet>&bull;</bullet> {text}", s['BulletItem'])

def numbered(num, text, s):
    return Paragraph(f"<b>{num}.</b> {text}", s['BulletItem'])


# ── Content Sections ──────────────────────────────────────────────

def build_toc(s):
    """Table of Contents."""
    story = []
    story.append(Paragraph("Table of Contents", s['ChapterTitle']))
    story.append(Spacer(1, 10))

    chapters = [
        ("1", "Product Overview", [
            "1.1 What is AICount?",
            "1.2 Key Features at a Glance",
            "1.3 System Architecture",
            "1.4 User Roles & Permissions",
        ]),
        ("2", "Getting Started", [
            "2.1 Creating an Account",
            "2.2 Onboarding Wizard",
            "2.3 Setting Up Your Workspace",
            "2.4 Inviting Team Members",
        ]),
        ("3", "Document Upload & OCR", [
            "3.1 Uploading Documents",
            "3.2 How OCR Works: The Three-Tier Pipeline",
            "3.3 Supported Document Types",
            "3.4 Confidence Scoring",
            "3.5 Tips to Improve OCR Accuracy",
        ]),
        ("4", "Extraction & Data Review", [
            "4.1 The Extraction Page",
            "4.2 Editing Extracted Data",
            "4.3 Line Item Editor",
            "4.4 AI Suggestions & Smart Corrections",
            "4.5 Duplicate Detection",
        ]),
        ("5", "Journal Entries & Approvals", [
            "5.1 Automatic Journal Entry Creation",
            "5.2 GL Account Mapping",
            "5.3 Document Workflow (Submit / Approve / Reject)",
            "5.4 Batch Approval",
            "5.5 Journal Reversals",
        ]),
        ("6", "Thai Tax Compliance", [
            "6.1 VAT Processing & Rules",
            "6.2 WHT Certificates (PND3, PND53, PP36)",
            "6.3 Tax Reports",
            "6.4 VAT Registers",
        ]),
        ("7", "Financial Reports", [
            "7.1 Trial Balance",
            "7.2 Profit & Loss Statement",
            "7.3 Balance Sheet",
            "7.4 Cash Flow Statement",
            "7.5 GL Detail & Journal Listing",
            "7.6 Report History & Versioning",
        ]),
        ("8", "Bank Reconciliation", [
            "8.1 Setting Up Bank Accounts",
            "8.2 Uploading Bank Statements",
            "8.3 Automatic Matching",
            "8.4 Manual Matching",
            "8.5 Reconciliation Settings",
        ]),
        ("9", "Accounts Receivable & Payable", [
            "9.1 Receivables (AR)",
            "9.2 Payables (AP)",
            "9.3 Payment Recording",
            "9.4 Aging Analysis",
        ]),
        ("10", "Master Data Management", [
            "10.1 Chart of Accounts",
            "10.2 Vendors",
            "10.3 Customers",
            "10.4 Departments & Products",
            "10.5 Bulk Import",
        ]),
        ("11", "Settings & Configuration", [
            "11.1 Profile & Security",
            "11.2 Workspace Settings",
            "11.3 Accounting Settings",
            "11.4 Period Locks",
            "11.5 Report Retention Policies",
            "11.6 Export Templates",
        ]),
        ("12", "Export & Integration", [
            "12.1 Exporting to Accounting Software",
            "12.2 Custom Export Templates",
            "12.3 PDF Report Generation",
        ]),
        ("13", "AI Learning & Intelligence", [
            "13.1 How AI Learning Works",
            "13.2 Per-Tenant Rule Graduation",
            "13.3 Cross-Tenant Pattern Learning",
            "13.4 Suggestion Providers & Priority",
            "13.5 Privacy & Data Anonymization",
        ]),
        ("14", "Data Processing Pipeline", [
            "14.1 End-to-End Document Flow",
            "14.2 Background Job Architecture",
            "14.3 Extraction Validation",
            "14.4 Error Handling & Retry",
        ]),
        ("15", "Backoffice Administration", [
            "15.1 Platform Overview Dashboard",
            "15.2 Tenant Management",
            "15.3 Pattern Explorer",
            "15.4 Business Rules Engine",
            "15.5 Platform Analytics",
        ]),
        ("16", "Cost Breakdown & Pricing", [
            "16.1 AI Model Pricing Tiers",
            "16.2 Per-Document Cost Estimates",
            "16.3 Budget Management",
            "16.4 Usage Analytics",
            "16.5 Cost Optimization Tips",
        ]),
        ("17", "Security & Compliance", [
            "17.1 Multi-Tenant Data Isolation",
            "17.2 Authentication & Authorization",
            "17.3 PDPA Compliance",
            "17.4 Audit Trail",
            "17.5 Data Retention",
        ]),
    ]

    for num, title, sections in chapters:
        story.append(Paragraph(f"Chapter {num}: {title}", s['TOCChapter']))
        for sec in sections:
            story.append(Paragraph(sec, s['TOCSection']))

    story.append(PageBreak())
    return story


def build_chapter1(s):
    """Product Overview."""
    story = []
    story.append(Paragraph("Chapter 1: Product Overview", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    # 1.1
    story.append(Paragraph("1.1 What is AICount?", s['SectionTitle']))
    story.append(Paragraph(
        "AICount is a comprehensive Thai accounting SaaS platform designed to replace traditional desktop "
        "accounting software like Express Accounting. It combines intelligent document processing with "
        "full double-entry bookkeeping, Thai tax compliance, and AI-powered automation to streamline "
        "the entire accounting workflow from document intake to financial reporting.",
        s['Body']
    ))
    story.append(Paragraph(
        "Built on modern cloud architecture with Next.js, React, and Supabase (PostgreSQL), AICount "
        "delivers a fast, responsive experience accessible from any web browser. The platform supports "
        "multi-tenant workspaces, allowing accounting firms and businesses to manage multiple entities "
        "from a single login.",
        s['Body']
    ))
    story.append(Spacer(1, 6))

    # 1.2
    story.append(Paragraph("1.2 Key Features at a Glance", s['SectionTitle']))

    features = [
        ["AI-Powered OCR", "Three-tier extraction pipeline using Google Vision and Claude AI models for intelligent document scanning with 85%+ accuracy"],
        ["Smart Journal Entries", "Automatic GL mapping, journal entry creation, and voucher numbering from extracted document data"],
        ["Thai Tax Compliance", "Full support for VAT returns, WHT certificates (PND3, PND53, PP36), and Revenue Department forms"],
        ["Bank Reconciliation", "Intelligent auto-matching of bank transactions with GL entries using configurable tolerance and date windows"],
        ["Financial Reporting", "Complete suite: Trial Balance, P&L, Balance Sheet, Cash Flow, GL Detail with PDF generation"],
        ["AI Learning", "Per-tenant rule graduation and cross-tenant pattern learning that improves accuracy over time"],
        ["Multi-Tenant", "Isolated workspaces with role-based access (Maker/Checker/Admin) and team management"],
        ["Bulk Operations", "Batch approval, bulk master data import, multi-file upload with duplicate detection"],
        ["Export Integration", "Export to Express, QuickBooks, Excel, CSV, and custom templates"],
        ["Audit Trail", "Complete action logging with user, timestamp, and entity tracking for compliance"],
    ]

    story.append(make_table(
        ["Feature", "Description"],
        features,
        col_widths=[120, 350]
    ))
    story.append(Spacer(1, 10))

    # 1.3
    story.append(Paragraph("1.3 System Architecture", s['SectionTitle']))
    story.append(Paragraph(
        "AICount is built on a modern technology stack designed for reliability, performance, and scalability:",
        s['Body']
    ))

    tech_stack = [
        ["Frontend", "Next.js 16 (App Router), React 19, Tailwind CSS v4"],
        ["Backend", "Next.js API Routes, TypeScript"],
        ["Database", "PostgreSQL via Supabase + Drizzle ORM"],
        ["Authentication", "Supabase SSR Auth with cookie-based sessions"],
        ["State Management", "Zustand (client), React Query (server)"],
        ["Background Jobs", "Inngest (event-driven serverless functions)"],
        ["OCR Provider", "Google Cloud Vision API (primary)"],
        ["AI Models", "Anthropic Claude (Haiku 4.5, Sonnet 4.6) for extraction"],
        ["File Storage", "Supabase Storage (S3-compatible)"],
        ["PDF Generation", "@react-pdf/renderer (server-side)"],
        ["Email", "Resend"],
        ["Validation", "Zod v4"],
    ]

    story.append(make_table(
        ["Layer", "Technology"],
        tech_stack,
        col_widths=[120, 350]
    ))
    story.append(Spacer(1, 10))

    # 1.4
    story.append(Paragraph("1.4 User Roles & Permissions", s['SectionTitle']))
    story.append(Paragraph(
        "AICount implements a Maker-Checker workflow with three user roles:",
        s['Body']
    ))

    roles = [
        ["Admin", "Full workspace access. Can manage settings, team members, master data, reports, and all document operations. Combines Maker + Checker permissions."],
        ["Maker", "Can upload documents, edit extracted data, create journal entries, and submit documents for approval. Cannot approve their own submissions."],
        ["Checker", "Can review, approve, or reject submitted documents. Can generate reports and WHT certificates. Provides the second pair of eyes in the approval workflow."],
    ]

    story.append(make_table(
        ["Role", "Permissions"],
        roles,
        col_widths=[80, 390]
    ))
    story.append(tip_box(
        "The Maker-Checker model ensures segregation of duties - the person who creates a transaction cannot be the one who approves it, reducing fraud risk."
    ))

    story.append(PageBreak())
    return story


def build_chapter2(s):
    """Getting Started."""
    story = []
    story.append(Paragraph("Chapter 2: Getting Started", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("2.1 Creating an Account", s['SectionTitle']))
    story.append(Paragraph(
        "To begin using AICount, navigate to the signup page and create your account:",
        s['Body']
    ))
    story.append(numbered(1, "Visit the AICount login page and click <b>Sign Up</b>", s))
    story.append(numbered(2, "Enter your full name, email address, and a secure password", s))
    story.append(numbered(3, "Check your email for a verification link and confirm your address", s))
    story.append(numbered(4, "Once verified, log in to start the onboarding wizard", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("2.2 Onboarding Wizard", s['SectionTitle']))
    story.append(Paragraph(
        "After your first login, AICount guides you through an 8-step onboarding wizard to set up your workspace:",
        s['Body']
    ))

    steps = [
        ["1. Welcome", "Introduction to AICount and overview of what you will set up"],
        ["2. Workspace", "Enter company name, Thai tax ID (13 digits), industry, and company size"],
        ["3. Chart of Accounts", "Import a standard Thai COA template or create custom accounts"],
        ["4. Partners", "Add your vendors and customers (with tax IDs for WHT and VAT)"],
        ["5. Departments", "Set up department/cost center codes for expense allocation"],
        ["6. Team", "Invite team members and assign Maker/Checker roles"],
        ["7. Template", "Select your preferred export template for accounting software"],
        ["8. Complete", "Review your setup and proceed to the dashboard"],
    ]

    story.append(make_table(
        ["Step", "Description"],
        steps,
        col_widths=[110, 360]
    ))
    story.append(tip_box(
        "You can skip steps during onboarding and complete them later in Settings. However, setting up your Chart of Accounts and Vendors early will significantly improve AI accuracy."
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("2.3 Setting Up Your Workspace", s['SectionTitle']))
    story.append(Paragraph(
        "Your workspace is a tenant environment that isolates your accounting data. Key workspace settings include:",
        s['Body']
    ))
    story.append(bullet("<b>Company Name</b> - Your organization's legal name", s))
    story.append(bullet("<b>Tax ID</b> - 13-digit Thai tax identification number", s))
    story.append(bullet("<b>VAT Registration</b> - Toggle if your company is VAT-registered", s))
    story.append(bullet("<b>Base Currency</b> - Default is THB (Thai Baht)", s))
    story.append(bullet("<b>Industry</b> - Business category (retail, manufacturing, services, etc.)", s))
    story.append(bullet("<b>Company Size</b> - micro, small, medium, or large", s))
    story.append(Spacer(1, 8))

    story.append(Paragraph("2.4 Inviting Team Members", s['SectionTitle']))
    story.append(Paragraph(
        "Navigate to Settings > Workspace > Members to manage your team:",
        s['Body']
    ))
    story.append(numbered(1, "Click <b>Invite Member</b> and enter the team member's email address", s))
    story.append(numbered(2, "Select their role: <b>Maker</b> (data entry) or <b>Checker</b> (approval)", s))
    story.append(numbered(3, "The invitee receives an email with a join link", s))
    story.append(numbered(4, "Once they accept, they appear in your members list", s))
    story.append(Paragraph(
        "You can manage pending invitations, resend emails, or cancel invites from the Invitations tab.",
        s['Body']
    ))

    story.append(PageBreak())
    return story


def build_chapter3(s):
    """Document Upload & OCR."""
    story = []
    story.append(Paragraph("Chapter 3: Document Upload & OCR", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("3.1 Uploading Documents", s['SectionTitle']))
    story.append(Paragraph(
        "AICount accepts documents through drag-and-drop upload or file selection:",
        s['Body']
    ))
    story.append(bullet("<b>Supported formats:</b> PDF, JPEG, PNG, WebP", s))
    story.append(bullet("<b>Maximum file size:</b> 10 MB per file", s))
    story.append(bullet("<b>Batch upload:</b> Multiple files can be uploaded simultaneously", s))
    story.append(bullet("<b>Duplicate detection:</b> SHA-256 file hash prevents duplicate uploads", s))
    story.append(Paragraph(
        "After upload, documents are automatically queued for OCR processing. You can monitor progress "
        "in the upload queue panel, which shows real-time status for each file.",
        s['Body']
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("3.2 How OCR Works: The Three-Tier Pipeline", s['SectionTitle']))
    story.append(Paragraph(
        "AICount uses a sophisticated three-tier AI extraction pipeline that automatically escalates "
        "to more powerful (and more expensive) models when needed. This balances cost efficiency with "
        "accuracy.",
        s['Body']
    ))

    story.append(Paragraph("Tier 1: Fast Text Extraction (Claude Haiku)", s['SubSection']))
    story.append(Paragraph(
        "The first tier uses Claude Haiku 4.5, the fastest and most cost-effective model. It receives "
        "the raw text from Google Vision OCR and extracts structured fields: issuer name, tax ID, "
        "document number, date, amounts, line items, and more. This tier handles ~70% of documents "
        "successfully at a cost of approximately $0.01-0.05 per document.",
        s['Body']
    ))

    story.append(Paragraph("Tier 2: Structured Extraction (Claude Sonnet)", s['SubSection']))
    story.append(Paragraph(
        "If Tier 1 fails validation checks (e.g., amounts don't add up, key fields missing, or "
        "confidence is too low), the system escalates to Claude Sonnet 4.6. This model provides "
        "richer extraction with better understanding of complex document layouts, costing approximately "
        "$0.10-0.20 per document.",
        s['Body']
    ))

    story.append(Paragraph("Tier 3: Vision-Based Extraction (Claude Vision)", s['SubSection']))
    story.append(Paragraph(
        "For the most challenging documents (poor scan quality, unusual layouts, handwritten content), "
        "Tier 3 sends the actual document image to Claude's vision capabilities. This provides the "
        "highest accuracy at approximately $0.20-0.50 per document.",
        s['Body']
    ))

    # Pipeline flow diagram as table
    pipeline_data = [
        ["Step", "Action", "Details"],
        ["1", "File Upload", "Document uploaded to Supabase Storage, SHA-256 hash computed"],
        ["2", "Google Vision OCR", "Raw text extraction from document image"],
        ["3", "Tier 1 (Haiku)", "Fast structured extraction from raw text"],
        ["4", "Validation", "Check: amounts balance, key fields present, confidence > threshold"],
        ["5", "Escalation Check", "If validation fails, escalate to Tier 2"],
        ["6", "Tier 2 (Sonnet)", "Richer extraction with better layout understanding"],
        ["7", "Validation", "Re-check all validation rules"],
        ["8", "Escalation Check", "If still failing, escalate to Tier 3"],
        ["9", "Tier 3 (Vision)", "Image-based extraction for difficult documents"],
        ["10", "Rule Application", "Apply graduated per-tenant and cross-tenant learned rules"],
        ["11", "Classification", "Determine doc type, direction, journal type, VAT mode"],
        ["12", "GL Mapping", "Auto-build journal entries with debit/credit lines"],
        ["13", "Suggestions", "Generate AI suggestions for corrections (eager mode)"],
        ["14", "Persist", "Save all results, update document status, create journal lines"],
    ]

    t = Table(pipeline_data, colWidths=[40, 120, 310])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('TEXTCOLOR', (0, 1), (-1, -1), GRAY_700),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_50]),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_200),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Paragraph("Figure 3.1: The complete document processing pipeline", s['Caption']))
    story.append(Spacer(1, 8))

    story.append(Paragraph("3.3 Supported Document Types", s['SectionTitle']))
    doc_types = [
        ["Receipt", "Tax invoice / receipt for goods or services"],
        ["Invoice", "Bill or invoice from a vendor"],
        ["Purchase Order", "PO document for procurement matching"],
        ["Credit Note", "Adjustment reducing the original amount"],
        ["Debit Note", "Adjustment increasing the original amount"],
        ["Other", "Any document not matching above categories"],
    ]
    story.append(make_table(
        ["Document Type", "Description"],
        doc_types,
        col_widths=[120, 350]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("3.4 Confidence Scoring", s['SectionTitle']))
    story.append(Paragraph(
        "Every extracted document receives a weighted confidence score (0-100%) based on how reliably "
        "each field was extracted. Fields are weighted by importance:",
        s['Body']
    ))

    weights = [
        ["Issuer Tax ID", "3.0x", "Critical for vendor matching and tax compliance"],
        ["VAT Amount", "3.0x", "Must be accurate for VAT returns"],
        ["Grand Total", "2.5x", "Core financial amount"],
        ["Document Type", "2.0x", "Affects journal type routing"],
        ["Document Date", "1.5x", "Affects period allocation"],
        ["Document Number", "1.0x", "Reference identifier"],
        ["Line Items", "1.0x", "Individual item details"],
    ]
    story.append(make_table(
        ["Field", "Weight", "Why It Matters"],
        weights,
        col_widths=[120, 60, 290]
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph(
        "Based on the confidence score, documents are routed differently:",
        s['Body']
    ))
    routing = [
        ["85%+", "Auto-qualifies for approval", "VAT credit eligible, minimal review needed"],
        ["70-84%", "Manual review required", "VAT credit denied until verified"],
        ["Below 70%", "Query status", "Needs re-OCR or manual data entry"],
    ]
    story.append(make_table(
        ["Confidence", "Status", "Action"],
        routing,
        col_widths=[80, 180, 210]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("3.5 Tips to Improve OCR Accuracy", s['SectionTitle']))
    story.append(Paragraph(
        "Follow these best practices to maximize extraction accuracy and minimize processing costs:",
        s['Body']
    ))
    story.append(Spacer(1, 4))

    tips = [
        "<b>Scan Quality:</b> Use 300 DPI or higher. Avoid blurry, skewed, or low-contrast scans.",
        "<b>Lighting:</b> When photographing documents, ensure even lighting without shadows or glare.",
        "<b>Orientation:</b> Upload documents in the correct orientation (not rotated or upside down).",
        "<b>Single Document per File:</b> Each file should contain one document only. Use the split feature if needed.",
        "<b>Avoid Handwriting:</b> Printed documents extract much more reliably. Documents with >20% handwriting trigger manual review.",
        "<b>Clear Tax IDs:</b> Ensure the 13-digit tax ID is legible. This is the most critical field for vendor matching.",
        "<b>Standard Formats:</b> Thai tax invoices following the Revenue Department format extract best.",
        "<b>PDF over Images:</b> Native PDF files (not scanned) provide the best accuracy since text is already digital.",
        "<b>Master Data Setup:</b> Having vendors and COA set up beforehand allows the AI to match and validate against known entities.",
        "<b>Accept/Reject Suggestions:</b> Every time you accept or reject an AI suggestion, the system learns and improves for future documents.",
    ]
    for t in tips:
        story.append(bullet(t, s))

    story.append(Spacer(1, 6))
    story.append(warning_box(
        "Documents with more than 20% handwritten content will automatically be flagged for manual review, as OCR accuracy drops significantly for handwriting."
    ))

    story.append(PageBreak())
    return story


def build_chapter4(s):
    """Extraction & Data Review."""
    story = []
    story.append(Paragraph("Chapter 4: Extraction & Data Review", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("4.1 The Extraction Page", s['SectionTitle']))
    story.append(Paragraph(
        "The Extraction page is the primary workspace for reviewing and editing OCR results. It features "
        "a split-view layout with the document image on one side and editable extracted data on the other.",
        s['Body']
    ))
    story.append(Paragraph("The page is organized into collapsible sections:", s['Body']))
    story.append(bullet("<b>Issuer Information:</b> Company name, tax ID, branch number", s))
    story.append(bullet("<b>Document Metadata:</b> Document type, number, date, direction (Revenue/Expense)", s))
    story.append(bullet("<b>Amounts:</b> Subtotal, VAT amount, discount, grand total, WHT details", s))
    story.append(bullet("<b>Line Items:</b> Table of extracted items with description, quantity, unit price, total", s))
    story.append(bullet("<b>Journal Preview:</b> Auto-generated debit/credit entries", s))
    story.append(bullet("<b>Confidence Bars:</b> Per-field confidence indicators (green/yellow/red)", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("4.2 Editing Extracted Data", s['SectionTitle']))
    story.append(Paragraph(
        "On the Extraction page, the following fields are directly editable:",
        s['Body']
    ))
    story.append(bullet("<b>Document Type</b> (Receipt, Invoice, PO, Credit Note, Debit Note, Other)", s))
    story.append(bullet("<b>Direction</b> (Revenue = Accounts Receivable, Expense = Accounts Payable)", s))
    story.append(Paragraph(
        "Other fields like issuer name, tax ID, amounts, and dates are displayed with their confidence "
        "scores. Fields with low confidence are highlighted for your attention. After making corrections, "
        "click Save to update the document record.",
        s['Body']
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("4.3 Line Item Editor", s['SectionTitle']))
    story.append(Paragraph(
        "The Line Item Editor Modal allows bulk editing of extracted line items. You can:",
        s['Body']
    ))
    story.append(bullet("Add new line items manually", s))
    story.append(bullet("Edit description, quantity, unit price, discount, and total for each line", s))
    story.append(bullet("Delete incorrect line items with inline delete buttons", s))
    story.append(bullet("Amounts are auto-calculated (quantity x unit price - discount = total)", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("4.4 AI Suggestions & Smart Corrections", s['SectionTitle']))
    story.append(Paragraph(
        "AICount provides intelligent suggestions through pill-shaped indicators (Suggestion Pills) "
        "next to fields. These suggestions come from multiple sources:",
        s['Body']
    ))
    suggestions = [
        ["Tenant History", "Highest", "Based on your past entries for the same vendor/tax ID"],
        ["Graduated Rules", "High", "Learned rules that have been validated across multiple documents"],
        ["Cross-Tenant Patterns", "Medium", "Anonymized patterns from other organizations in your industry"],
        ["AI Fallback", "Lower", "Claude AI inference when no historical data is available"],
    ]
    story.append(make_table(
        ["Source", "Priority", "Description"],
        suggestions,
        col_widths=[120, 70, 280]
    ))
    story.append(Paragraph(
        "Click a suggestion pill to accept it, or dismiss to reject. Your interactions (accept/dismiss/edit) "
        "are tracked to improve future suggestions. Suggestions are batch-submitted when you save the form.",
        s['Body']
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("4.5 Duplicate Detection", s['SectionTitle']))
    story.append(Paragraph(
        "AICount detects duplicates in two ways:",
        s['Body']
    ))
    story.append(bullet("<b>File Hash:</b> SHA-256 hash matching catches identical file re-uploads instantly at upload time", s))
    story.append(bullet("<b>Content Matching:</b> AI-based matching identifies documents with similar issuer, amount, date, and document number even if scanned differently", s))
    story.append(Paragraph(
        "When a duplicate is detected, a Duplicate Warning Banner appears with a Compare button that opens "
        "a side-by-side comparison modal showing both documents. You can choose to merge the duplicates or "
        "keep both as separate entries.",
        s['Body']
    ))

    story.append(PageBreak())
    return story


def build_chapter5(s):
    """Journal Entries & Approvals."""
    story = []
    story.append(Paragraph("Chapter 5: Journal Entries & Approvals", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("5.1 Automatic Journal Entry Creation", s['SectionTitle']))
    story.append(Paragraph(
        "When a document is processed through OCR, AICount automatically generates journal entries (JVs) "
        "using a multi-layered mapping strategy:",
        s['Body']
    ))
    story.append(numbered(1, "<b>Vendor GL Defaults:</b> Uses the vendor's default expense/income GL account from master data", s))
    story.append(numbered(2, "<b>Product GL Mapping:</b> Maps line items to GL accounts based on product keywords", s))
    story.append(numbered(3, "<b>Keyword Rules:</b> Applies tenant-specific GL mapping rules based on description keywords", s))
    story.append(numbered(4, "<b>Direction Fallback:</b> If no match, uses direction (Revenue/Expense) to route to suspense accounts", s))
    story.append(Paragraph(
        "Journal entries are auto-numbered with the format JV{YYMM}-{sequence} (e.g., JV2604-0001). "
        "Each entry is validated to ensure debits equal credits before saving.",
        s['Body']
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("5.2 GL Account Mapping", s['SectionTitle']))
    story.append(Paragraph(
        "GL account mapping determines which accounts are debited and credited. The system supports:",
        s['Body']
    ))
    story.append(bullet("<b>Automatic mapping</b> from vendor defaults, product codes, and keyword rules", s))
    story.append(bullet("<b>Manual override</b> on the extraction page", s))
    story.append(bullet("<b>WHT detection</b> automatically creates WHT payable entries when applicable", s))
    story.append(bullet("<b>VAT splitting</b> separates VAT amount into input/output VAT accounts", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("5.3 Document Workflow", s['SectionTitle']))
    story.append(Paragraph(
        "Documents follow a strict workflow with status transitions:",
        s['Body']
    ))

    workflow = [
        ["DRAFT", "Initial state after upload, before OCR completes"],
        ["OCR_PROCESSING", "OCR extraction is in progress"],
        ["QUERY", "Low confidence (<50%) - needs re-OCR or manual input"],
        ["ACTION_REQUIRED", "Needs user attention (PO match, unbalanced, etc.)"],
        ["PENDING_APPROVAL", "Submitted by Maker, awaiting Checker review"],
        ["APPROVED", "Approved by Checker, journal entry posted"],
        ["REJECTED", "Rejected by Checker with a comment"],
        ["EXPORTED", "Exported to external accounting software"],
        ["VOID", "Voided/cancelled document"],
    ]
    story.append(make_table(
        ["Status", "Description"],
        workflow,
        col_widths=[130, 340]
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("5.4 Batch Approval", s['SectionTitle']))
    story.append(Paragraph(
        "Checkers can approve multiple documents at once using the batch approval feature. Select "
        "documents using checkboxes on the Documents page (Pending tab), then click Approve Selected. "
        "Each document is validated individually, and any that fail validation will be flagged.",
        s['Body']
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("5.5 Journal Reversals", s['SectionTitle']))
    story.append(Paragraph(
        "To correct a posted journal entry, use the Reversal feature which creates a mirror entry "
        "that swaps all debits and credits. Navigate to the Reversal page, enter the original document "
        "ID and a reason for reversal. The system generates a new JV with reversed amounts.",
        s['Body']
    ))

    story.append(PageBreak())
    return story


def build_chapter6(s):
    """Thai Tax Compliance."""
    story = []
    story.append(Paragraph("Chapter 6: Thai Tax Compliance", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("6.1 VAT Processing & Rules", s['SectionTitle']))
    story.append(Paragraph(
        "AICount automatically classifies documents for VAT eligibility using multiple criteria:",
        s['Body']
    ))
    story.append(bullet("Document type and proper tax invoice format", s))
    story.append(bullet("Valid 13-digit tax IDs for both buyer and seller", s))
    story.append(bullet("Document date within the 6-month VAT credit reclaim window", s))
    story.append(bullet("Handwriting ratio below 20% threshold", s))
    story.append(bullet("Confidence score above 85% for auto-approval, 70-84% for manual review", s))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "VAT modes include: NORMAL_VAT (standard 7%), VAT_EXEMPT, and ZERO_RATED. The system "
        "determines the correct mode from the document content and applies it to journal entries.",
        s['Body']
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("6.2 WHT Certificates", s['SectionTitle']))
    story.append(Paragraph(
        "Withholding Tax (WHT) certificates are generated automatically based on document data and "
        "vendor classification. AICount routes to the correct form type:",
        s['Body']
    ))

    wht_forms = [
        ["PND3", "Individual residents", "Personal services, rent, prizes"],
        ["PND53", "Companies / juristic persons", "Services, rent, advertising, transport"],
        ["PP36", "Non-resident entities", "Foreign income subject to Thai WHT"],
    ]
    story.append(make_table(
        ["Form", "Vendor Type", "Common Income Types"],
        wht_forms,
        col_widths=[70, 160, 240]
    ))
    story.append(Paragraph(
        "Certificate features include:",
        s['Body']
    ))
    story.append(bullet("Sequential numbering: WHT-YYMM-NNNN format", s))
    story.append(bullet("Snapshotted payer/payee data (editing vendor later doesn't change issued certificates)", s))
    story.append(bullet("PDF generation for filing with the Revenue Department", s))
    story.append(bullet("Void support with reason tracking", s))
    story.append(bullet("Batch generation for multiple documents/vendors at once", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("6.3 Tax Reports", s['SectionTitle']))
    story.append(Paragraph("AICount generates the following Thai tax reports (always monthly):", s['Body']))

    tax_reports = [
        ["PP30 VAT Return", "Monthly VAT return for Revenue Department filing"],
        ["PP36 Non-Resident", "Foreign income withholding tax report"],
        ["PND3 Individual WHT", "WHT summary for payments to individuals"],
        ["PND53 Corporate WHT", "WHT summary for payments to companies"],
        ["Purchase VAT Register", "Detailed purchase transactions with VAT breakdowns (joins vendors)"],
        ["Sales VAT Register", "Detailed sales transactions with VAT breakdowns (joins customers)"],
    ]
    story.append(make_table(
        ["Report", "Description"],
        tax_reports,
        col_widths=[140, 330]
    ))
    story.append(note_box(
        "Tax reports are always monthly. Financial statements (Balance Sheet, P&L, Cash Flow) support monthly, quarterly, and yearly periods."
    ))

    story.append(PageBreak())
    return story


def build_chapter7(s):
    """Financial Reports."""
    story = []
    story.append(Paragraph("Chapter 7: Financial Reports", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "AICount provides a comprehensive suite of financial reports compliant with Thai GAAP. "
        "All reports are generated from posted journal entries only (status = 'posted').",
        s['Body']
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph("7.1 Trial Balance", s['SectionTitle']))
    story.append(Paragraph(
        "Lists all accounts with their debit and credit balances for a given period. "
        "Total debits must equal total credits. Useful for verifying the accuracy of your books.",
        s['Body']
    ))

    story.append(Paragraph("7.2 Profit & Loss Statement", s['SectionTitle']))
    story.append(Paragraph(
        "Shows revenue vs expenses with subtotals by account category, "
        "resulting in net income (or loss) for the period. Supports monthly, quarterly, and yearly views.",
        s['Body']
    ))

    story.append(Paragraph("7.3 Balance Sheet", s['SectionTitle']))
    story.append(Paragraph(
        "Displays Assets, Liabilities, and Equity at a point in time. The equity section includes "
        "retained earnings (cumulative revenue minus expenses) to ensure A = L + E balances correctly.",
        s['Body']
    ))
    story.append(warning_box(
        "Balance Sheet MUST include retained earnings in the equity section, or the equation Assets = Liabilities + Equity will not balance."
    ))

    story.append(Paragraph("7.4 Cash Flow Statement", s['SectionTitle']))
    story.append(Paragraph(
        "Categorizes cash movements into Operating, Investing, and Financing activities. "
        "Uses the cashFlowCategory field from your Chart of Accounts to route transactions to the correct section.",
        s['Body']
    ))

    story.append(Paragraph("7.5 GL Detail & Journal Listing", s['SectionTitle']))
    story.append(Paragraph(
        "GL Detail shows line-by-line transaction history for each GL account with running balances. "
        "Journal Listing shows all journal entries with posting details, useful for audit trail review.",
        s['Body']
    ))

    story.append(Paragraph("7.6 Report History & Versioning", s['SectionTitle']))
    story.append(Paragraph(
        "Generated reports are stored with versioning support. You can:",
        s['Body']
    ))
    story.append(bullet("View previously generated report versions with timestamps", s))
    story.append(bullet("Lock reports to prevent overwriting (useful for audited periods)", s))
    story.append(bullet("Export reports as PDF with professional formatting", s))
    story.append(bullet("Reports are retained per your retention policy (default: 7 years for financial/tax)", s))

    story.append(PageBreak())
    return story


def build_chapter8(s):
    """Bank Reconciliation."""
    story = []
    story.append(Paragraph("Chapter 8: Bank Reconciliation", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("8.1 Setting Up Bank Accounts", s['SectionTitle']))
    story.append(Paragraph(
        "Before reconciliation, configure your bank accounts in Settings > Accounting > Bank Reconciliation:",
        s['Body']
    ))
    story.append(bullet("<b>Bank Name</b> - Name of the financial institution", s))
    story.append(bullet("<b>Account Number</b> - Your bank account number", s))
    story.append(bullet("<b>GL Account Code</b> - The Chart of Accounts code linked to this bank", s))

    story.append(Paragraph("8.2 Uploading Bank Statements", s['SectionTitle']))
    story.append(Paragraph(
        "Upload monthly bank statements which are parsed into individual transactions with date, "
        "description, debit/credit amounts, and reference numbers.",
        s['Body']
    ))

    story.append(Paragraph("8.3 Automatic Matching", s['SectionTitle']))
    story.append(Paragraph(
        "AICount's auto-matching algorithm compares bank transactions against GL entries using:",
        s['Body']
    ))

    matching_rules = [
        ["Amount Match", "Bank amount matches GL amount within tolerance (default: +/- 0.50 THB)"],
        ["Direction Match", "Bank inflow = GL debit, bank outflow = GL credit"],
        ["Date Window", "Transaction dates within configurable range (default: +/- 3 days)"],
        ["Reference Match", "Optional reference number matching for higher confidence"],
    ]
    story.append(make_table(
        ["Rule", "Description"],
        matching_rules,
        col_widths=[120, 350]
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph("Confidence scoring for matches:", s['BodyBold']))
    confidence = [
        ["Same day", "100%"],
        ["+/- 1 day", "90%"],
        ["+/- 2 days", "80%"],
        ["+/- 3 days", "70%"],
    ]
    story.append(make_table(
        ["Date Proximity", "Confidence"],
        confidence,
        col_widths=[200, 270]
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("8.4 Manual Matching", s['SectionTitle']))
    story.append(Paragraph(
        "The reconciliation page shows a split view: bank transactions on the left, unmatched GL entries "
        "on the right. Select a bank transaction, then click a GL entry to create a manual match. "
        "Use 'Confirm All' to accept all high-confidence auto-matches at once. Matches can be reversed "
        "using the Unmatch button.",
        s['Body']
    ))

    story.append(Paragraph("8.5 Reconciliation Settings", s['SectionTitle']))
    story.append(Paragraph("Configure matching behavior per tenant:", s['Body']))
    settings = [
        ["Amount Tolerance", "0.50 THB", "Maximum difference allowed between bank and GL amounts"],
        ["Date Range", "3 days", "Maximum date gap between bank transaction and GL entry"],
        ["Auto Match", "On", "Enable/disable automatic matching on statement upload"],
        ["Match by Reference", "On", "Use reference numbers for improved matching accuracy"],
    ]
    story.append(make_table(
        ["Setting", "Default", "Description"],
        settings,
        col_widths=[120, 80, 270]
    ))

    story.append(PageBreak())
    return story


def build_chapter9(s):
    """Accounts Receivable & Payable."""
    story = []
    story.append(Paragraph("Chapter 9: Accounts Receivable & Payable", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("9.1 Receivables (AR)", s['SectionTitle']))
    story.append(Paragraph(
        "The Receivables page tracks customer invoices and payments with aging analysis. It shows:",
        s['Body']
    ))
    story.append(bullet("Customer aging summary with Current, 30-day, 60-day, 90-day, and Overdue buckets", s))
    story.append(bullet("Invoice-level detail: number, date, due date, amount, paid, remaining, status", s))
    story.append(bullet("Aging mini-bar visualization per customer", s))
    story.append(bullet("Summary cards: Total Outstanding, Overdue Amount, Collection metrics", s))
    story.append(bullet("Filter by status: Open, Overdue, Partial, Paid", s))
    story.append(bullet("Export to CSV for external analysis", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("9.2 Payables (AP)", s['SectionTitle']))
    story.append(Paragraph(
        "The Payables page mirrors Receivables for vendor invoices with additional WHT tracking:",
        s['Body']
    ))
    story.append(bullet("Vendor aging summary with bucket breakdown", s))
    story.append(bullet("WHT rate application per vendor", s))
    story.append(bullet("Summary cards: Total Payables, Due This Week, Paid This Month", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("9.3 Payment Recording", s['SectionTitle']))
    story.append(Paragraph(
        "Record payments against invoices using the Record Payment modal:",
        s['Body']
    ))
    story.append(numbered(1, "Select the document/invoice to pay", s))
    story.append(numbered(2, "Enter payment amount, date, method, and reference number", s))
    story.append(numbered(3, "For AP: optionally apply WHT deduction (auto-calculated from vendor defaults)", s))
    story.append(numbered(4, "System creates payment record and updates invoice status", s))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Payment status logic:", s['BodyBold']))
    status_logic = [
        ["Open", "No payments recorded yet"],
        ["Partial", "Some payment made, but balance remaining"],
        ["Paid", "Payment sum >= grand total"],
        ["Overdue", "Past due date with outstanding balance"],
    ]
    story.append(make_table(
        ["Status", "Condition"],
        status_logic,
        col_widths=[100, 370]
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("9.4 Aging Analysis", s['SectionTitle']))
    story.append(Paragraph(
        "Aging buckets are computed from document due dates and payment status. The aging summary "
        "helps prioritize collections (AR) and payment scheduling (AP). Aging mini-bars provide a "
        "visual snapshot of each customer/vendor's balance distribution across time buckets.",
        s['Body']
    ))

    story.append(PageBreak())
    return story


def build_chapter10(s):
    """Master Data Management."""
    story = []
    story.append(Paragraph("Chapter 10: Master Data Management", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "Master data forms the foundation for accurate extraction and automated GL mapping. "
        "All master data is tenant-scoped and managed via Settings > Master Data.",
        s['Body']
    ))

    story.append(Paragraph("10.1 Chart of Accounts", s['SectionTitle']))
    story.append(Paragraph("Each account includes:", s['Body']))
    story.append(bullet("<b>Account Code</b> - Up to 20 characters, unique per tenant", s))
    story.append(bullet("<b>Account Name</b> - Descriptive name", s))
    story.append(bullet("<b>Category</b> - Asset, Liability, Equity, Revenue, or Expense", s))
    story.append(bullet("<b>Cash Flow Category</b> - Operating, Investing, or Financing (for Cash Flow report)", s))
    story.append(bullet("<b>Is Suspense</b> - Flag for catch-all accounts", s))

    story.append(Paragraph("10.2 Vendors", s['SectionTitle']))
    story.append(bullet("<b>Tax ID</b> - 13-digit Thai tax ID (unique per tenant)", s))
    story.append(bullet("<b>Vendor Type</b> - Company or Individual (affects WHT form routing)", s))
    story.append(bullet("<b>Is Non-Resident</b> - Flag for foreign vendors (routes to PP36 form)", s))
    story.append(bullet("<b>Branch Number</b> - For multi-branch vendors (Head Office = 00000)", s))
    story.append(bullet("<b>Default Expense GL</b> - Auto-mapped for journal entries", s))
    story.append(bullet("<b>Default WHT Rate</b> - Pre-set WHT rate (default 3%)", s))

    story.append(Paragraph("10.3 Customers", s['SectionTitle']))
    story.append(bullet("<b>Tax ID, Name, Address</b> - Basic customer information", s))
    story.append(bullet("<b>Credit Term Days</b> - Default payment terms (default 30 days)", s))
    story.append(bullet("<b>Branch Number</b> - For multi-branch customers", s))

    story.append(Paragraph("10.4 Departments & Products", s['SectionTitle']))
    story.append(Paragraph(
        "<b>Departments</b> have a code and name, used for cost center allocation in journal entries.",
        s['Body']
    ))
    story.append(Paragraph(
        "<b>Products</b> include item code, name, keywords (for line item matching), and GL mappings "
        "for both income and expense accounts.",
        s['Body']
    ))

    story.append(Paragraph("10.5 Bulk Import", s['SectionTitle']))
    story.append(Paragraph(
        "All master data types support bulk import via CSV or Excel files using the FileImport component:",
        s['Body']
    ))
    story.append(numbered(1, "Click <b>Import</b> on the master data page", s))
    story.append(numbered(2, "Drag-and-drop or select your CSV/Excel file", s))
    story.append(numbered(3, "Map columns from your file to AICount fields", s))
    story.append(numbered(4, "Review the preview with validation results", s))
    story.append(numbered(5, "Confirm to import - duplicates are highlighted and handled (upsert)", s))
    story.append(tip_box(
        "Multi-file import is supported - you can accumulate data from multiple files before confirming the final import."
    ))

    story.append(PageBreak())
    return story


def build_chapter11(s):
    """Settings & Configuration."""
    story = []
    story.append(Paragraph("Chapter 11: Settings & Configuration", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("11.1 Profile & Security", s['SectionTitle']))
    story.append(bullet("<b>Profile:</b> Update name, email, avatar, and password", s))
    story.append(bullet("<b>Security:</b> Two-factor authentication, login history, active sessions, API keys", s))
    story.append(bullet("<b>Account Deletion:</b> Permanent deletion with 30-day grace period for recovery", s))

    story.append(Paragraph("11.2 Workspace Settings", s['SectionTitle']))
    story.append(bullet("<b>General:</b> Company name, tax ID, VAT status, currency, industry, size, retention policy", s))
    story.append(bullet("<b>Members:</b> Team member list, role assignment, removal", s))
    story.append(bullet("<b>Invitations:</b> Pending invites, resend, cancel", s))
    story.append(bullet("<b>Delete Workspace:</b> Soft delete with 30-day recovery, permanent deletion option", s))

    story.append(Paragraph("11.3 Accounting Settings", s['SectionTitle']))
    story.append(bullet("<b>AI Usage:</b> Monthly AI API cost tracking, per-document analysis, budget monitoring", s))
    story.append(bullet("<b>Bank Reconciliation:</b> Bank account management, statement upload config, matching rules", s))
    story.append(bullet("<b>Period Locks:</b> Lock/unlock accounting periods to prevent changes", s))
    story.append(bullet("<b>Report Retention:</b> Configure retention periods per report category", s))
    story.append(bullet("<b>Tax Reports:</b> Default WHT rates, tax filing calendar, compliance checklist", s))
    story.append(bullet("<b>Templates:</b> Custom document type definitions and field mappings", s))

    story.append(Paragraph("11.4 Period Locks", s['SectionTitle']))
    story.append(Paragraph(
        "Lock accounting periods to prevent modifications to posted entries. Locked periods show "
        "the lock date, the user who locked it, and require admin confirmation to unlock.",
        s['Body']
    ))

    story.append(Paragraph("11.5 Report Retention Policies", s['SectionTitle']))
    retention = [
        ["Draft Reports", "30 days", "Automatically cleaned up"],
        ["Financial Reports", "7 years", "Trial Balance, P&L, Balance Sheet, Cash Flow"],
        ["Tax Reports", "7 years", "VAT returns, WHT summaries"],
        ["WHT Certificates", "7 years", "Individual certificate records"],
        ["Management Reports", "2 years", "Dashboard snapshots, analytics"],
        ["Trash Recovery", "7 days", "Grace period for soft-deleted items"],
    ]
    story.append(make_table(
        ["Category", "Default Retention", "Includes"],
        retention,
        col_widths=[120, 100, 250]
    ))

    story.append(Paragraph("11.6 Export Templates", s['SectionTitle']))
    story.append(Paragraph(
        "Custom export templates define column mappings for exporting to external accounting software. "
        "Each template specifies column position, header name, source field, format, and default values. "
        "Templates can be activated/deactivated and are stored as JSONB column mappings.",
        s['Body']
    ))

    story.append(PageBreak())
    return story


def build_chapter12(s):
    """Export & Integration."""
    story = []
    story.append(Paragraph("Chapter 12: Export & Integration", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("12.1 Exporting to Accounting Software", s['SectionTitle']))
    story.append(Paragraph(
        "AICount supports exporting approved documents to external accounting packages:",
        s['Body']
    ))
    story.append(bullet("<b>Express:</b> Thai accounting software (primary integration)", s))
    story.append(bullet("<b>QuickBooks:</b> International accounting software", s))
    story.append(bullet("<b>Excel/CSV:</b> Universal format for any software", s))
    story.append(Paragraph(
        "The export engine builds structured files with journal headers, journal lines (GL account, "
        "debit, credit, description), and optional line item detail. Templates are matched by strength:",
        s['Body']
    ))
    story.append(bullet("<b>Strong:</b> Exact template match with high confidence", s))
    story.append(bullet("<b>Suitable:</b> Good match that may need minor adjustments", s))
    story.append(bullet("<b>Manual:</b> Requires manual template selection", s))

    story.append(Paragraph("12.2 Custom Export Templates", s['SectionTitle']))
    story.append(Paragraph(
        "Create custom export templates to match your specific accounting software requirements. "
        "Each template defines column mappings including position, header name, source field, "
        "format rules, and default values.",
        s['Body']
    ))

    story.append(Paragraph("12.3 PDF Report Generation", s['SectionTitle']))
    story.append(Paragraph(
        "All financial and tax reports can be exported as professionally formatted PDF documents "
        "using server-side rendering with Thai font support (Noto Sans Thai). PDFs are stored in "
        "Supabase Storage with signed URLs (1-hour expiry) for secure downloading.",
        s['Body']
    ))

    story.append(PageBreak())
    return story


def build_chapter13(s):
    """AI Learning & Intelligence."""
    story = []
    story.append(Paragraph("Chapter 13: AI Learning & Intelligence", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("13.1 How AI Learning Works", s['SectionTitle']))
    story.append(Paragraph(
        "AICount's AI system continuously learns from user interactions to improve accuracy over time. "
        "Every time you accept, dismiss, or edit a suggestion, the system records this feedback and "
        "uses it to refine future predictions. The learning operates at two levels:",
        s['Body']
    ))
    story.append(bullet("<b>Per-Tenant Learning:</b> Rules specific to your organization's patterns", s))
    story.append(bullet("<b>Cross-Tenant Learning:</b> Anonymized patterns shared across organizations", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("13.2 Per-Tenant Rule Graduation", s['SectionTitle']))
    story.append(Paragraph(
        "When the AI extracts a document and the user corrects a field, the system creates an "
        "extraction rule. As more documents confirm the same rule, it 'graduates' to higher confidence:",
        s['Body']
    ))
    story.append(numbered(1, "Initial rule created with confidence 0.50 from first correction", s))
    story.append(numbered(2, "Each confirming document increases sampleCount and confidence", s))
    story.append(numbered(3, "When confidence exceeds graduation threshold, the rule is marked as 'graduated'", s))
    story.append(numbered(4, "Graduated rules are applied automatically during extraction (before AI is called)", s))
    story.append(Paragraph(
        "Rules are stored in the aiExtractionRules table with triggerKey (e.g., vendor tax ID), "
        "fieldName (e.g., 'glAccountCode'), and deterministicValue (the learned mapping).",
        s['Body']
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("13.3 Cross-Tenant Pattern Learning", s['SectionTitle']))
    story.append(Paragraph(
        "Phase 6D introduces cross-tenant learning that aggregates patterns across all organizations "
        "while maintaining strict privacy:",
        s['Body']
    ))
    story.append(bullet("<b>Pattern Aggregation:</b> When multiple tenants make the same mapping for a trigger (e.g., same vendor tax ID prefix -> same GL category), a cross-tenant pattern is created", s))
    story.append(bullet("<b>Agreement Ratio:</b> Tracks what percentage of tenants agree on the mapping", s))
    story.append(bullet("<b>Adaptive Thresholds:</b> As the platform grows, minimum tenant count and agreement ratio requirements tighten to prevent premature generalizations", s))
    story.append(bullet("<b>Industry Filtering:</b> Patterns can be weighted by tenant industry and company size for more relevant suggestions", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("13.4 Suggestion Providers & Priority", s['SectionTitle']))
    story.append(Paragraph(
        "Suggestions are generated by multiple providers, processed by the Suggestion Coordinator, "
        "and presented to users in priority order:",
        s['Body']
    ))

    providers = [
        ["1 (Highest)", "Tenant History", "Based on your past entries for the same vendor/tax ID"],
        ["2", "Graduated Rules", "Validated rules from multiple confirmed documents"],
        ["3", "Cross-Tenant Patterns", "Anonymized patterns from other organizations"],
        ["4 (Lowest)", "AI Fallback", "Claude AI inference when no historical data exists"],
    ]
    story.append(make_table(
        ["Priority", "Provider", "Description"],
        providers,
        col_widths=[80, 120, 270]
    ))
    story.append(Paragraph(
        "Providers run in two modes: <b>Eager</b> (fast, during extraction - covers COA, WHT, defaults) "
        "and <b>Lazy</b> (comprehensive, when user opens the page - covers full COA, duplicates, AI calls).",
        s['Body']
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("13.5 Privacy & Data Anonymization", s['SectionTitle']))
    story.append(Paragraph(
        "Cross-tenant learning uses strict privacy measures:",
        s['Body']
    ))
    story.append(bullet("Tenant IDs are SHA-256 hashed (first 8 characters only) - no reverse lookup possible", s))
    story.append(bullet("Only tax ID prefixes are used as trigger keys - no full PII in pattern data", s))
    story.append(bullet("Pattern data contains only statistical aggregates (counts, ratios), never raw document data", s))
    story.append(bullet("Cross-tenant suggestions use source: 'cross_tenant' with no UI distinction from other sources", s))
    story.append(bullet("Tenants can opt out by disabling suggestionsEnabled in workspace settings", s))

    story.append(PageBreak())
    return story


def build_chapter14(s):
    """Data Processing Pipeline."""
    story = []
    story.append(Paragraph("Chapter 14: Data Processing Pipeline", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("14.1 End-to-End Document Flow", s['SectionTitle']))
    story.append(Paragraph(
        "This is the complete journey of a document through the AICount system:",
        s['Body']
    ))

    flow_steps = [
        ["Upload", "User uploads file via drag-and-drop or file selector"],
        ["Validation", "File type (PDF/JPEG/PNG/WebP), size (128B-10MB), SHA-256 hash for dedup"],
        ["Storage", "File persisted to Supabase Storage: {tenantId}/{date}/{batchId}/{filename}"],
        ["DB Record", "Document record created with status DRAFT, extractionStatus: pending"],
        ["Event Trigger", "Inngest event 'document/uploaded' fires the background job"],
        ["OCR", "Google Vision API extracts raw text from the document image"],
        ["Tier 1", "Claude Haiku performs fast structured extraction from raw text"],
        ["Validation", "Amount equations checked (subtotal + VAT = total, line items sum)"],
        ["Escalation", "If validation fails, escalate to Tier 2 (Sonnet) or Tier 3 (Vision)"],
        ["Rules", "Apply per-tenant graduated rules and cross-tenant patterns"],
        ["Classification", "Determine document type, direction, journal type, VAT mode"],
        ["GL Mapping", "Auto-build journal entries with debit/credit lines using mapping rules"],
        ["Suggestions", "Generate eager suggestions (COA, WHT, defaults) non-blocking"],
        ["Persist", "Update document with all extracted fields, confidence, journal lines"],
        ["Status Update", "QUERY (<50% confidence), ACTION_REQUIRED, or PENDING_APPROVAL"],
        ["User Review", "Maker reviews, edits, accepts/rejects suggestions, saves"],
        ["Submit", "Maker submits for approval"],
        ["Approval", "Checker approves or rejects with comments"],
        ["Journal Post", "Approved documents get posted journal entries"],
        ["Export", "Export to accounting software (Express, QuickBooks, Excel)"],
    ]
    story.append(make_table(
        ["Stage", "Description"],
        flow_steps,
        col_widths=[100, 370]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("14.2 Background Job Architecture", s['SectionTitle']))
    story.append(Paragraph(
        "AICount uses Inngest for event-driven background processing. Key background jobs:",
        s['Body']
    ))

    jobs = [
        ["process-document", "document/uploaded", "Full extraction pipeline (OCR -> Tier 1/2/3 -> classify -> map -> persist)"],
        ["wht-batch-generate", "wht/batch-generate", "Sequential WHT certificate generation for multiple documents"],
        ["send-notifications", "Various triggers", "Email and in-app notifications (rejection, pending, digest)"],
        ["update-cross-tenant", "pattern/outcome", "Updates cross-tenant patterns from user feedback"],
        ["data-retention", "Scheduled (cron)", "Expires old AI usage logs, cleans soft-deleted data"],
        ["report-cleanup", "Scheduled (cron)", "Soft-deletes expired report history per retention policy"],
        ["account-purge", "Scheduled (cron)", "Hard-deletes accounts after 30-day grace period"],
        ["workspace-purge", "Scheduled (cron)", "Cascade-deletes tenant data after 30-day grace period"],
    ]
    story.append(make_table(
        ["Job", "Trigger", "Description"],
        jobs,
        col_widths=[110, 100, 260]
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("14.3 Extraction Validation", s['SectionTitle']))
    story.append(Paragraph("Each extraction tier validates:", s['Body']))
    story.append(bullet("<b>Amount Equation:</b> subtotal + VAT = grandTotal (within rounding tolerance)", s))
    story.append(bullet("<b>Line Item Totals:</b> Sum of line items = subtotal", s))
    story.append(bullet("<b>Required Fields:</b> issuerName, documentDate, grandTotal present", s))
    story.append(bullet("<b>Field Formats:</b> Tax ID is 13 digits, date formats (Thai/Western)", s))
    story.append(bullet("<b>Confidence Check:</b> Per-field confidence above minimum threshold", s))

    story.append(Paragraph("14.4 Error Handling & Retry", s['SectionTitle']))
    story.append(Paragraph(
        "If extraction fails at any tier, the system handles errors gracefully:",
        s['Body']
    ))
    story.append(bullet("Failed extractions set extractionStatus to 'failed' with reason logged", s))
    story.append(bullet("Documents move to QUERY status for manual intervention", s))
    story.append(bullet("Users can trigger Re-OCR to retry the full pipeline", s))
    story.append(bullet("API call failures are logged in aiUsageLogs for cost tracking even on failure", s))

    story.append(PageBreak())
    return story


def build_chapter15(s):
    """Backoffice Administration."""
    story = []
    story.append(Paragraph("Chapter 15: Backoffice Administration", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "The Backoffice is a superadmin-only area for managing the entire AICount platform. "
        "Access requires the isSuperadmin flag on the user profile.",
        s['Body']
    ))

    story.append(Paragraph("15.1 Platform Overview Dashboard", s['SectionTitle']))
    story.append(Paragraph(
        "The Overview page provides platform-wide metrics with a month selector for historical analysis:",
        s['Body']
    ))
    story.append(bullet("<b>Total AI Spend:</b> Platform-wide AI API costs for the selected month", s))
    story.append(bullet("<b>Cost Breakdown by Tier:</b> Spending split across Tier 1 (Haiku), Tier 2 (Sonnet), Tier 3 (Vision)", s))
    story.append(bullet("<b>Daily Cost Chart:</b> Time-series visualization of daily AI spend", s))
    story.append(bullet("<b>Tier Distribution:</b> Pie chart showing usage distribution across tiers", s))
    story.append(bullet("<b>Pattern Statistics:</b> Total patterns, active patterns, coverage percentage", s))
    story.append(bullet("<b>Vendor WHT Suggestion Stats:</b> Pill indicators showing pattern hit rates", s))
    story.append(Spacer(1, 6))

    story.append(Paragraph("15.2 Tenant Management", s['SectionTitle']))
    story.append(Paragraph(
        "The Tenants page shows all registered organizations with searchable, paginated list. "
        "Per-tenant metrics include:",
        s['Body']
    ))
    tenant_metrics = [
        ["Document Count", "Total documents processed this month"],
        ["Total Cost", "AI API cost in USD for the month"],
        ["Avg Cost/Doc", "Average AI cost per document"],
        ["Budget Usage", "Percentage of monthly budget consumed"],
        ["Status", "Active, pending deletion, or suspended"],
    ]
    story.append(make_table(
        ["Metric", "Description"],
        tenant_metrics,
        col_widths=[120, 350]
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("15.3 Pattern Explorer", s['SectionTitle']))
    story.append(Paragraph(
        "The Patterns page at /backoffice/patterns allows superadmins to browse and manage "
        "cross-tenant patterns. Each pattern shows its type, trigger key, field name, suggested value, "
        "tenant count, agreement ratio, and confidence score. Patterns can be enabled or disabled.",
        s['Body']
    ))

    story.append(Paragraph("15.4 Business Rules Engine", s['SectionTitle']))
    story.append(Paragraph(
        "The Rules page provides a CRUD interface for managing business rules that affect document "
        "processing, classification, and routing. Rules can be created, edited, deleted, and reordered "
        "by execution priority. Each rule has conditions that trigger specific actions.",
        s['Body']
    ))

    story.append(Paragraph("15.5 Platform Analytics", s['SectionTitle']))
    story.append(Paragraph(
        "Comprehensive analytics accessible via API endpoints:",
        s['Body']
    ))
    story.append(bullet("<b>/api/backoffice/analytics</b> - Overall platform metrics", s))
    story.append(bullet("<b>/api/backoffice/analytics/patterns</b> - Pattern performance statistics", s))
    story.append(bullet("<b>/api/backoffice/analytics/tenants</b> - Per-tenant usage and cost breakdown", s))

    story.append(PageBreak())
    return story


def build_chapter16(s):
    """Cost Breakdown & Pricing."""
    story = []
    story.append(Paragraph("Chapter 16: Cost Breakdown & Pricing", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("16.1 AI Model Pricing Tiers", s['SectionTitle']))
    story.append(Paragraph(
        "AICount uses Anthropic Claude models for document extraction. Pricing is based on token usage:",
        s['Body']
    ))

    pricing = [
        ["Claude Haiku 4.5", "Tier 1", "$0.80 / 1M tokens", "$4.00 / 1M tokens", "Fast extraction"],
        ["Claude Sonnet 4.6", "Tier 2", "$3.00 / 1M tokens", "$15.00 / 1M tokens", "Rich extraction"],
        ["Claude Vision", "Tier 3", "$3.00-15.00 / 1M", "$15.00+ / 1M", "Image analysis"],
    ]
    story.append(make_table(
        ["Model", "Tier", "Input Cost", "Output Cost", "Use Case"],
        pricing,
        col_widths=[100, 45, 95, 95, 135]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("16.2 Per-Document Cost Estimates", s['SectionTitle']))
    story.append(Paragraph(
        "Average cost per document depends on which tier(s) are needed:",
        s['Body']
    ))

    doc_costs = [
        ["Simple receipt (Tier 1 only)", "$0.01 - $0.05", "~70% of documents"],
        ["Standard invoice (Tier 1 + 2)", "$0.10 - $0.20", "~20% of documents"],
        ["Complex/poor quality (Tier 1 + 2 + 3)", "$0.20 - $0.50", "~10% of documents"],
        ["Average blended cost", "$0.05 - $0.15", "Across all documents"],
    ]
    story.append(make_table(
        ["Document Complexity", "Estimated Cost", "Frequency"],
        doc_costs,
        col_widths=[185, 120, 165]
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Additional costs include Google Cloud Vision OCR (for raw text extraction) which is billed "
        "separately at Google's published rates (approximately $1.50 per 1,000 pages).",
        s['Body']
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("16.3 Budget Management", s['SectionTitle']))
    story.append(Paragraph(
        "Each tenant can configure monthly AI spending limits:",
        s['Body']
    ))
    story.append(bullet("<b>Monthly Budget (USD):</b> Maximum allowed AI spend per month", s))
    story.append(bullet("<b>Alert Threshold:</b> Percentage at which budget warnings trigger (default: 80%)", s))
    story.append(bullet("When threshold is exceeded, administrators receive notifications", s))
    story.append(bullet("All API calls are logged with exact token counts and costs for transparency", s))
    story.append(Spacer(1, 8))

    story.append(Paragraph("16.4 Usage Analytics", s['SectionTitle']))
    story.append(Paragraph(
        "Track AI usage in Settings > Accounting > AI Usage, which shows:",
        s['Body']
    ))
    story.append(bullet("Monthly cost trends over time", s))
    story.append(bullet("Cost per document analysis", s))
    story.append(bullet("Tier distribution (how often each tier is used)", s))
    story.append(bullet("Budget consumption percentage", s))
    story.append(Spacer(1, 8))

    story.append(Paragraph("16.5 Cost Optimization Tips", s['SectionTitle']))
    tips = [
        "<b>Improve scan quality:</b> Better scans mean more Tier 1 success, avoiding expensive escalation.",
        "<b>Set up master data:</b> Vendors with default GL accounts reduce AI processing needs.",
        "<b>Accept/reject suggestions:</b> Graduated rules bypass AI entirely, reducing costs to zero for learned patterns.",
        "<b>Use standard formats:</b> Thai tax invoices following Revenue Department format extract most reliably at Tier 1.",
        "<b>Review monthly analytics:</b> Identify document types that consistently escalate and address root causes.",
        "<b>Upload PDFs when possible:</b> Native PDFs (not scanned) often need only Tier 1 extraction.",
    ]
    for t in tips:
        story.append(bullet(t, s))

    story.append(PageBreak())
    return story


def build_chapter17(s):
    """Security & Compliance."""
    story = []
    story.append(Paragraph("Chapter 17: Security & Compliance", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 8))

    story.append(Paragraph("17.1 Multi-Tenant Data Isolation", s['SectionTitle']))
    story.append(Paragraph(
        "Every data table is scoped by tenantId, ensuring complete isolation between organizations. "
        "API routes enforce tenant scope validation - cross-tenant access attempts return 403 Forbidden. "
        "Even superadmins access tenant data through scoped queries, never direct database access.",
        s['Body']
    ))

    story.append(Paragraph("17.2 Authentication & Authorization", s['SectionTitle']))
    story.append(Paragraph(
        "AICount uses Supabase SSR authentication with cookie-based sessions. Key security features:",
        s['Body']
    ))
    story.append(bullet("Email verification required for new accounts", s))
    story.append(bullet("Role-based access control (Admin/Maker/Checker)", s))
    story.append(bullet("Proxy-based middleware validates every request", s))
    story.append(bullet("Rate limiting on all API endpoints", s))
    story.append(bullet("User role resolved from tenant_assignments table (not user metadata)", s))
    story.append(bullet("All client-side API calls include x-tenant-id header for scope validation", s))

    story.append(Paragraph("17.3 PDPA Compliance", s['SectionTitle']))
    story.append(Paragraph(
        "AICount complies with Thailand's Personal Data Protection Act (PDPA):",
        s['Body']
    ))
    story.append(bullet("<b>Right to Deletion:</b> Users can request account deletion via Settings > Delete Account", s))
    story.append(bullet("<b>30-Day Grace Period:</b> Deleted accounts/workspaces enter a recovery period before permanent deletion", s))
    story.append(bullet("<b>Data Export:</b> Users can export their data before deletion", s))
    story.append(bullet("<b>PDPA Delete Request API:</b> Dedicated endpoint for formal PDPA data deletion requests", s))
    story.append(bullet("<b>Cascade Deletion:</b> Workspace deletion removes all tenant-scoped data after grace period", s))

    story.append(Paragraph("17.4 Audit Trail", s['SectionTitle']))
    story.append(Paragraph(
        "Every significant action is recorded in the auditLogs table with:",
        s['Body']
    ))
    story.append(bullet("Tenant ID, User ID, and IP address", s))
    story.append(bullet("Action type (e.g., document.approved, coa.updated)", s))
    story.append(bullet("Entity type and entity ID for traceability", s))
    story.append(bullet("Metadata (JSONB) for additional context", s))
    story.append(bullet("Timestamp for chronological ordering", s))

    story.append(Paragraph("17.5 Data Retention", s['SectionTitle']))
    story.append(Paragraph(
        "Configurable data retention policies ensure compliance while managing storage:",
        s['Body']
    ))
    retention_final = [
        ["Financial Reports", "7 years", "Thai accounting law requirement"],
        ["Tax Reports", "7 years", "Revenue Department requirement"],
        ["WHT Certificates", "7 years", "Tax documentation requirement"],
        ["Management Reports", "2 years", "Operational analytics"],
        ["Draft Reports", "30 days", "Automatic cleanup"],
        ["AI Usage Logs", "Configurable", "Expired periodically by scheduled job"],
        ["Deleted Accounts", "30 days grace", "Then hard-deleted by background job"],
        ["Deleted Workspaces", "30 days grace", "Then cascade-deleted by background job"],
    ]
    story.append(make_table(
        ["Data Type", "Retention", "Reason"],
        retention_final,
        col_widths=[130, 100, 240]
    ))

    # Final page
    story.append(PageBreak())
    story.append(Spacer(1, 100))
    story.append(Paragraph("End of User Manual", s['ChapterTitle']))
    story.append(SectionDivider(PRIMARY))
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "Thank you for using AICount. For questions, feature requests, or technical support, "
        "please contact your system administrator or visit the AICount help center.",
        s['Body']
    ))
    story.append(Spacer(1, 12))
    story.append(Paragraph("AICount v1.1.0 | April 2026", s['Caption']))
    story.append(Paragraph("Built with Next.js, React, Supabase, and Anthropic Claude AI", s['Caption']))

    return story


# ── Main ──────────────────────────────────────────────────────────

def build_manual():
    output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "AICount-User-Manual.pdf")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=55,
        bottomMargin=55,
        leftMargin=50,
        rightMargin=50,
        title="AICount User Manual",
        author="AICount",
        subject="Comprehensive User Manual for AICount Thai Accounting SaaS",
    )

    s = get_styles()
    story = []

    # Cover page (uses onFirstPage)
    story.append(Spacer(1, 700))  # Push past cover
    story.append(PageBreak())

    # Table of Contents
    story.extend(build_toc(s))

    # Chapters
    story.extend(build_chapter1(s))
    story.extend(build_chapter2(s))
    story.extend(build_chapter3(s))
    story.extend(build_chapter4(s))
    story.extend(build_chapter5(s))
    story.extend(build_chapter6(s))
    story.extend(build_chapter7(s))
    story.extend(build_chapter8(s))
    story.extend(build_chapter9(s))
    story.extend(build_chapter10(s))
    story.extend(build_chapter11(s))
    story.extend(build_chapter12(s))
    story.extend(build_chapter13(s))
    story.extend(build_chapter14(s))
    story.extend(build_chapter15(s))
    story.extend(build_chapter16(s))
    story.extend(build_chapter17(s))

    doc.build(story, onFirstPage=cover_page, onLaterPages=header_footer)
    print(f"PDF generated: {output_path}")
    print(f"File size: {os.path.getsize(output_path) / 1024:.1f} KB")
    return output_path


if __name__ == "__main__":
    build_manual()
