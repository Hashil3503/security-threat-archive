package com.example.security.aspect;

import com.example.security.dto.LoginRequest;
import com.example.security.dto.ThreatCategoryDto;
import com.example.security.dto.ThreatLogDto;
import com.example.security.entity.AuditLog;
import com.example.security.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

@Aspect
@Component
public class AuditLogAspect {

    private final AuditLogRepository auditLogRepository;

    public AuditLogAspect(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    private String getClientIp() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            HttpServletRequest request = attributes.getRequest();
            String ip = request.getHeader("X-Forwarded-For");
            if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
                ip = request.getRemoteAddr();
            }
            return ip;
        }
        return "Unknown IP";
    }

    private String[] getCurrentUserAndRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            String username = auth.getName();
            String role = auth.getAuthorities().toString();
            return new String[]{username, role};
        }
        return new String[]{"Anonymous", "ROLE_ANONYMOUS"};
    }

    // 1. Auth Login Hooks
    @AfterReturning(pointcut = "execution(* com.example.security.controller.AuthController.authenticateUser(..))", returning = "result")
    public void logLoginSuccess(JoinPoint joinPoint, Object result) {
        String ip = getClientIp();
        Object[] args = joinPoint.getArgs();
        String username = "Unknown";
        if (args.length > 0 && args[0] instanceof LoginRequest) {
            username = ((LoginRequest) args[0]).getUsername();
        }

        String role = "ROLE_USER";
        if (result instanceof ResponseEntity) {
            Object body = ((ResponseEntity<?>) result).getBody();
            // Try to extract role details if mapped, else fallback
            if (body != null && body.toString().contains("role")) {
                if (body.toString().contains("ROLE_ADMIN")) {
                    role = "[ROLE_ADMIN]";
                } else if (body.toString().contains("ROLE_ANALYST")) {
                    role = "[ROLE_ANALYST]";
                }
            }
        }

        AuditLog log = new AuditLog("LOGIN_SUCCESS", username, role, ip,
                "사용자 '" + username + "' 로그인 성공", LocalDateTime.now());
        auditLogRepository.save(log);
    }

    @AfterThrowing(pointcut = "execution(* com.example.security.controller.AuthController.authenticateUser(..))", throwing = "ex")
    public void logLoginFailure(JoinPoint joinPoint, Exception ex) {
        String ip = getClientIp();
        Object[] args = joinPoint.getArgs();
        String username = "Unknown";
        if (args.length > 0 && args[0] instanceof LoginRequest) {
            username = ((LoginRequest) args[0]).getUsername();
        }

        AuditLog log = new AuditLog("LOGIN_FAILED", username, "[ROLE_ANONYMOUS]", ip,
                "사용자 '" + username + "' 로그인 시도 실패 (오류: " + ex.getMessage() + ")", LocalDateTime.now());
        auditLogRepository.save(log);
    }

    // 2. Simulation Toggle Hook
    @AfterReturning(pointcut = "execution(* com.example.security.controller.SimulationController.toggle(..))", returning = "result")
    public void logSimulationToggle(Object result) {
        String ip = getClientIp();
        String[] user = getCurrentUserAndRole();
        String state = "OFF";
        if (result instanceof ResponseEntity) {
            Object body = ((ResponseEntity<?>) result).getBody();
            if (body != null && body.toString().contains("active=true")) {
                state = "ON";
            }
        }

        AuditLog log = new AuditLog("TOGGLE_SIMULATOR", user[0], user[1], ip,
                "시뮬레이터 상태 변경 (새로운 상태: " + state + ")", LocalDateTime.now());
        auditLogRepository.save(log);
    }

    // 3. Threat Log Hooks
    @AfterReturning(pointcut = "execution(* com.example.security.controller.ThreatLogController.createLog(..))", returning = "result")
    public void logThreatLogCreation(JoinPoint joinPoint, Object result) {
        String ip = getClientIp();
        String[] user = getCurrentUserAndRole();
        String details = "새로운 위협 로그 수동 등록 완료";
        if (result instanceof ResponseEntity) {
            Object body = ((ResponseEntity<?>) result).getBody();
            if (body instanceof ThreatLogDto) {
                ThreatLogDto dto = (ThreatLogDto) body;
                details += " (위협명: " + dto.getThreatName() + ", 위험점수: " + dto.getAbuseScore() + "%, 심각도: " + dto.getSeverityLevel() + ")";
            }
        }
        AuditLog log = new AuditLog("CREATE_THREAT_LOG", user[0], user[1], ip, details, LocalDateTime.now());
        auditLogRepository.save(log);
    }

    @AfterReturning(pointcut = "execution(* com.example.security.controller.ThreatLogController.updateLog(..))", returning = "result")
    public void logThreatLogUpdate(JoinPoint joinPoint, Object result) {
        String ip = getClientIp();
        String[] user = getCurrentUserAndRole();
        String details = "위협 로그 정보 편집 완료";
        if (result instanceof ResponseEntity) {
            Object body = ((ResponseEntity<?>) result).getBody();
            if (body instanceof ThreatLogDto) {
                ThreatLogDto dto = (ThreatLogDto) body;
                details += " (로그 ID: " + dto.getId() + ", 위협명: " + dto.getThreatName() + ", 처리상태: " + dto.getStatus() + ")";
            }
        }
        AuditLog log = new AuditLog("UPDATE_THREAT_LOG", user[0], user[1], ip, details, LocalDateTime.now());
        auditLogRepository.save(log);
    }

    @AfterReturning(pointcut = "execution(* com.example.security.controller.ThreatLogController.deleteLog(..))")
    public void logThreatLogDeletion(JoinPoint joinPoint) {
        String ip = getClientIp();
        String[] user = getCurrentUserAndRole();
        String details = "위협 로그 레코드 삭제 완료";
        Object[] args = joinPoint.getArgs();
        if (args.length > 0) {
            details += " (로그 ID: " + args[0] + ")";
        }
        AuditLog log = new AuditLog("DELETE_THREAT_LOG", user[0], user[1], ip, details, LocalDateTime.now());
        auditLogRepository.save(log);
    }

    @AfterReturning(pointcut = "execution(* com.example.security.controller.ThreatLogController.resetLogs(..))")
    public void logThreatLogReset() {
        String ip = getClientIp();
        String[] user = getCurrentUserAndRole();
        AuditLog log = new AuditLog("RESET_THREAT_LOGS", user[0], user[1], ip,
                "대시보드 위협 아카이브 데이터 초기화 완료 (디폴트 템플릿 복구)", LocalDateTime.now());
        auditLogRepository.save(log);
    }

    // 4. Category Hooks
    @AfterReturning(pointcut = "execution(* com.example.security.controller.ThreatCategoryController.createCategory(..))", returning = "result")
    public void logCategoryCreation(JoinPoint joinPoint, Object result) {
        String ip = getClientIp();
        String[] user = getCurrentUserAndRole();
        String details = "새로운 위협 카테고리 분류 추가 완료";
        if (result instanceof ResponseEntity) {
            Object body = ((ResponseEntity<?>) result).getBody();
            if (body instanceof ThreatCategoryDto) {
                ThreatCategoryDto dto = (ThreatCategoryDto) body;
                details += " (카테고리명: " + dto.getName() + ")";
            }
        }
        AuditLog log = new AuditLog("CREATE_CATEGORY", user[0], user[1], ip, details, LocalDateTime.now());
        auditLogRepository.save(log);
    }

    @AfterReturning(pointcut = "execution(* com.example.security.controller.ThreatCategoryController.deleteCategory(..))")
    public void logCategoryDeletion(JoinPoint joinPoint) {
        String ip = getClientIp();
        String[] user = getCurrentUserAndRole();
        String details = "위협 카테고리 분류 삭제 완료";
        Object[] args = joinPoint.getArgs();
        if (args.length > 0) {
            details += " (카테고리 ID: " + args[0] + ")";
        }
        AuditLog log = new AuditLog("DELETE_CATEGORY", user[0], user[1], ip, details, LocalDateTime.now());
        auditLogRepository.save(log);
    }
}
