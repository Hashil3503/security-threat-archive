package com.example.security.controller;

import com.example.security.entity.BlockedIp;
import com.example.security.repository.BlockedIpRepository;
import com.example.security.repository.ThreatLogRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/firewall")
public class BlockedIpController {

    private final BlockedIpRepository blockedIpRepository;
    private final ThreatLogRepository threatLogRepository;

    public BlockedIpController(BlockedIpRepository blockedIpRepository,
                               ThreatLogRepository threatLogRepository) {
        this.blockedIpRepository = blockedIpRepository;
        this.threatLogRepository = threatLogRepository;
    }

    /**
     * 차단된 IP 전체 목록 반환 (최신순)
     */
    @GetMapping("/blocked-ips")
    public ResponseEntity<List<BlockedIp>> getBlockedIps() {
        return ResponseEntity.ok(blockedIpRepository.findAll(
            org.springframework.data.domain.Sort.by(
                org.springframework.data.domain.Sort.Direction.DESC, "blockedAt")));
    }

    /**
     * IP 차단 등록 - SOAR 원클릭 차단
     * Body: { "ipAddress": "1.2.3.4", "reason": "Session Hijacking 위협 탐지" }
     */
    @PostMapping("/block")
    @Transactional
    public ResponseEntity<?> blockIp(@RequestBody Map<String, String> body) {
        String ip = body.get("ipAddress");
        String reason = body.getOrDefault("reason", "관리자 수동 차단");

        if (ip == null || ip.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "IP 주소가 필요합니다."));
        }

        if (blockedIpRepository.existsByIpAddress(ip)) {
            return ResponseEntity.badRequest().body(Map.of("error", "이미 차단된 IP입니다: " + ip));
        }

        BlockedIp blockedIp = new BlockedIp(ip, reason);
        blockedIpRepository.save(blockedIp);

        // 기존 해당 IP의 위협 로그들 상태를 BLOCKED로 일괄 갱신
        threatLogRepository.findBySourceIp(ip).forEach(log -> {
            log.setStatus("BLOCKED");
            threatLogRepository.save(log);
        });

        return ResponseEntity.ok(Map.of(
            "message", "[FIREWALL] IP 차단 완료: " + ip,
            "ip", ip,
            "reason", reason
        ));
    }

    /**
     * IP 차단 해제
     */
    @DeleteMapping("/block/{ip}")
    @Transactional
    public ResponseEntity<?> unblockIp(@PathVariable String ip) {
        if (!blockedIpRepository.existsByIpAddress(ip)) {
            return ResponseEntity.badRequest().body(Map.of("error", "차단 목록에 없는 IP입니다: " + ip));
        }

        blockedIpRepository.deleteByIpAddress(ip);

        // 해당 IP의 위협 로그들 상태를 DETECTED로 복구
        threatLogRepository.findBySourceIp(ip).forEach(log -> {
            log.setStatus("DETECTED");
            threatLogRepository.save(log);
        });

        return ResponseEntity.ok(Map.of(
            "message", "[FIREWALL] IP 차단 해제 완료: " + ip,
            "ip", ip
        ));
    }
}
