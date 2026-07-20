package com.example.security.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class GeminiAnalysisService {

    @Value("${gemini.api.key:}")
    private String apiKey;

    /**
     * 위협 이름, 카테고리 정보, 설명글을 기반으로 AI 대응 조치 권고사항을 생성합니다.
     */
    public String generatePlaybook(String threatName, String categoryName, String description) {
        if (threatName == null || threatName.trim().isEmpty()) {
            return "### 🛡️ 조치 가이드\n정보 부족으로 구체적인 분석 가이드를 생성할 수 없습니다. 위협 명칭을 입력해 주세요.";
        }

        // API Key가 없거나 빈 값이면 로컬 규칙 기반 자가치유 가이드 생성
        if (apiKey == null || apiKey.trim().isEmpty()) {
            return generateLocalRulePlaybook(threatName, categoryName, description);
        }

        try {
            // 실제 외부 LLM API(Gemini API 등)를 호출하는 영역
            return callGeminiApi(threatName, categoryName, description);
        } catch (Exception e) {
            System.err.println("Gemini API 호출 중 에러 발생, Local Fallback으로 대체합니다: " + e.getMessage());
            return generateLocalRulePlaybook(threatName, categoryName, description);
        }
    }

    @SuppressWarnings("unchecked")
    private String callGeminiApi(String threatName, String categoryName, String description) {
        org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);

        // API Request Body 조립
        java.util.Map<String, Object> textPart = new java.util.HashMap<>();
        textPart.put("text", String.format(
            "보안 위협 대응 가이드를 작성해주세요. 위협 명칭: %s, 분류: %s, 설명: %s. " +
            "보안 엔지니어가 침해 사고 대응을 위해 즉시 취해야 할 행동 수칙(Mitigation Playbook)을 구체적인 기술 단계(방화벽 차단 정책, 시스템 패치, 모니터링 등)를 포함하여 한국어로 가독성 있게 마크다운 형식으로 작성해주세요.",
            threatName, categoryName != null ? categoryName : "미지정", description != null ? description : ""
        ));

        java.util.Map<String, Object> partsMap = new java.util.HashMap<>();
        partsMap.put("parts", java.util.Collections.singletonList(textPart));

        java.util.Map<String, Object> contentsMap = new java.util.HashMap<>();
        contentsMap.put("contents", java.util.Collections.singletonList(partsMap));

        org.springframework.http.HttpEntity<java.util.Map<String, Object>> entity = new org.springframework.http.HttpEntity<>(contentsMap, headers);

        // Google Gemini 1.5 Flash 모델 엔드포인트 URL (Stable v1)
        String url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + apiKey;

        try {
            org.springframework.http.ResponseEntity<java.util.Map> response = restTemplate.postForEntity(
                url,
                entity,
                java.util.Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                java.util.Map<String, Object> body = response.getBody();
                java.util.List<java.util.Map<String, Object>> candidates = (java.util.List<java.util.Map<String, Object>>) body.get("candidates");
                if (candidates != null && !candidates.isEmpty()) {
                    java.util.Map<String, Object> content = (java.util.Map<String, Object>) candidates.get(0).get("content");
                    if (content != null) {
                        java.util.List<java.util.Map<String, Object>> parts = (java.util.List<java.util.Map<String, Object>>) content.get("parts");
                        if (parts != null && !parts.isEmpty()) {
                            return (String) parts.get(0).get("text");
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Gemini API 호출 실패: " + e.getMessage());
            throw e;
        }
        return "### 🛡️ 조치 가이드\nAPI 응답 파싱 실패로 조치 권고사항을 임시 로컬 룰로 생성합니다.";
    }

    /**
     * 로컬 키워드 매칭 기반 고품질 대응 조치 플레이북 생성기 (Self-Healing)
     */
    private String generateLocalRulePlaybook(String threatName, String categoryName, String description) {
        String lowerThreat = threatName.toLowerCase();
        String lowerCategory = categoryName != null ? categoryName.toLowerCase() : "";

        StringBuilder sb = new StringBuilder();
        sb.append("### 🛡️ AI 조치 권고사항 (Mitigation Playbook)\n\n");

        if (lowerThreat.contains("ping of death") || lowerCategory.contains("dos") || lowerCategory.contains("ddos")) {
            sb.append("#### 1. 트래픽 차단 및 드롭 설정\n")
              .append("- 방화벽 및 침입방지시스템(IPS)에서 최대 허용 ICMP 패킷 크기를 초과하는 비정상 패킷을 즉시 차단(Drop) 처리하십시오.\n")
              .append("- 대량의 SYN 패킷 유입 대비를 위해 외부 방화벽에서 **SYN Cookie** 메커니즘을 활성화하십시오.\n\n")
              .append("#### 2. 시스템 패치 상태 확인\n")
              .append("- 운영체제(Linux/Windows) 커널 및 네트워크 어댑터 드라이버를 최신 보안 패치 버전으로 업데이트하여 단편화(Fragmentation) 재조립 취약점을 제거하십시오.\n\n")
              .append("#### 3. 모니터링 강화\n")
              .append("- 네트워크 트래픽 분석 도구를 활용하여 비정상 분할(IP Fragment) 발생 건수 추이를 모니터링하십시오.");
        } else if (lowerThreat.contains("sniffing") || lowerThreat.contains("wireshark") || lowerCategory.contains("sniffing")) {
            sb.append("#### 1. 네트워크 통신 암호화 적용\n")
              .append("- 텍스트 기반 비암호화 프로토콜(HTTP, FTP, Telnet 등)을 보안 강화된 프로토콜(HTTPS, SFTP, SSH)로 강제 전환하십시오.\n")
              .append("- 웹 애플리케이션 및 내부 통신망 전체에 SSL/TLS 암호화를 강화하십시오.\n\n")
              .append("#### 2. 스위칭 환경 보안 강화\n")
              .append("- 스위치 장비의 **Dynamic ARP Inspection (DAI)** 및 **DHCP Snooping**을 활성화하여 공격자의 ARP 스푸핑 시도를 원천 차단하십시오.\n\n")
              .append("#### 3. 노출된 크레덴셜 즉시 초기화\n")
              .append("- 스니핑 취약 구간을 경유한 계정 정보 및 암호는 침해 위험이 크므로 전원 즉시 암호를 변경하고 MFA(다요소 인증)를 강제 설정하십시오.");
        } else if (lowerThreat.contains("session") || lowerThreat.contains("cookie") || lowerCategory.contains("session")) {
            sb.append("#### 1. 세션 만료 및 재생성\n")
              .append("- 탈취 위험에 대비하여 즉시 메모리 DB(Redis 등) 또는 애플리케이션 단에서 해당 세션 식별자를 강제 세션 아웃(Invalidate) 시키십시오.\n")
              .append("- 로그인 상태 변경이나 주요 거래(비밀번호 변경 등) 시 기존 세션을 폐기하고 신규 세션 ID를 재생성하도록 변경하십시오.\n\n")
              .append("#### 2. 쿠키 보안 플래그 강화\n")
              .append("- 사용자 인증을 담당하는 모든 쿠키에 `HttpOnly`(클라이언트 스크립트 접근 방지) 및 `Secure`(HTTPS 전송 강제) 옵션을 설정하십시오.\n\n")
              .append("#### 3. 디바이스 핑거프린트 바인딩\n")
              .append("- 세션 검증 시 브라우저 User-Agent 및 최초 접속 IP 대역을 함께 매핑하여, 세션 ID가 복사되더라도 타 단말에서 접근을 불허하도록 하십시오.");
        } else if (lowerThreat.contains("smishing") || lowerThreat.contains("phishing") || lowerCategory.contains("social")) {
            sb.append("#### 1. 악성 URL 신고 및 도메인 차단\n")
              .append("- 문자 메시지 내 사칭 유도 링크 도메인을 보호나라(KISA) 또는 통신사에 즉시 신고하여 악성 사이트 접속을 긴급 차단하십시오.\n\n")
              .append("#### 2. 엔드포인트 모바일 기기 백신 점검\n")
              .append("- 공격에 노출된 임직원 또는 사용자의 스마트폰 내 사설 스토어 APK 임의 설치 차단 옵션을 확인하고 신뢰할 수 있는 모바일 백신으로 정밀 검사를 수행하게 유도하십시오.\n\n")
              .append("#### 3. 모의 사회공학 훈련 교육\n")
              .append("- 전 사원을 대상으로 출처를 알 수 없는 문자, 이메일 내 첨부파일 및 링크 실행을 전면 제한하는 보안 훈련 강도를 확대하십시오.");
        } else {
            sb.append("#### 1. 위협 인벤토리 상세 분석\n")
              .append("- ").append(threatName).append(" 에 대하여 시스템 자원 및 포트 침입 로그 정보를 수집하여 특이 동향을 면밀히 감시하십시오.\n\n")
              .append("#### 2. 네트워크 세그멘테이션 격리\n")
              .append("- 위협이 발생한 목적지 호스트를 내부 중요 자산 네트워크 대역과 물리/논리적으로 분리하고 인바운드 방화벽 정책을 초기화하십시오.\n\n")
              .append("#### 3. 시스템 무결성 점검\n")
              .append("- 주요 로그 수집 에이전트 및 OS 패키지의 체크섬을 확인하여 임의 변경 여부를 판단하십시오.");
        }

        return sb.toString();
    }
}
