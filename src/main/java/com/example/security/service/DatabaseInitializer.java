package com.example.security.service;

import com.example.security.entity.ThreatCategory;
import com.example.security.entity.ThreatLog;
import com.example.security.entity.User;
import com.example.security.repository.ThreatCategoryRepository;
import com.example.security.repository.ThreatLogRepository;
import com.example.security.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DatabaseInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ThreatCategoryRepository threatCategoryRepository;
    private final ThreatLogRepository threatLogRepository;

    public DatabaseInitializer(UserRepository userRepository,
                               ThreatCategoryRepository threatCategoryRepository,
                               ThreatLogRepository threatLogRepository) {
        this.userRepository = userRepository;
        this.threatCategoryRepository = threatCategoryRepository;
        this.threatLogRepository = threatLogRepository;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // 1. Seed Users if table is empty
        if (userRepository.count() == 0) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword("$2a$10$OqOEou2QyfRCy8AnD58L1eAHUPF3wEgtSuMuJwms91ogtpNziHoMC");
            admin.setRole("ROLE_ADMIN");
            userRepository.save(admin);

            User analyst = new User();
            analyst.setUsername("analyst");
            analyst.setPassword("$2a$10$VlJNOxsz9LO21fYs2RCi6eLqMcfRMjg6FqP0j8hZ3qG94med3nuKK");
            analyst.setRole("ROLE_ANALYST");
            userRepository.save(analyst);

            User user = new User();
            user.setUsername("user");
            user.setPassword("$2a$10$7JoQt.cpWgfKP3O1eURNAuEjl0tMBubdvbsMfFkSiZXj/iHFSUjHm");
            user.setRole("ROLE_USER");
            userRepository.save(user);
        }

        // 0. Clean up any non-standard categories (Web Exploit, Brute Force 등) to keep database pristine
        java.util.List<String> allowedCategories = java.util.Arrays.asList("DoS/DDoS", "Sniffing", "Session Hijacking", "Social Engineering");
        for (ThreatCategory cat : threatCategoryRepository.findAll()) {
            if (!allowedCategories.contains(cat.getName())) {
                for (ThreatLog log : threatLogRepository.findAll()) {
                    if (log.getThreatCategory() != null && log.getThreatCategory().getId().equals(cat.getId())) {
                        threatLogRepository.delete(log);
                    }
                }
                threatCategoryRepository.delete(cat);
            }
        }

        // 2. Seed Categories and Logs if category table is empty
        if (threatCategoryRepository.count() == 0) {
            ThreatCategory dos = createCategory("DoS/DDoS", "서비스 거부 공격 및 분산 서비스 거부 공격 (예: Ping of Death, SYN Flooding)");
            ThreatCategory sniffing = createCategory("Sniffing", "네트워크 세그먼트의 데이터 패킷을 무단으로 가로채는 위협");
            ThreatCategory hijacking = createCategory("Session Hijacking", "활성화된 세션 ID를 탈취하여 정상 사용자로 가장하는 위협");
            ThreatCategory social = createCategory("Social Engineering", "인간의 심리를 이용해 보안 정보를 획득하는 공격 (예: Smishing, Phishing)");

            if (threatLogRepository.count() == 0) {
                createLog(dos, "Ping of Death Attack", "HIGH",
                        "ICMP Echo Request 패킷 크기를 비정상적으로 크게 설정하여 시스템을 다운시킴",
                        "192.168.1.105", "10.0.0.5", 0, "RESOLVED", 0,
                        "### 🛡️ AI 조치 가이드\n1. **방화벽 설정**: 크기가 65535 바이트를 초과하는 비정상적인 ICMP 패킷을 드롭하도록 방화벽 룰을 추가합니다.\n2. **시스템 패치**: OS 커널 및 네트워크 드라이버를 최신 상태로 업데이트하여 비정상 패킷 분할 처리에 관한 버그를 방지합니다.\n3. **모니터링**: IDS/IPS 장비에서 ICMP Flooding 패턴을 지속 감시합니다.");

                createLog(sniffing, "Wireshark Packet Sniffing", "MEDIUM",
                        "암호화되지 않은 FTP 트래픽을 가로채서 관리자 비밀번호를 획득함",
                        "192.168.1.200", "192.168.1.50", 21, "ANALYZING", 0,
                        "### 🛡️ AI 조치 가이드\n1. **암호화 전환**: FTP 프로토콜을 사용 중지하고, SSL/TLS 기반의 FTPS 또는 SSH 기반의 SFTP 프로토콜로 전환하십시오.\n2. **보안 세그먼트**: 스위치 포트 보안을 켜고 ARP Spoofing을 방지하기 위해 Dynamic ARP Inspection (DAI) 설정을 켭니다.\n3. **크레덴셜 초기화**: 노출된 FTP 관리자 비밀번호를 즉시 변경하십시오.");

                createLog(hijacking, "Cookie Poisoning Session Hijacking", "HIGH",
                        "사용자 인증 쿠키의 세션 식별자를 위조하여 타인의 계정으로 권한 없는 접속 시도",
                        "203.0.113.50", "10.0.0.10", 443, "DETECTED", 85,
                        "### 🛡️ AI 조치 가이드\n1. **세션 무효화**: 해당 세션 쿠키를 즉시 세션 서버에서 무효화(Invalidate) 처리하십시오.\n2. **보안 쿠키 옵션**: 인증 쿠키 발급 시 `HttpOnly`와 `Secure` 속성을 무조건 활성화하여 클라이언트 스크립트에서 접근할 수 없도록 강제합니다.\n3. **외부 IP 검사**: 출발지 IP(203.0.113.50)는 악성 점수 85%의 위험 IP입니다. 방화벽 단에서 즉시 차단하십시오.");

                createLog(social, "Smishing Attack impersonating Bank", "LOW",
                        "은행 사칭 문자를 발송하여 악성 앱 설치 유도",
                        "Unknown", "0.0.0.0", 0, "DETECTED", 0,
                        "### 🛡️ AI 조치 가이드\n1. **사용자 교육**: 임직원 대상으로 사칭 문자 링크 클릭 금지 및 모바일 백신 설치 의무화 캠페인을 수행하십시오.\n2. **도메인 차단**: 스미싱 문자에 기재된 악성 URL 주소를 인터넷 서비스 제공업체(KISA 등)에 신고하여 차단 요청하십시오.");
            }
        }
    }

    private ThreatCategory createCategory(String name, String description) {
        ThreatCategory cat = new ThreatCategory();
        cat.setName(name);
        cat.setDescription(description);
        return threatCategoryRepository.save(cat);
    }

    private void createLog(ThreatCategory category, String threatName, String severity,
                           String desc, String srcIp, String destIp, Integer port, String status, Integer abuseScore, String aiRec) {
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
}
