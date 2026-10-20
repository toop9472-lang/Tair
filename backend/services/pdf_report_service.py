"""
PDF Report Service - Generate financial and analytics reports
"""
import io
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
import os


class PDFReportService:
    """Generate PDF reports for Saqr platform"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_styles()
    
    def _setup_styles(self):
        """Setup custom styles for Arabic text"""
        # Title style
        self.styles.add(ParagraphStyle(
            name='TitleAR',
            fontSize=24,
            alignment=TA_CENTER,
            spaceAfter=30,
            fontName='Helvetica-Bold'
        ))
        
        # Header style
        self.styles.add(ParagraphStyle(
            name='HeaderAR',
            fontSize=16,
            alignment=TA_RIGHT,
            spaceAfter=12,
            fontName='Helvetica-Bold'
        ))
        
        # Normal Arabic text
        self.styles.add(ParagraphStyle(
            name='NormalAR',
            fontSize=12,
            alignment=TA_RIGHT,
            spaceAfter=6,
            fontName='Helvetica'
        ))
    
    async def generate_financial_report(
        self,
        start_date: datetime,
        end_date: datetime,
        stats: Dict[str, Any],
        withdrawals: List[Dict],
        ads_revenue: List[Dict]
    ) -> bytes:
        """
        Generate financial report PDF
        
        Args:
            start_date: Report start date
            end_date: Report end date
            stats: Dashboard statistics
            withdrawals: List of withdrawals in period
            ads_revenue: List of ad payments in period
        
        Returns:
            PDF bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1*cm,
            leftMargin=1*cm,
            topMargin=1*cm,
            bottomMargin=1*cm
        )
        
        elements = []
        
        # Title
        elements.append(Paragraph(
            f"Saqr Financial Report",
            self.styles['TitleAR']
        ))
        
        # Date range
        elements.append(Paragraph(
            f"Period: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
            self.styles['NormalAR']
        ))
        elements.append(Paragraph(
            f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            self.styles['NormalAR']
        ))
        elements.append(Spacer(1, 20))
        
        # Summary Section
        elements.append(Paragraph("Financial Summary", self.styles['HeaderAR']))
        
        summary_data = [
            ["Metric", "Value"],
            ["Total Revenue (SAR)", f"{stats.get('total_revenue', 0):,.2f}"],
            ["Total Payouts (USD)", f"{stats.get('total_payouts', 0):,.2f}"],
            ["Net Profit (SAR)", f"{stats.get('net_profit', 0):,.2f}"],
            ["Total Users", f"{stats.get('total_users', 0):,}"],
            ["Active Ads", f"{stats.get('active_ads', 0):,}"],
            ["Pending Withdrawals", f"{stats.get('pending_withdrawals', 0):,}"],
        ]
        
        summary_table = Table(summary_data, colWidths=[4*inch, 3*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F3F4F6')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 30))
        
        # Withdrawals Section
        if withdrawals:
            elements.append(Paragraph("Withdrawals", self.styles['HeaderAR']))
            
            withdrawal_data = [["ID", "User", "Method", "Amount", "Status", "Date"]]
            for w in withdrawals[:20]:  # Limit to 20 rows
                withdrawal_data.append([
                    w.get('id', '')[:8] + '...',
                    w.get('user_email', w.get('user_id', ''))[:20],
                    w.get('method', ''),
                    f"{w.get('amount', 0):.2f} {w.get('currency', 'USD')}",
                    w.get('status', ''),
                    w.get('created_at', datetime.utcnow()).strftime('%Y-%m-%d') if isinstance(w.get('created_at'), datetime) else str(w.get('created_at', ''))[:10]
                ])
            
            withdrawal_table = Table(withdrawal_data, colWidths=[1*inch, 1.5*inch, 0.8*inch, 1*inch, 0.8*inch, 1*inch])
            withdrawal_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10B981')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
            ]))
            elements.append(withdrawal_table)
            elements.append(Spacer(1, 30))
        
        # Ad Revenue Section
        if ads_revenue:
            elements.append(Paragraph("Ad Revenue", self.styles['HeaderAR']))
            
            ads_data = [["Ad Title", "Advertiser", "Amount (SAR)", "Status", "Date"]]
            for ad in ads_revenue[:20]:
                ads_data.append([
                    ad.get('title', '')[:25],
                    ad.get('advertiser_name', '')[:20],
                    f"{ad.get('price', 0):,.2f}",
                    ad.get('status', ''),
                    ad.get('created_at', datetime.utcnow()).strftime('%Y-%m-%d') if isinstance(ad.get('created_at'), datetime) else str(ad.get('created_at', ''))[:10]
                ])
            
            ads_table = Table(ads_data, colWidths=[2*inch, 1.5*inch, 1*inch, 0.8*inch, 1*inch])
            ads_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8B5CF6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
            ]))
            elements.append(ads_table)
        
        # Footer
        elements.append(Spacer(1, 40))
        elements.append(Paragraph(
            "This report is auto-generated by Saqr Platform",
            ParagraphStyle(name='Footer', fontSize=8, alignment=TA_CENTER, textColor=colors.gray)
        ))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    
    async def generate_user_report(
        self,
        user: Dict[str, Any],
        withdrawals: List[Dict],
        watched_ads: int,
        period_days: int = 30
    ) -> bytes:
        """Generate user activity report"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1*cm,
            leftMargin=1*cm,
            topMargin=1*cm,
            bottomMargin=1*cm
        )
        
        elements = []
        
        # Title
        elements.append(Paragraph(
            "Saqr - User Report",
            self.styles['TitleAR']
        ))
        
        # User Info
        elements.append(Paragraph("User Information", self.styles['HeaderAR']))
        
        user_data = [
            ["Field", "Value"],
            ["Name", user.get('name', 'N/A')],
            ["Email", user.get('email', 'N/A')],
            ["Current Points", f"{user.get('points', 0):,}"],
            ["Total Earned", f"{user.get('total_earned', 0):,}"],
            ["Ads Watched", f"{watched_ads:,}"],
            ["Member Since", user.get('created_at', datetime.utcnow()).strftime('%Y-%m-%d') if isinstance(user.get('created_at'), datetime) else 'N/A'],
        ]
        
        user_table = Table(user_data, colWidths=[3*inch, 4*inch])
        user_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
        ]))
        elements.append(user_table)
        elements.append(Spacer(1, 30))
        
        # Withdrawal History
        if withdrawals:
            elements.append(Paragraph("Withdrawal History", self.styles['HeaderAR']))
            
            w_data = [["Date", "Method", "Amount", "Status"]]
            for w in withdrawals[:15]:
                w_data.append([
                    w.get('created_at', datetime.utcnow()).strftime('%Y-%m-%d') if isinstance(w.get('created_at'), datetime) else str(w.get('created_at', ''))[:10],
                    w.get('method', ''),
                    f"{w.get('amount', 0):.2f} {w.get('currency', 'USD')}",
                    w.get('status', '')
                ])
            
            w_table = Table(w_data, colWidths=[2*inch, 1.5*inch, 2*inch, 1.5*inch])
            w_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10B981')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ]))
            elements.append(w_table)
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    
    async def generate_ads_performance_report(
        self,
        ads: List[Dict],
        period_days: int = 30
    ) -> bytes:
        """Generate ads performance report"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1*cm,
            leftMargin=1*cm,
            topMargin=1*cm,
            bottomMargin=1*cm
        )
        
        elements = []
        
        # Title
        elements.append(Paragraph(
            "Saqr - Ads Performance Report",
            self.styles['TitleAR']
        ))
        
        elements.append(Paragraph(
            f"Period: Last {period_days} days",
            self.styles['NormalAR']
        ))
        elements.append(Spacer(1, 20))
        
        # Summary
        total_views = sum(ad.get('views', 0) for ad in ads)
        total_revenue = sum(ad.get('price', 0) for ad in ads)
        
        elements.append(Paragraph("Summary", self.styles['HeaderAR']))
        
        summary_data = [
            ["Total Ads", "Total Views", "Total Revenue (SAR)"],
            [f"{len(ads)}", f"{total_views:,}", f"{total_revenue:,.2f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[2.3*inch, 2.3*inch, 2.3*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#EEF2FF')),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 30))
        
        # Top Performing Ads
        if ads:
            elements.append(Paragraph("Ad Performance Details", self.styles['HeaderAR']))
            
            ads_data = [["Title", "Advertiser", "Views", "Completion %", "Revenue"]]
            sorted_ads = sorted(ads, key=lambda x: x.get('views', 0), reverse=True)
            
            for ad in sorted_ads[:15]:
                completion_rate = ad.get('completion_rate', 0)
                ads_data.append([
                    ad.get('title', '')[:30],
                    ad.get('advertiser_name', '')[:20],
                    f"{ad.get('views', 0):,}",
                    f"{completion_rate:.1f}%",
                    f"{ad.get('price', 0):,.0f} SAR"
                ])
            
            ads_table = Table(ads_data, colWidths=[2*inch, 1.5*inch, 1*inch, 1*inch, 1.2*inch])
            ads_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8B5CF6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
            ]))
            elements.append(ads_table)
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()


# Singleton instance
pdf_service = PDFReportService()
