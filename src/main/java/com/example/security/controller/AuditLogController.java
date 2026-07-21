package com.example.security.controller;

import com.example.security.entity.AuditLog;
import com.example.security.repository.AuditLogRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/audit-logs")
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    public AuditLogController(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * 모든 감사 로그를 최신순으로 정렬하여 반환합니다.
     * SecurityConfig에 의해 ROLE_ADMIN 권한이 필요합니다.
     */
    @GetMapping
    public ResponseEntity<List<AuditLog>> getAllAuditLogs() {
        List<AuditLog> logs = auditLogRepository.findAllByOrderByTimestampDesc();
        return ResponseEntity.ok(logs);
    }

    /**
     * 모든 감사 로그를 데이터베이스에서 비웁니다.
     * 비우는 작업 직후, 이 작업 자체를 기록하는 최초 감사 로그를 새로 생성합니다.
     */
    @org.springframework.web.bind.annotation.DeleteMapping
    public ResponseEntity<Void> clearAuditLogs(jakarta.servlet.http.HttpServletRequest request) {
        auditLogRepository.deleteAll();

        // 클라이언트 IP 구하기
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }

        // 인증된 사용자 및 권한 구하기
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String username = "Anonymous";
        String role = "ROLE_ANONYMOUS";
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            username = auth.getName();
            role = auth.getAuthorities().toString();
        }

        // 로그 초기화 자체를 행위로 감사로그에 남김 (Audit Trail 무결성 시뮬레이션)
        AuditLog firstLog = new AuditLog("CLEAR_AUDIT_LOGS", username, role, ip,
                "모든 시스템 감사 로그 초기화 수행 완료 (데이터베이스 Truncate 및 리셋)", java.time.LocalDateTime.now());
        auditLogRepository.save(firstLog);

        return ResponseEntity.ok().build();
    }
}
