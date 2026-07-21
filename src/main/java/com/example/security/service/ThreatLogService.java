package com.example.security.service;

import com.example.security.entity.ThreatCategory;
import com.example.security.entity.ThreatLog;
import com.example.security.repository.ThreatCategoryRepository;
import com.example.security.repository.ThreatLogRepository;
import com.example.security.repository.BlockedIpRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class ThreatLogService extends AbstractCrudService<ThreatLog, Long> {

    private final ThreatLogRepository threatLogRepository;
    private final ThreatCategoryRepository threatCategoryRepository;
    private final SseService sseService;
    private final ThreatIntelligenceService threatIntelligenceService;
    private final GeminiAnalysisService geminiAnalysisService;
    private final BlockedIpRepository blockedIpRepository;

    public ThreatLogService(ThreatLogRepository threatLogRepository, 
                            ThreatCategoryRepository threatCategoryRepository,
                            SseService sseService,
                            ThreatIntelligenceService threatIntelligenceService,
                            GeminiAnalysisService geminiAnalysisService,
                            BlockedIpRepository blockedIpRepository) {
        super(threatLogRepository);
        this.threatLogRepository = threatLogRepository;
        this.threatCategoryRepository = threatCategoryRepository;
        this.sseService = sseService;
        this.threatIntelligenceService = threatIntelligenceService;
        this.geminiAnalysisService = geminiAnalysisService;
        this.blockedIpRepository = blockedIpRepository;
    }

    /**
     * N+1 문제를 방지하기 위해 Fetch Join을 사용하도록 findAll() 메서드를 오버라이딩합니다.
     */
    @Override
    public List<ThreatLog> findAll() {
        return threatLogRepository.findAllWithCategory();
    }

    @Override
    @Transactional
    public ThreatLog update(Long id, ThreatLog entity) {
        ThreatLog log = findById(id);
        
        if (entity.getThreatCategory() != null && entity.getThreatCategory().getId() != null) {
            ThreatCategory category = threatCategoryRepository.findById(entity.getThreatCategory().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + entity.getThreatCategory().getId()));
            log.setThreatCategory(category);
        }
        
        log.setThreatName(entity.getThreatName());
        log.setSeverityLevel(entity.getSeverityLevel());
        log.setDescription(entity.getDescription());
        log.setSourceIp(entity.getSourceIp());
        log.setDestinationIp(entity.getDestinationIp());
        log.setPort(entity.getPort());
        log.setStatus(entity.getStatus());
        
        // IP 위험도 평가 및 AI 가이드라인 재생성
        int abuseScore = threatIntelligenceService.getAbuseScore(log.getSourceIp());
        log.setAbuseScore(abuseScore);
        
        String categoryName = log.getThreatCategory() != null ? log.getThreatCategory().getName() : "";
        String playbook = geminiAnalysisService.generatePlaybook(log.getThreatName(), categoryName, log.getDescription());
        log.setAiRecommendation(playbook);
        
        // 실시간 업데이트 이벤트 브로드캐스트
        sseService.broadcast(new com.example.security.dto.ThreatLogDto(log));
        
        return log;
    }

    @Override
    @Transactional
    public ThreatLog save(ThreatLog entity) {
        if (entity.getThreatCategory() != null && entity.getThreatCategory().getId() != null) {
            ThreatCategory category = threatCategoryRepository.findById(entity.getThreatCategory().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + entity.getThreatCategory().getId()));
            entity.setThreatCategory(category);
        } else {
            throw new IllegalArgumentException("Threat Category is required.");
        }
        
        // IP 위험도 평가 및 AI 가이드라인 생성
        int abuseScore = threatIntelligenceService.getAbuseScore(entity.getSourceIp());
        entity.setAbuseScore(abuseScore);
        
        String categoryName = entity.getThreatCategory() != null ? entity.getThreatCategory().getName() : "";
        String playbook = geminiAnalysisService.generatePlaybook(entity.getThreatName(), categoryName, entity.getDescription());
        entity.setAiRecommendation(playbook);
        
        ThreatLog saved = super.save(entity);
        
        // 실시간 탐지 이벤트 브로드캐스트
        sseService.broadcast(new com.example.security.dto.ThreatLogDto(saved));
        
        return saved;
    }

    @Override
    @Transactional
    public void deleteById(Long id) {
        ThreatLog log = findById(id);
        com.example.security.dto.ThreatLogDto dto = new com.example.security.dto.ThreatLogDto(log);
        
        super.deleteById(id);
        
        // 실시간 삭제 이벤트 브로드캐스트
        sseService.broadcastDelete(dto);
    }

    /**
     * 위협 로그를 비우고 기본 시드 데이터 4개로 초기화합니다.
     */
    @Transactional
    public void resetToDefaultLogs() {
        // 1. 모든 위협 로그 삭제
        threatLogRepository.deleteAll();

        // 2. 기본 시드 로그 데이터 삽입
        createSeedLog("DoS/DDoS", "Ping of Death Attack", "HIGH", 
            "ICMP Echo Request 패킷 크기를 비정상적으로 크게 설정하여 시스템을 다운시킴", 
            "192.168.1.105", "10.0.0.5", 0, "RESOLVED", 0, 
            "### 🛡️ AI 조치 가이드\n1. **방화벽 설정**: 크기가 65535 바이트를 초과하는 비정상적인 ICMP 패킷을 드롭하도록 방화벽 룰을 추가합니다.\n2. **시스템 패치**: OS 커널 및 네트워크 드라이버를 최신 상태로 업데이트하여 비정상 패킷 분할 처리에 관한 버그를 방지합니다.\n3. **모니터링**: IDS/IPS 장비에서 ICMP Flooding 패턴을 지속 감시합니다.");

        createSeedLog("Sniffing", "Wireshark Packet Sniffing", "MEDIUM", 
            "암호화되지 않은 FTP 트래픽을 가로채서 관리자 비밀번호를 획득함", 
            "192.168.1.200", "192.168.1.50", 21, "ANALYZING", 0, 
            "### 🛡️ AI 조치 가이드\n1. **암호화 전환**: FTP 프로토콜을 사용 중지하고, SSL/TLS 기반의 FTPS 또는 SSH 기반의 SFTP 프로토콜로 전환하십시오.\n2. **보안 세그먼트**: 스위치 포트 보안을 켜고 ARP Spoofing을 방지하기 위해 Dynamic ARP Inspection (DAI) 설정을 켭니다.\n3. **크레덴셜 초기화**: 노출된 FTP 관리자 비밀번호를 즉시 변경하십시오.");

        createSeedLog("Session Hijacking", "Cookie Poisoning Session Hijacking", "HIGH", 
            "사용자 인증 쿠키의 세션 식별자를 위조하여 타인의 계정으로 권한 없는 접속 시도", 
            "203.0.113.50", "10.0.0.10", 443, "DETECTED", 85, 
            "### 🛡️ AI 조치 가이드\n1. **세션 무효화**: 해당 세션 쿠키를 즉시 세션 서버에서 무효화(Invalidate) 처리하십시오.\n2. **보안 쿠키 옵션**: 인증 쿠키 발급 시 `HttpOnly`와 `Secure` 속성을 무조건 활성화하여 클라이언트 스크립트에서 접근할 수 없도록 강제합니다.\n3. **외부 IP 검사**: 출발지 IP(203.0.113.50)는 악성 점수 85%의 위험 IP입니다. 방화벽 단에서 즉시 차단하십시오.");

        createSeedLog("Social Engineering", "Smishing Attack impersonating Bank", "LOW", 
            "은행 사칭 문자를 발송하여 악성 앱 설치 유도", 
            "Unknown", "0.0.0.0", 0, "DETECTED", 0, 
            "### 🛡️ AI 조치 가이드\n1. **사용자 교육**: 임직원 대상으로 사칭 문자 링크 클릭 금지 및 모바일 백신 설치 의무화 캠페인을 수행하십시오.\n2. **도메인 차단**: 스미싱 문자에 기재된 악성 URL 주소를 인터넷 서비스 제공업체(KISA 등)에 신고하여 차단 요청하십시오.");

        // 3. SSE 초기화 브로드캐스트 이벤트 발행
        sseService.broadcastReset();
    }

    private void createSeedLog(String categoryName, String threatName, String severity, 
                               String desc, String srcIp, String destIp, Integer port, String status, Integer abuseScore, String aiRec) {
        ThreatCategory category = threatCategoryRepository.findByName(categoryName)
                .orElseGet(() -> {
                    ThreatCategory newCat = new ThreatCategory();
                    newCat.setName(categoryName);
                    newCat.setDescription(categoryName + " category");
                    return threatCategoryRepository.save(newCat);
                });

        ThreatLog log = new ThreatLog();
        log.setThreatCategory(category);
        log.setThreatName(threatName);
        log.setSeverityLevel(severity);
        log.setDescription(desc);
        log.setSourceIp(srcIp);
        log.setDestinationIp(destIp);
        log.setPort(port);
        log.setStatus(status);
        log.setAbuseScore(abuseScore);
        log.setAiRecommendation(aiRec);

        threatLogRepository.save(log);
    }

    /**
     * 비동기로 Syslog 메시지를 수신하여 파싱하고 저장합니다.
     */
    @Async
    @Transactional
    public void processSyslogAsync(String rawMsg, String senderIp) {
        try {
            String cleanMsg = rawMsg;
            String severity = "LOW";
            
            // 1. PRI (우선순위) 추출
            if (rawMsg.startsWith("<")) {
                int endIdx = rawMsg.indexOf(">");
                if (endIdx > 1) {
                    try {
                        int pri = Integer.parseInt(rawMsg.substring(1, endIdx));
                        int sev = pri % 8;
                        // Syslog 심각도 분류: 0-2 (HIGH), 3-4 (MEDIUM), 5-7 (LOW)
                        if (sev <= 2) {
                            severity = "HIGH";
                        } else if (sev <= 4) {
                            severity = "MEDIUM";
                        } else {
                            severity = "LOW";
                        }
                        cleanMsg = rawMsg.substring(endIdx + 1);
                    } catch (NumberFormatException e) {
                        // ignore
                    }
                }
            }

            // 2. IP 주소 정규식을 이용해 출발지/목적지 IP 추출
            String sourceIp = senderIp;
            String destIp = "127.0.0.1";
            
            java.util.regex.Pattern ipPattern = java.util.regex.Pattern.compile("\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b");
            java.util.regex.Matcher ipMatcher = ipPattern.matcher(cleanMsg);
            
            java.util.List<String> foundIps = new java.util.ArrayList<>();
            while (ipMatcher.find()) {
                foundIps.add(ipMatcher.group());
            }
            
            if (foundIps.size() >= 2) {
                sourceIp = foundIps.get(0);
                destIp = foundIps.get(1);
            } else if (foundIps.size() == 1) {
                sourceIp = foundIps.get(0);
                destIp = senderIp;
            }

            // 3. 포트 번호 추출
            Integer port = 0;
            java.util.regex.Pattern portPattern = java.util.regex.Pattern.compile("(?:port|dstport)[=:\\s]*(\\d+)");
            java.util.regex.Matcher portMatcher = portPattern.matcher(cleanMsg.toLowerCase());
            if (portMatcher.find()) {
                try {
                    port = Integer.parseInt(portMatcher.group(1));
                } catch (NumberFormatException e) {
                    // ignore
                }
            }

            // 4. 키워드 분석을 통해 카테고리 매핑 및 위협명 명명
            String catName = "DoS/DDoS"; // 기본값
            String threatName = "External Syslog Event";
            
            String lowerMsg = cleanMsg.toLowerCase();
            if (lowerMsg.contains("sniff") || lowerMsg.contains("promiscuous") || lowerMsg.contains("wireshark")) {
                catName = "Sniffing";
                threatName = "Packet Sniffing Alert";
            } else if (lowerMsg.contains("session") || lowerMsg.contains("cookie") || lowerMsg.contains("hijack") || lowerMsg.contains("poison")) {
                catName = "Session Hijacking";
                threatName = "Session Hijacking Attempt";
            } else if (lowerMsg.contains("phish") || lowerMsg.contains("smish") || lowerMsg.contains("social") || lowerMsg.contains("mail")) {
                catName = "Social Engineering";
                threatName = "Phishing / Social Engineering Alert";
            } else if (lowerMsg.contains("ddos") || lowerMsg.contains("flood") || lowerMsg.contains("ping") || lowerMsg.contains("syn")) {
                catName = "DoS/DDoS";
                if (lowerMsg.contains("syn")) threatName = "SYN Flooding Attack";
                else if (lowerMsg.contains("ping")) threatName = "Ping of Death Attempt";
                else threatName = "DDoS Traffic Detected";
            } else {
                if (lowerMsg.contains("sql") || lowerMsg.contains("injection") || lowerMsg.contains("query")) {
                    catName = "Session Hijacking";
                    threatName = "SQL Injection Attempt";
                } else if (lowerMsg.contains("brute") || lowerMsg.contains("login") || lowerMsg.contains("fail")) {
                    catName = "Session Hijacking";
                    threatName = "SSH Brute Force Attack";
                }
            }

            // 카테고리 가져오기 또는 새로 생성
            final String finalCatName = catName;
            ThreatCategory category = threatCategoryRepository.findByName(finalCatName)
                    .orElseGet(() -> {
                        ThreatCategory newCat = new ThreatCategory();
                        newCat.setName(finalCatName);
                        newCat.setDescription(finalCatName + " category created automatically");
                        return threatCategoryRepository.save(newCat);
                    });

            // 위협 로그 빌드 및 저장
            ThreatLog log = new ThreatLog();
            log.setThreatCategory(category);
            log.setThreatName(threatName);
            log.setSeverityLevel(severity);
            log.setDescription(cleanMsg.trim());
            log.setSourceIp(sourceIp);
            log.setDestinationIp(destIp);
            log.setPort(port);

            // 🔒 가상 방화벽 차단 정책 검사: 출발지 IP가 blocked_ips에 등록된 경우 BLOCKED 처리
            if (blockedIpRepository.existsByIpAddress(sourceIp)) {
                log.setStatus("BLOCKED");
                org.slf4j.LoggerFactory.getLogger(ThreatLogService.class)
                    .warn("[FIREWALL] Syslog from blocked IP {} dropped and marked BLOCKED.", sourceIp);
            } else {
                log.setStatus("DETECTED");
            }

            // 엔리치먼트와 실시간 브로드캐스팅이 포함된 save() 메서드 호출
            save(log);

        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(ThreatLogService.class)
                .error("Error processing async syslog message: {}", e.getMessage(), e);
        }
    }

    /**
     * 비동기로 Webhook 로그 데이터를 수집하여 분석하고 저장합니다.
     */
    @Async
    @Transactional
    public void processWebhookAsync(com.example.security.dto.WebhookLogPayload payload) {
        try {
            String catName = payload.getCategoryName();
            if (catName == null || catName.trim().isEmpty()) {
                catName = "Session Hijacking";
            } else {
                String norm = catName.trim().toLowerCase();
                if (norm.contains("dos") || norm.contains("ddos") || norm.contains("flood") || norm.contains("ping")) {
                    catName = "DoS/DDoS";
                } else if (norm.contains("sniff") || norm.contains("promiscuous")) {
                    catName = "Sniffing";
                } else if (norm.contains("social") || norm.contains("phish") || norm.contains("smish") || norm.contains("mail")) {
                    catName = "Social Engineering";
                } else {
                    catName = "Session Hijacking"; // Web Exploit, Brute Force 등은 이 범주로 수렴
                }
            }
            
            final String finalCatName = catName;
            ThreatCategory category = threatCategoryRepository.findByName(finalCatName)
                    .orElseGet(() -> {
                        ThreatCategory newCat = new ThreatCategory();
                        newCat.setName(finalCatName);
                        newCat.setDescription(finalCatName + " category created automatically");
                        return threatCategoryRepository.save(newCat);
                    });

            ThreatLog log = new ThreatLog();
            log.setThreatCategory(category);
            log.setThreatName(payload.getThreatName());
            log.setSeverityLevel(payload.getSeverityLevel() != null ? payload.getSeverityLevel() : "LOW");
            log.setDescription(payload.getDescription() != null ? payload.getDescription() : "");
            String srcIp = payload.getSourceIp() != null ? payload.getSourceIp() : "Unknown";
            log.setSourceIp(srcIp);
            log.setDestinationIp(payload.getDestinationIp() != null ? payload.getDestinationIp() : "Unknown");
            log.setPort(payload.getPort());

            // 🔒 가상 방화벽 차단 정책 검사: 출발지 IP가 blocked_ips에 등록된 경우 BLOCKED 처리
            if (blockedIpRepository.existsByIpAddress(srcIp)) {
                log.setStatus("BLOCKED");
                org.slf4j.LoggerFactory.getLogger(ThreatLogService.class)
                    .warn("[FIREWALL] Webhook from blocked IP {} dropped and marked BLOCKED.", srcIp);
            } else {
                log.setStatus(payload.getStatus() != null ? payload.getStatus() : "DETECTED");
            }

            // 엔리치먼트 및 SSE 브로드캐스팅이 들어간 save() 호출
            save(log);

        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(ThreatLogService.class)
                .error("Error processing async webhook log: {}", e.getMessage(), e);
        }
    }
}
