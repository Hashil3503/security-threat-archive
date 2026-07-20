# 📝 1단계: 데이터베이스 및 데이터 모델 고도화 설계서

본 문서는 **1단계: 데이터베이스 및 데이터 모델 고도화** 진행을 위한 상세 설계 및 코드 변경 계획서입니다. 실제 소스 코드 적용에 앞서 테이블 변경 사항과 Java 백엔드 및 UI 변경 지점을 사전에 정의합니다.

---

## 🗄️ 1. 데이터베이스 스키마 설계 변경 (DB Schema)

기존 `threat_logs` 테이블에 네트워크 침해 사고 분석을 위한 **핵심 메타데이터(IP, Port, Status)** 컬럼을 추가합니다.

### 1) 추가할 컬럼 정의
* **`source_ip`**: 공격이 유입된 출발지 IP 주소. IPv6 주소 길이(최대 39자) 및 터널링 표현을 감안하여 `VARCHAR(45)`로 설계합니다.
* **`destination_ip`**: 타겟 시스템 또는 피해지 IP 주소. 마찬가지로 `VARCHAR(45)`로 설계합니다.
* **`port`**: 공격이 유입되었거나 대상이 된 네트워크 포트 번호. `0` ~ `65535` 범위이므로 `INT` 타입으로 지정합니다.
* **`status`**: 현재 침해 사고의 분석 및 처리 상태. `VARCHAR(20)` 타입으로 지정하고 기본값은 `DETECTED`로 설정합니다.
  * *허용 상태*: `DETECTED` (탐지), `ANALYZING` (분석 중), `RESOLVED` (조치 완료), `FALSE_POSITIVE` (오탐)

### 2) DDL 변경 계획 (`schema.sql`)
```sql
-- 기존 threat_logs 테이블 생성 DDL에 아래 컬럼 추가
CREATE TABLE threat_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT NOT NULL,
    threat_name VARCHAR(100) NOT NULL,
    severity_level VARCHAR(20) NOT NULL,
    description TEXT,
    source_ip VARCHAR(45),       -- 신규: 출발지 IP
    destination_ip VARCHAR(45),  -- 신규: 목적지 IP
    port INT,                    -- 신규: 포트 번호
    status VARCHAR(20) DEFAULT 'DETECTED', -- 신규: 처리 상태
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_threat_logs_category FOREIGN KEY (category_id) REFERENCES threat_categories(id) ON DELETE CASCADE
);
```

### 3) 기초 데이터 변경 계획 (`data.sql`)
새로 정의된 컬럼의 데이터를 포함하도록 기초 INSERT 쿼리를 업데이트합니다.
```sql
INSERT INTO threat_logs (category_id, threat_name, severity_level, description, source_ip, destination_ip, port, status) VALUES
(1, 'Ping of Death Attack', 'HIGH', 'ICMP Echo Request 패킷 크기를 비정상적으로 크게 설정하여 시스템을 다운시킴', '192.168.1.105', '10.0.0.5', 0, 'RESOLVED'),
(2, 'Wireshark Packet Sniffing', 'MEDIUM', '암호화되지 않은 FTP 트래픽을 가로채서 관리자 비밀번호를 획득함', '192.168.1.200', '192.168.1.50', 21, 'ANALYZING'),
(3, 'Cookie Poisoning Session Hijacking', 'HIGH', '사용자 인증 쿠키의 세션 식별자를 위조하여 타인의 계정으로 권한 없는 접속 시도', '203.0.113.50', '10.0.0.10', 443, 'DETECTED'),
(4, 'Smishing Attack impersonating Bank', 'LOW', '은행 사칭 문자를 발송하여 악성 앱 설치 유도', 'Unknown', '0.0.0.0', 0, 'DETECTED');
```

---

## ☕ 2. Java 백엔드 코드 변경 계획 (Java Starter Setup)

### 1) Entity 클래스 변경 (`ThreatLog.java`)
데이터베이스 컬럼 추가에 맞춰 JPA 매핑 필드를 추가합니다.

```java
// ThreatLog.java에 추가할 필드 및 Getter/Setter
@Column(name = "source_ip", length = 45)
private String sourceIp;

@Column(name = "destination_ip", length = 45)
private String destinationIp;

@Column(name = "port")
private Integer port;

@Column(name = "status", length = 20)
private String status = "DETECTED";

// 각 필드에 대한 Getter / Setter 구현 추가
```

### 2) DTO 클래스 변경 (`ThreatLogDto.java`)
프론트엔드 통신 데이터 구조인 DTO와 Entity 간의 변환 로직에 필드를 연결합니다.

