package com.example.security.service;

import com.example.security.entity.ThreatLog;
import com.example.security.repository.ThreatLogRepository;
import com.lowagie.text.Document;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.pdf.PdfWriter;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.BaseFont;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ReportService {

    private final ThreatLogRepository threatLogRepository;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public ReportService(ThreatLogRepository threatLogRepository) {
        this.threatLogRepository = threatLogRepository;
    }

    /**
     * 전체 위협 로그 데이터를 스타일이 가미된 Excel 파일로 생성합니다.
     */
    @Transactional(readOnly = true)
    public ByteArrayInputStream generateExcelReport() {
        List<ThreatLog> logs = threatLogRepository.findAll();

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Threat Logs Archive");

            // 1. 헤더 폰트 및 스타일 정의 (Navy Theme)
            org.apache.poi.ss.usermodel.Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);

            CellStyle headerCellStyle = workbook.createCellStyle();
            headerCellStyle.setFont(headerFont);
            headerCellStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerCellStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerCellStyle.setAlignment(HorizontalAlignment.CENTER);
            headerCellStyle.setBorderBottom(BorderStyle.MEDIUM);

            // 2. 헤더 행 구성
            String[] columns = {
                "ID", "공격 분류 (Category)", "위협 명칭 (Threat Name)", "심각도 (Severity)",
                "처리 상태 (Status)", "출발지 IP", "목적지 IP", "포트 (Port)", 
                "악성 IP 점수 (%)", "탐지 일시", "상세 설명"
            };

            Row headerRow = sheet.createRow(0);
            for (int col = 0; col < columns.length; col++) {
                Cell cell = headerRow.createCell(col);
                cell.setCellValue(columns[col]);
                cell.setCellStyle(headerCellStyle);
            }

            // 3. 데이터 셀 스타일 (테두리 및 가독성)
            CellStyle dataCellStyle = workbook.createCellStyle();
            dataCellStyle.setBorderBottom(BorderStyle.THIN);
            dataCellStyle.setBorderLeft(BorderStyle.THIN);
            dataCellStyle.setBorderRight(BorderStyle.THIN);
            dataCellStyle.setBorderTop(BorderStyle.THIN);

            CellStyle centerCellStyle = workbook.createCellStyle();
            centerCellStyle.cloneStyleFrom(dataCellStyle);
            centerCellStyle.setAlignment(HorizontalAlignment.CENTER);

            // 4. 데이터 행 작성
            int rowIdx = 1;
            for (ThreatLog log : logs) {
                Row row = sheet.createRow(rowIdx++);

                // ID
                Cell cell0 = row.createCell(0);
                cell0.setCellValue(log.getId());
                cell0.setCellStyle(centerCellStyle);

                // Category
                Cell cell1 = row.createCell(1);
                cell1.setCellValue(log.getThreatCategory() != null ? log.getThreatCategory().getName() : "미지정");
                cell1.setCellStyle(dataCellStyle);

                // Threat Name
                Cell cell2 = row.createCell(2);
                cell2.setCellValue(log.getThreatName());
                cell2.setCellStyle(dataCellStyle);

                // Severity
                Cell cell3 = row.createCell(3);
                cell3.setCellValue(log.getSeverityLevel());
                cell3.setCellStyle(centerCellStyle);

                // Status
                Cell cell4 = row.createCell(4);
                cell4.setCellValue(log.getStatus());
                cell4.setCellStyle(centerCellStyle);

                // Source IP
                Cell cell5 = row.createCell(5);
                cell5.setCellValue(log.getSourceIp() != null ? log.getSourceIp() : "-");
                cell5.setCellStyle(centerCellStyle);

                // Destination IP
                Cell cell6 = row.createCell(6);
                cell6.setCellValue(log.getDestinationIp() != null ? log.getDestinationIp() : "-");
                cell6.setCellStyle(centerCellStyle);

                // Port
                Cell cell7 = row.createCell(7);
                if (log.getPort() != null && log.getPort() != 0) {
                    cell7.setCellValue(log.getPort());
                } else {
                    cell7.setCellValue("-");
                }
                cell7.setCellStyle(centerCellStyle);

                // Abuse Score
                Cell cell8 = row.createCell(8);
                if (log.getAbuseScore() != null) {
                    cell8.setCellValue(log.getAbuseScore() + "%");
                } else {
                    cell8.setCellValue("-");
                }
                cell8.setCellStyle(centerCellStyle);

                // Time
                Cell cell9 = row.createCell(9);
                cell9.setCellValue(log.getLoggedAt() != null ? log.getLoggedAt().format(DATE_FORMATTER) : "-");
                cell9.setCellStyle(centerCellStyle);

                // Description
                Cell cell10 = row.createCell(10);
                cell10.setCellValue(log.getDescription() != null ? log.getDescription() : "");
                cell10.setCellStyle(dataCellStyle);
            }

            // 5. 열 너비 자동 조절 (Description 제외)
            for (int col = 0; col < columns.length - 1; col++) {
                sheet.autoSizeColumn(col);
            }
            sheet.setColumnWidth(10, 15000); // 상세 설명 열은 넉넉하게 고정 폭 지정

            workbook.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException("Excel 생성 중 오류 발생: " + e.getMessage(), e);
        }
    }

    /**
     * 전체 위협 로그 데이터를 인쇄 가능한 PDF 보고서로 생성합니다.
     */
    @Transactional(readOnly = true)
    public ByteArrayInputStream generatePdfReport() {
        List<ThreatLog> logs = threatLogRepository.findAll();
        Document document = new Document(PageSize.A4, 36, 36, 54, 54);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // 한글 폰트 설정 (Windows 기본 맑은 고딕 경로 활용, 없을 시 fallback 처리)
            Font titleFont = getKoreanFont(20, Font.BOLD);
            Font sectionFont = getKoreanFont(12, Font.BOLD);
            Font bodyFont = getKoreanFont(9, Font.NORMAL);
            Font headerFont = getKoreanFont(9, Font.BOLD);

            // 1. 보고서 메인 타이틀
            Paragraph title = new Paragraph("보안 위협 침해사고 요약 보고서", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(20);
            document.add(title);

            // 2. 개요 및 생성 시간 표시
            Paragraph meta = new Paragraph("발행 일시: " + java.time.LocalDateTime.now().format(DATE_FORMATTER) + 
                                           "\n대상 시스템: Security Threat Archive SIEM 인프라\n" +
                                           "총 감지된 위협 건수: " + logs.size() + "건", bodyFont);
            meta.setSpacingAfter(15);
            document.add(meta);

            // 3. 심각도 별 통계 간이 테이블
            long highCount = logs.stream().filter(l -> "HIGH".equalsIgnoreCase(l.getSeverityLevel())).count();
            long mediumCount = logs.stream().filter(l -> "MEDIUM".equalsIgnoreCase(l.getSeverityLevel())).count();
            long lowCount = logs.stream().filter(l -> "LOW".equalsIgnoreCase(l.getSeverityLevel())).count();

            Paragraph statsTitle = new Paragraph("■ 심각도별 통계 현황", sectionFont);
            statsTitle.setSpacingAfter(5);
            document.add(statsTitle);

            PdfPTable statsTable = new PdfPTable(3);
            statsTable.setWidthPercentage(100);
            statsTable.setSpacingAfter(20);

            PdfPCell highCell = new PdfPCell(new Phrase("HIGH (높음): " + highCount + "건", headerFont));
            highCell.setBackgroundColor(new java.awt.Color(254, 226, 226)); // Light Red
            highCell.setHorizontalAlignment(Element.ALIGN_CENTER);
            highCell.setPadding(8);

            PdfPCell mediumCell = new PdfPCell(new Phrase("MEDIUM (중간): " + mediumCount + "건", headerFont));
            mediumCell.setBackgroundColor(new java.awt.Color(254, 243, 199)); // Light Amber
            mediumCell.setHorizontalAlignment(Element.ALIGN_CENTER);
            mediumCell.setPadding(8);

            PdfPCell lowCell = new PdfPCell(new Phrase("LOW (낮음): " + lowCount + "건", headerFont));
            lowCell.setBackgroundColor(new java.awt.Color(209, 250, 229)); // Light Emerald
            lowCell.setHorizontalAlignment(Element.ALIGN_CENTER);
            lowCell.setPadding(8);

            statsTable.addCell(highCell);
            statsTable.addCell(mediumCell);
            statsTable.addCell(lowCell);
            document.add(statsTable);

            // 4. 상세 보안 침해 기록 목록 테이블
            Paragraph listTitle = new Paragraph("■ 상세 위협 기록 목록 (Threat History Logs)", sectionFont);
            listTitle.setSpacingAfter(8);
            document.add(listTitle);

            // 6개 열: ID, 카테고리, 위협명, 심각도, 상태, 탐지시간
            PdfPTable table = new PdfPTable(new float[]{1f, 2f, 3.5f, 1.5f, 1.5f, 2.5f});
            table.setWidthPercentage(100);

            // 헤더 추가
            String[] headers = {"ID", "카테고리", "위협명", "심각도", "처리상태", "탐지일시"};
            for (String header : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(header, headerFont));
                cell.setBackgroundColor(new java.awt.Color(241, 245, 249)); // Slate background
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                cell.setPadding(6);
                table.addCell(cell);
            }

            // 데이터 행 추가
            for (ThreatLog log : logs) {
                // ID
                PdfPCell cId = new PdfPCell(new Phrase(String.valueOf(log.getId()), bodyFont));
                cId.setHorizontalAlignment(Element.ALIGN_CENTER);
                cId.setPadding(5);
                table.addCell(cId);

                // Category
                PdfPCell cCat = new PdfPCell(new Phrase(log.getThreatCategory() != null ? log.getThreatCategory().getName() : "미지정", bodyFont));
                cCat.setPadding(5);
                table.addCell(cCat);

                // Threat Name
                PdfPCell cName = new PdfPCell(new Phrase(log.getThreatName(), bodyFont));
                cName.setPadding(5);
                table.addCell(cName);

                // Severity
                PdfPCell cSev = new PdfPCell(new Phrase(log.getSeverityLevel(), bodyFont));
                cSev.setHorizontalAlignment(Element.ALIGN_CENTER);
                cSev.setPadding(5);
                table.addCell(cSev);

                // Status
                PdfPCell cStatus = new PdfPCell(new Phrase(log.getStatus(), bodyFont));
                cStatus.setHorizontalAlignment(Element.ALIGN_CENTER);
                cStatus.setPadding(5);
                table.addCell(cStatus);

                // Time
                PdfPCell cTime = new PdfPCell(new Phrase(log.getLoggedAt() != null ? log.getLoggedAt().format(DATE_FORMATTER) : "-", bodyFont));
                cTime.setHorizontalAlignment(Element.ALIGN_CENTER);
                cTime.setPadding(5);
                table.addCell(cTime);
            }

            document.add(table);
            document.close();
            return new ByteArrayInputStream(out.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException("PDF 생성 중 오류 발생: " + e.getMessage(), e);
        }
    }

    /**
     * Windows 시스템 맑은 고딕(Malgun Gothic) 폰트 객체를 안전하게 적재합니다. (fallback 포함)
     */
    private Font getKoreanFont(float size, int style) {
        try {
            // Windows 시스템 기본 폰트 경로 등록
            BaseFont bf = BaseFont.createFont("C:/Windows/Fonts/malgun.ttf", BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
            return new Font(bf, size, style);
        } catch (Exception e) {
            // Windows 환경이 아니거나 맑은 고딕이 없을 경우 fallback 폰트 반환
            return FontFactory.getFont(FontFactory.HELVETICA, size, style);
        }
    }
}
