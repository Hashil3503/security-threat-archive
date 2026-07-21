# ===================================================
#   보안 위협 아카이브 (Security Threat Archive)
#   외부 로그 전송 모의 테스트 스크립트 (PowerShell 버전)
# ===================================================

$hostIp    = "127.0.0.1"
$syslogPort = 1514
$webhookUrl = "http://localhost:8082/api/ingest/webhook"
$webhookToken = "securityarchive-secret-webhook-token"
$siemBaseUrl  = "http://localhost:8082"

# ===================================================
# 가상 공격자 IP 풀 (고정)
# 특정 IP를 차단하면 해당 IP 로그가 뚝 끊기는 효과를 볼 수 있습니다.
# ===================================================
$attackerIpPool = @(
    "185.220.101.5",
    "103.21.244.0",
    "198.51.100.42",
    "203.0.113.77",
    "45.33.32.156",
    "91.108.4.10",
    "162.158.92.12",
    "27.0.236.10"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Security Threat Archive - Ingestion Tester" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "1. Syslog (UDP 1514) 단발성 테스트 전송"
Write-Host "2. Webhook (HTTP POST) 단발성 테스트 전송"
Write-Host "3. 10초 간격 무작위 로그 실시간 전송 [방화벽 차단 연동]"
Write-Host "4. 종료"
Write-Host ""

$choice = Read-Host "선택 (1-4)"

if ($choice -eq "1") {
    Write-Host ""
    $pri = 27
    $timestamp = (Get-Date).ToString("MMM dd HH:mm:ss", [System.Globalization.CultureInfo]::InvariantCulture)
    $hostname = "firewall-utm-01"
    $syslogMsg = "<$pri>$timestamp $hostname filter_drop: Action=Blocked, src=198.51.100.42 dst=192.168.1.50 port=80, Reason=SYN-Flooding-Attack-Pattern"

    Write-Host "UDP 패킷 전송 중 (Port: $syslogPort)..." -ForegroundColor Yellow
    $udpClient = New-Object System.Net.Sockets.UdpClient
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($syslogMsg)
    $udpClient.Connect($hostIp, $syslogPort)
    $null = $udpClient.Send($bytes, $bytes.Length)
    $udpClient.Close()
    Write-Host "성공: Syslog UDP 패킷이 전송되었습니다!" -ForegroundColor Green
}
elseif ($choice -eq "2") {
    Write-Host ""
    $payload = @{
        categoryName  = "Web Exploit"
        threatName    = "SQL Injection via Webhook"
        severityLevel = "HIGH"
        description   = "WAF detected malicious SQL syntax (UNION SELECT) in HTTP GET parameter."
        sourceIp      = "203.0.113.195"
        destinationIp = "192.168.10.15"
        port          = 443
        status        = "DETECTED"
    } | ConvertTo-Json

    $headers = @{ "X-Webhook-Token" = $webhookToken; "Content-Type" = "application/json" }
    try {
        $response = Invoke-RestMethod -Uri $webhookUrl -Method Post -Headers $headers -Body $payload
        Write-Host "성공: Webhook이 접수되었습니다! (응답: $response)" -ForegroundColor Green
    }
    catch {
        Write-Host "실패: $_" -ForegroundColor Red
    }
}
elseif ($choice -eq "3") {
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "  연속 로그 전송 시작 (Ctrl+C로 종료)" -ForegroundColor Yellow
    Write-Host "  [방화벽 차단 연동 - 10초마다 차단 목록 갱신]" -ForegroundColor Yellow
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""

    # 파이썬 스크립트와 동일한 4개 카테고리 (각 2개씩 총 8개 예시)
    $templates = @(
        # 1. DoS/DDoS (2개)
        @{ cat="DoS/DDoS";          name="UDP Flooding Attack";    sev="HIGH";   syslog="filter_drop: Action=Blocked, src={0} dst=192.168.1.50 port={1}, Reason=UDP-Flood" },
        @{ cat="DoS/DDoS";          name="SYN Flooding Attack";    sev="HIGH";   syslog="filter_drop: Action=Blocked, src={0} dst=192.168.1.50 port={1}, Reason=SYN-Flood-Threshold-Exceeded" },

        # 2. Sniffing (2개)
        @{ cat="Sniffing";           name="ARP Spoofing Detected";  sev="MEDIUM"; syslog="arp_daemon: Alert=Spoofing, src={0} mac=00:11:22:AA:BB:CC, Reason=ARP-Poisoning" },
        @{ cat="Sniffing";           name="Promiscuous Mode Alert"; sev="LOW";    syslog="net_monitor: Alert=Promiscuous, src={0} interface=eth0, Reason=Unauthorized-Packet-Capture" },

        # 3. Session Hijacking (2개)
        @{ cat="Session Hijacking";  name="Session Hijack Attempt"; sev="HIGH";   syslog="auth_gateway: Session=Hijack, src={0} cookie=admin_token, Reason=Session-Hijacking-Attempt" },
        @{ cat="Session Hijacking";  name="Cookie Reuse Anomaly";   sev="MEDIUM"; syslog="web_auth: Alert=CookieReuse, src={0} user=admin, Reason=Duplicate-Session-Token" },

        # 4. Social Engineering (2개)
        @{ cat="Social Engineering"; name="Phishing Link Clicked";  sev="LOW";    syslog="mail_shield: Alert=Malicious-Link, src={0} clicker=user1@test.com, Reason=Phishing-Link" },
        @{ cat="Social Engineering"; name="Credential Harvesting";  sev="MEDIUM"; syslog="mail_shield: Alert=Spoofed-Domain, src={0} target=ceo@test.com, Reason=Fake-Login-Page" }
    )

    $blockedIps       = @()
    $lastCheckTime    = 0
    $blockCheckInterval = 10

    $ports = @(21, 22, 80, 443, 3306, 8080)

    while ($true) {
        $now = [int][double]::Parse((Get-Date -UFormat %s))

        # 10초마다 SIEM에서 차단 IP 목록 갱신
        if (($now - $lastCheckTime) -ge $blockCheckInterval) {
            $prev = $blockedIps
            try {
                $headers = @{ "X-Webhook-Token" = $webhookToken }
                $result  = Invoke-RestMethod -Uri "$siemBaseUrl/api/ingest/firewall-policy" -Method Get -Headers $headers -TimeoutSec 3
                $blockedIps = $result
            }
            catch {
                Write-Host "  [방화벽] 차단 목록 조회 실패: $_" -ForegroundColor DarkRed
            }
            $lastCheckTime = $now

            # 새로 차단된 IP 출력
            foreach ($ip in $blockedIps) {
                if ($prev -notcontains $ip) {
                    Write-Host "  [방화벽 차단 적용] $ip - 로그 전송 중단" -ForegroundColor Red
                }
            }
            # 해제된 IP 출력
            foreach ($ip in $prev) {
                if ($blockedIps -notcontains $ip) {
                    Write-Host "  [방화벽 차단 해제] $ip - 로그 전송 재개" -ForegroundColor Green
                }
            }
        }

        $temp     = $templates | Get-Random
        $srcIp    = $attackerIpPool | Get-Random
        $randPort = $ports | Get-Random

        # 차단된 IP면 전송 자체를 건너뜀
        if ($blockedIps -contains $srcIp) {
            Write-Host "  [방화벽 드랍] $srcIp 차단됨 - 전송 생략" -ForegroundColor DarkRed
            Start-Sleep -Seconds 10
            continue
        }

        $method = Get-Random -Min 1 -Max 3

        if ($method -eq 1) {
            # Syslog (UDP)
            $pri       = Get-Random -Min 16 -Max 40
            $timestamp = (Get-Date).ToString("MMM dd HH:mm:ss", [System.Globalization.CultureInfo]::InvariantCulture)
            $hostname  = "edge-router-0" + (Get-Random -Min 1 -Max 5)
            $formattedMsg = $temp.syslog -f $srcIp, $randPort
            $syslogMsg    = "<$pri>$timestamp $hostname $formattedMsg"

            $udpClient = New-Object System.Net.Sockets.UdpClient
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($syslogMsg)
            $udpClient.Connect($hostIp, $syslogPort)
            $null = $udpClient.Send($bytes, $bytes.Length)
            $udpClient.Close()
            Write-Host "[Syslog] [$($temp.cat)] $($temp.name) (IP: $srcIp:$randPort)" -ForegroundColor Green
        }
        else {
            # Webhook (HTTP)
            $payload = @{
                categoryName  = $temp.cat
                threatName    = $temp.name + " (Webhook)"
                severityLevel = $temp.sev
                description   = $temp.syslog -f $srcIp, $randPort
                sourceIp      = $srcIp
                destinationIp = "192.168.1.1"
                port          = $randPort
                status        = "DETECTED"
            } | ConvertTo-Json

            $headers = @{ "X-Webhook-Token" = $webhookToken; "Content-Type" = "application/json" }
            try {
                $null = Invoke-RestMethod -Uri $webhookUrl -Method Post -Headers $headers -Body $payload
                Write-Host "[Webhook] [$($temp.cat)] $($temp.name) (IP: $srcIp:$randPort)" -ForegroundColor DarkGreen
            }
            catch {
                Write-Host "[Webhook 에러] $_" -ForegroundColor Red
            }
        }

        Start-Sleep -Seconds 10
    }
}
else {
    Write-Host "종료합니다."
}