```java
// ThreatLogDto.java에 추가할 필드
private String sourceIp;
private String destinationIp;
private Integer port;
private String status;

// ThreatLogDto(ThreatLog log) 생성자 매핑 추가
this.sourceIp = log.getSourceIp();
this.destinationIp = log.getDestinationIp();
this.port = log.getPort();
this.status = log.getStatus();

// toEntity() 변환 메서드 매핑 추가
log.setSourceIp(this.sourceIp);
log.setDestinationIp(this.destinationIp);
log.setPort(this.port);
log.setStatus(this.status);
```

### 3) Service 클래스 변경 (`ThreatLogService.java`)
기존 `update(Long id, ThreatLog entity)` 메서드에서 신규 필드들도 갱신되도록 보완합니다.

```java
// ThreatLogService.java - update 메서드 수정
log.setSourceIp(entity.getSourceIp());
log.setDestinationIp(entity.getDestinationIp());
log.setPort(entity.getPort());
log.setStatus(entity.getStatus());
```

---

## 🖥️ 3. 프론트엔드 UI/UX 변경 계획 (Frontend Integrations)

### 1) 등록 및 수정 폼 구조 보완 (`index.html`)
등록 폼과 수정 모달창 내에 신규 필드(출발지 IP, 목적지 IP, 포트, 상태) 입력을 지원하는 HTML 요소를 추가합니다.

* **등록 폼 (`#threat-form`) 영역 추가**:
  * 출발지 IP, 목적지 IP, 포트 번호를 가로 배치(Grid 구성)할 수 있도록 HTML 구조 개선.
* **수정 폼 (`#edit-form`) 영역 추가**:
  * 기존 폼 아래에 IP, 포트, 그리고 처리 상태(`status`)를 조작할 수 있는 Dropdown 메뉴 배치.
    * `status` 옵션: 탐지(`DETECTED`), 분석중(`ANALYZING`), 조치완료(`RESOLVED`), 오탐(`FALSE_POSITIVE`)

### 2) 데이터 바인딩 및 전송 보완 (`app.js`)
* **`handleLogSubmit(event)` & `handleEditSubmit(event)`**:
  * `document.getElementById(...)` 호출을 추가하여 새 필드 값을 수집하고 Fetch API 페이로드에 포함합니다.
* **`openEditModal(id)`**:
  * 서버에서 받아온 상세 데이터의 `sourceIp`, `destinationIp`, `port`, `status` 값을 각 입력 요소에 매핑합니다.
* **`renderLogTable()`**:
  * 테이블에 신규 데이터를 효과적으로 보여주기 위해, 기존 5열 테이블에 **IP/Port 정보** 열과 **조치 상태(Status)** 열을 추가하여 총 7열로 확장하거나, 혹은 위협 명칭 하단에 메타데이터로 예쁘게 시각화합니다.
  * **상태(Status) 뱃지 스타일 정의**:
    * `DETECTED`: 보라색 (알림 강도 강)
    * `ANALYZING`: 파란색 (진행 중)
    * `RESOLVED`: 회색/초록색 (해결됨)
    * `FALSE_POSITIVE`: 연한 주황색/갈색 (오탐)

---

## 📊 4. 변경 후 위협 아카이브 UI 레이아웃 예상안

```
+------------------------------------------------------------------------------------+
|  🛡️ Security Threat Archive                       [📁 카테고리 관리]                 |
+------------------------------------------------------------------------------------+
|  전체 위협 로그: 4  |  High: 2  |  Medium: 1  |  Low: 1                            |
+------------------------------------------------------------------------------------+
|  [📝 새 위협 기록 등록]                    | [📁 위협 아카이브 로그 목록]            |
|  * 카테고리: [선택]                       |  카테고리 | 위협명 (IP/Port) | 심각도 | 상태   |
|  * 위협명: [                        ]     |  ---------+------------------+--------+--------|
|  * 심각도: (HIGH/MEDIUM/LOW)              |  DoS/DDoS | Ping of Death    |  HIGH  |RESOLVED|
|  * IP 정보(Source):      [ 192.168.1.105 ]|           | (192.168.1.105)  |        |        |
|  * IP 정보(Dest):        [ 10.0.0.5      ]|  Sniffing | FTP Sniffing     |  MED   |ANALYZING|
|  * 포트 번호:            [ 0             ]|           | (192.168.1.200)  |        |        |
|  * 위협 상세 설명:                        |  ...      | ...              |  ...   | ...    |
|    [                            ]         |                                        |
|  [💾 위협 로그 기록]                      |                                        |
+------------------------------------------------------------------------------------+
```

> [!TIP]
> 위 레이아웃처럼 IP/Port 정보를 위협 명칭 아래 혹은 별도 열에 보기 좋게 배치하면 대시보드의 밀도와 전문성이 크게 올라갑니다.

---

### 진행 승인 요청
설계 내용이 마음에 드신다면 **'Proceed(진행)'**를 통해 알려주세요. 곧바로 DB 스크립트 수정 및 Java/JS 코드 변경을 일사천리로 구현하겠습니다!
