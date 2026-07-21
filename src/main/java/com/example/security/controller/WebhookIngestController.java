package com.example.security.controller;

import com.example.security.dto.WebhookLogPayload;
import com.example.security.repository.BlockedIpRepository;
import com.example.security.service.ThreatLogService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ingest")
public class WebhookIngestController {

    private final ThreatLogService threatLogService;
    private final BlockedIpRepository blockedIpRepository;

    @Value("${webhook.token:securityarchive-secret-webhook-token}")
    private String configuredToken;

    public WebhookIngestController(ThreatLogService threatLogService,
                                   BlockedIpRepository blockedIpRepository) {
        this.threatLogService = threatLogService;
        this.blockedIpRepository = blockedIpRepository;
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> ingestWebhook(
            @RequestHeader(value = "X-Webhook-Token", required = false) String token,
            @RequestBody WebhookLogPayload payload) {

        if (token == null || !token.equals(configuredToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Unauthorized: Invalid X-Webhook-Token header.");
        }

        if (payload.getThreatName() == null || payload.getThreatName().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Bad Request: threatName is required.");
        }

        // 비동기로 수집 데이터 처리 (202 Accepted 반환)
        threatLogService.processWebhookAsync(payload);

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body("Accepted: Ingestion request received and queued for processing.");
    }

    /**
     * 외부 가상 장치(로그 전송 스크립트)용 방화벽 차단 정책 조회 엔드포인트
     * JWT 인증 없이 X-Webhook-Token으로만 접근 가능 — 차단 IP Set만 반환 (읽기 전용)
     */
    @GetMapping("/firewall-policy")
    public ResponseEntity<?> getFirewallPolicy(
            @RequestHeader(value = "X-Webhook-Token", required = false) String token) {

        if (token == null || !token.equals(configuredToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Unauthorized: Invalid X-Webhook-Token header.");
        }

        Set<String> blockedIpSet = blockedIpRepository.findAll()
                .stream()
                .map(b -> b.getIpAddress())
                .collect(Collectors.toSet());

        return ResponseEntity.ok(blockedIpSet);
    }
}
