from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from io import BytesIO
from datetime import datetime
from decimal import Decimal
import os

class PDFService:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.custom_styles = self._create_custom_styles()
    
    def _create_custom_styles(self):
        return {
            'title': ParagraphStyle(
                'CustomTitle',
                parent=self.styles['Heading1'],
                fontSize=18,
                spaceAfter=30,
                alignment=TA_CENTER,
                textColor=colors.HexColor('#2c3e50')
            ),
            'subtitle': ParagraphStyle(
                'CustomSubtitle',
                parent=self.styles['Heading2'],
                fontSize=14,
                spaceAfter=12,
                textColor=colors.HexColor('#34495e')
            ),
            'normal': ParagraphStyle(
                'CustomNormal',
                parent=self.styles['Normal'],
                fontSize=10,
                spaceAfter=6
            ),
            'small': ParagraphStyle(
                'CustomSmall',
                parent=self.styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#7f8c8d')
            )
        }
    
    def generate_invoice_pdf(self, invoice_data, contract_data, lines_data, period_data):
        """Generar PDF de factura individual"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*inch)
        
        # Construir el contenido del PDF
        story = []
        
        # Header con información de la empresa
        story.append(Paragraph("SISTEMA DE GESTIÓN DE IMPRESORAS", self.custom_styles['title']))
        story.append(Paragraph("Factura de Servicios de Impresión", self.custom_styles['subtitle']))
        story.append(Spacer(1, 20))
        
        # Información de la factura
        invoice_info = [
            ['Número de Factura:', invoice_data['invoice_number']],
            ['Fecha de Emisión:', self._format_date(invoice_data['invoice_date'])],
            ['Fecha de Vencimiento:', self._format_date(invoice_data['due_date']) if invoice_data['due_date'] else 'No especificada'],
            ['Período Facturado:', f"{self._format_date(invoice_data['period_start'])} - {self._format_date(invoice_data['period_end'])}"],
            ['Estado:', self._format_status(invoice_data['status'])]
        ]
        
        invoice_table = Table(invoice_info, colWidths=[2*inch, 3*inch])
        invoice_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(invoice_table)
        story.append(Spacer(1, 20))
        
        # Información del contrato
        story.append(Paragraph("Información del Contrato", self.custom_styles['subtitle']))
        contract_info = [
            ['Número de Contrato:', contract_data['contract_number']],
            ['Nombre del Contrato:', contract_data['contract_name']],
            ['Proveedor:', contract_data['supplier']],
            ['Tipo de Contrato:', self._format_contract_type(contract_data['contract_type'])]
        ]
        
        contract_table = Table(contract_info, colWidths=[2*inch, 4*inch])
        contract_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(contract_table)
        story.append(Spacer(1, 20))
        
        # Detalle de líneas de factura
        if lines_data:
            story.append(Paragraph("Detalle de Servicios", self.custom_styles['subtitle']))
            
            # Headers de la tabla
            table_data = [['Descripción', 'Cantidad', 'Precio Unitario', 'Total']]
            
            for line in lines_data:
                table_data.append([
                    line['description'],
                    str(line['quantity']),
                    f"${float(line['unit_price']):,.2f}",
                    f"${float(line['line_total']):,.2f}"
                ])
            
            # Tabla de líneas
            lines_table = Table(table_data, colWidths=[3.5*inch, 0.8*inch, 1.2*inch, 1.2*inch])
            lines_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Descripción alineada a la izquierda
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(lines_table)
            story.append(Spacer(1, 20))
        
        # Totales
        story.append(Paragraph("Resumen de Totales", self.custom_styles['subtitle']))
        totals_data = [
            ['Subtotal:', f"${float(invoice_data['subtotal']):,.2f}"],
            ['Impuestos ({:.1f}%):'.format(float(invoice_data['tax_rate'])), f"${float(invoice_data['tax_amount']):,.2f}"],
            ['Total a Pagar:', f"${float(invoice_data['total_amount']):,.2f}"]
        ]
        
        totals_table = Table(totals_data, colWidths=[2*inch, 2*inch])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('FONTSIZE', (0, -1), (-1, -1), 14),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LINEBELOW', (0, -2), (-1, -2), 1, colors.black),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ecf0f1')),
        ]))
        story.append(totals_table)
        story.append(Spacer(1, 30))
        
        # Footer
        story.append(Paragraph("Observaciones:", self.custom_styles['subtitle']))
        if invoice_data.get('notes'):
            story.append(Paragraph(invoice_data['notes'], self.custom_styles['normal']))
        else:
            story.append(Paragraph("Sin observaciones adicionales.", self.custom_styles['normal']))
        
        story.append(Spacer(1, 20))
        story.append(Paragraph(
            f"Factura generada automáticamente el {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            self.custom_styles['small']
        ))
        
        # Construir el PDF
        doc.build(story)
        
        # Devolver el buffer
        buffer.seek(0)
        return buffer
    
    def generate_period_report_pdf(self, period_data, invoices_data, summary_data):
        """Generar PDF de reporte de período"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*inch)
        
        story = []
        
        # Header
        story.append(Paragraph("SISTEMA DE GESTIÓN DE IMPRESORAS", self.custom_styles['title']))
        story.append(Paragraph(f"Reporte de Facturación - {period_data['name']}", self.custom_styles['subtitle']))
        story.append(Spacer(1, 20))
        
        # Información del período
        period_info = [
            ['Período:', period_data['name']],
            ['Fecha de Inicio:', self._format_date(period_data['start_date'])],
            ['Fecha de Fin:', self._format_date(period_data['end_date'])],
            ['Fecha de Corte:', self._format_date(period_data['cut_off_date'])],
            ['Estado:', period_data['status']],
            ['Total de Facturas:', str(len(invoices_data))],
        ]
        
        period_table = Table(period_info, colWidths=[2*inch, 3*inch])
        period_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(period_table)
        story.append(Spacer(1, 20))
        
        # Resumen financiero
        story.append(Paragraph("Resumen Financiero", self.custom_styles['subtitle']))
        financial_summary = [
            ['Total Facturado:', f"${summary_data.get('total_amount', 0):,.2f}"],
            ['Facturas Pagadas:', f"${summary_data.get('paid_amount', 0):,.2f}"],
            ['Facturas Pendientes:', f"${summary_data.get('pending_amount', 0):,.2f}"],
            ['Facturas Vencidas:', f"${summary_data.get('overdue_amount', 0):,.2f}"]
        ]
        
        financial_table = Table(financial_summary, colWidths=[2*inch, 2*inch])
        financial_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ecf0f1')),
        ]))
        story.append(financial_table)
        story.append(Spacer(1, 20))
        
        # Lista de facturas
        if invoices_data:
            story.append(Paragraph("Detalle de Facturas", self.custom_styles['subtitle']))
            
            table_data = [['N° Factura', 'Contrato', 'Fecha', 'Total', 'Estado']]
            
            for invoice in invoices_data:
                table_data.append([
                    invoice['invoice_number'],
                    f"#{invoice['contract_id']}",
                    self._format_date(invoice['invoice_date']),
                    f"${float(invoice['total_amount']):,.2f}",
                    self._format_status(invoice['status'])
                ])
            
            invoices_table = Table(table_data, colWidths=[1.5*inch, 1*inch, 1*inch, 1.2*inch, 1*inch])
            invoices_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            story.append(invoices_table)
        
        story.append(Spacer(1, 30))
        story.append(Paragraph(
            f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            self.custom_styles['small']
        ))
        
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def _format_date(self, date_str):
        """Formatear fecha para mostrar en PDF"""
        if isinstance(date_str, str):
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                return date_obj.strftime('%d/%m/%Y')
            except:
                return date_str
        elif hasattr(date_str, 'strftime'):
            return date_str.strftime('%d/%m/%Y')
        return str(date_str)
    
    def _format_status(self, status):
        """Formatear estado para mostrar en PDF"""
        status_map = {
            'draft': 'Borrador',
            'sent': 'Enviada',
            'paid': 'Pagada',
            'overdue': 'Vencida',
            'cancelled': 'Cancelada'
        }
        return status_map.get(status, status)
    
    def _format_contract_type(self, contract_type):
        """Formatear tipo de contrato para mostrar en PDF"""
        type_map = {
            'monthly_fixed': 'Costo Fijo Mensual',
            'cost_per_copy': 'Costo por Copia',
            'annual_fixed': 'Costo Fijo Anual',
            'hybrid': 'Híbrido'
        }
        return type_map.get(contract_type, contract_type)