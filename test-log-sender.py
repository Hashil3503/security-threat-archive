# ===================================================
#   보안 위협 아카이브 (Security Threat Archive)
#   외부 로그 전송 모의 테스트 스크립트 (Python 버전)
# ===================================================

import socket
import json
import urllib.request
import datetime
import random
import time

HOST_IP = "127.0.0.1"
SYSLOG_PORT = 1514
WEBHOOK_URL = "http://localhost:8082/api/ingest/webhook"
WEBHOOK_TOKEN = "securityarchive-secret-webhook-token"
SIEM_BASE_URL = "http://localhost:8082"

# ===================================================
# 가상 공격자 IP 풀 (고정)
# 특정 IP를 차단하면 해당 IP 로그가 뚝 끊기는 효과를 볼 수 있습니다.
# ===================================================
ATTACKER_IP_POOL = [
    "185.220.101.5",
    "103.21.244.0",
    "198.51.100.42",
    "203.0.113.77",
    "45.33.32.156",
    "91.108.4.10",
    "162.158.92.12",
    "27.0.236.10",
]

print("=============================================")
print("  Security Threat Archive - Ingestion Tester")
print("=============================================")
print("1. Send Test Syslog (UDP 1514)")
print("2. Send Test Webhook (HTTP POST)")
print("3. Start Continuous Random Log Sending (Every 10s) [방화벽 차단 연동]")
print("4. Exit")
print("")

choice = input("Select (1-4): ")

if choice == "1":
    pri = 27
    timestamp = datetime.datetime.now().strftime("%b %d %H:%M:%S")
    hostname = "firewall-utm-01"
    msg = "<{0}>{1} {2} filter_drop: Action=Blocked, src=198.51.100.42 dst=192.168.1.50 port=80, Reason=SYN-Flooding-Attack-Pattern".format(pri, timestamp, hostname)
    print("Sending UDP Syslog packet to {0}:{1}...".format(HOST_IP, SYSLOG_PORT))
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.sendto(msg.encode("utf-8"), (HOST_IP, SYSLOG_PORT))
    sock.close()
    print("Syslog UDP packet sent successfully!")

elif choice == "2":
    payload = {
        "categoryName": "Web Exploit",
        "threatName": "SQL Injection via Webhook",
        "severityLevel": "HIGH",
        "description": "WAF detected malicious SQL syntax (UNION SELECT) in HTTP GET parameter.",
        "sourceIp": "203.0.113.195",
        "destinationIp": "192.168.10.15",
        "port": 443,
        "status": "DETECTED"
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(WEBHOOK_URL, data=data, method="POST")
    req.add_header("X-Webhook-Token", WEBHOOK_TOKEN)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as response:
            print("Webhook accepted! Response: " + response.read().decode("utf-8"))
    except Exception as e:
        print("Failed to send Webhook: " + str(e))

elif choice == "3":
    print("")
    print("=============================================")
    print("  연속 로그 전송 시작 (Ctrl+C로 종료)")
    print("  [방화벽 차단 연동 - 10초마다 차단 목록 갱신]")
    print("=============================================")
    print("")

    templates = [
        # 1. DoS/DDoS (2개)
        {"cat": "DoS/DDoS",          "name": "UDP Flooding Attack",    "sev": "HIGH",   "syslog": "filter_drop: Action=Blocked, src={0} dst=192.168.1.50 port={1}, Reason=UDP-Flood"},
        {"cat": "DoS/DDoS",          "name": "SYN Flooding Attack",    "sev": "HIGH",   "syslog": "filter_drop: Action=Blocked, src={0} dst=192.168.1.50 port={1}, Reason=SYN-Flood-Threshold-Exceeded"},

        # 2. Sniffing (2개)
        {"cat": "Sniffing",           "name": "ARP Spoofing Detected",  "sev": "MEDIUM", "syslog": "arp_daemon: Alert=Spoofing, src={0} mac=00:11:22:AA:BB:CC, Reason=ARP-Poisoning"},
        {"cat": "Sniffing",           "name": "Promiscuous Mode Alert", "sev": "LOW",    "syslog": "net_monitor: Alert=Promiscuous, src={0} interface=eth0, Reason=Unauthorized-Packet-Capture"},

        # 3. Session Hijacking (2개)
        {"cat": "Session Hijacking",  "name": "Session Hijack Attempt", "sev": "HIGH",   "syslog": "auth_gateway: Session=Hijack, src={0} cookie=admin_token, Reason=Session-Hijacking-Attempt"},
        {"cat": "Session Hijacking",  "name": "Cookie Reuse Anomaly",   "sev": "MEDIUM", "syslog": "web_auth: Alert=CookieReuse, src={0} user=admin, Reason=Duplicate-Session-Token"},

        # 4. Social Engineering (2개)
        {"cat": "Social Engineering", "name": "Phishing Link Clicked",  "sev": "LOW",    "syslog": "mail_shield: Alert=Malicious-Link, src={0} clicker=user1@test.com, Reason=Phishing-Link"},
        {"cat": "Social Engineering", "name": "Credential Harvesting",  "sev": "MEDIUM", "syslog": "mail_shield: Alert=Spoofed-Domain, src={0} target=ceo@test.com, Reason=Fake-Login-Page"}
    ]

    blocked_ips = set()
    last_check_time = 0
    BLOCK_CHECK_INTERVAL = 10

    def fetch_blocked_ips():
        """
        SIEM 서버에서 현재 차단된 IP 목록을 조회합니다.
        GET /api/ingest/firewall-policy (X-Webhook-Token 인증 - JWT 불필요)
        """
        try:
            req = urllib.request.Request(SIEM_BASE_URL + "/api/ingest/firewall-policy")
            req.add_header("X-Webhook-Token", WEBHOOK_TOKEN)
            with urllib.request.urlopen(req, timeout=3) as response:
                data = json.loads(response.read().decode("utf-8"))
                return set(data)
        except Exception as e:
            print("  [방화벽] 차단 목록 조회 실패: " + str(e))
            return blocked_ips

    rand_port_pool = [21, 22, 80, 443, 3306, 8080]

    while True:
        now = time.time()

        if now - last_check_time >= BLOCK_CHECK_INTERVAL:
            prev = blocked_ips.copy()
            blocked_ips = fetch_blocked_ips()
            last_check_time = now
            for ip in (blocked_ips - prev):
                print("  [방화벽 차단 적용] " + ip + " - 로그 전송 중단")
            for ip in (prev - blocked_ips):
                print("  [방화벽 차단 해제] " + ip + " - 로그 전송 재개")

        temp      = random.choice(templates)
        src_ip    = random.choice(ATTACKER_IP_POOL)
        rand_port = random.choice(rand_port_pool)

        if src_ip in blocked_ips:
            print("  [방화벽 드랍] " + src_ip + " 차단됨 - 전송 생략")
            time.sleep(10)
            continue

        method = random.randint(1, 2)

        if method == 1:
            pri = random.randint(16, 40)
            timestamp = datetime.datetime.now().strftime("%b %d %H:%M:%S")
            hostname = "edge-router-0" + str(random.randint(1, 5))
            syslog_msg = "<{0}>{1} {2} {3}".format(pri, timestamp, hostname, temp["syslog"].format(src_ip, rand_port))
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.sendto(syslog_msg.encode("utf-8"), (HOST_IP, SYSLOG_PORT))
            sock.close()
            print("[Syslog] [{0}] {1} (IP: {2}:{3})".format(temp["cat"], temp["name"], src_ip, rand_port))
        else:
            payload = {
                "categoryName":  temp["cat"],
                "threatName":    temp["name"] + " (Webhook)",
                "severityLevel": temp["sev"],
                "description":   temp["syslog"].format(src_ip, rand_port),
                "sourceIp":      src_ip,
                "destinationIp": "192.168.1.1",
                "port":          rand_port,
                "status":        "DETECTED"
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(WEBHOOK_URL, data=data, method="POST")
            req.add_header("X-Webhook-Token", WEBHOOK_TOKEN)
            req.add_header("Content-Type", "application/json")
            try:
                with urllib.request.urlopen(req) as response:
                    print("[Webhook] [{0}] {1} (IP: {2}:{3})".format(temp["cat"], temp["name"], src_ip, rand_port))
            except Exception as e:
                print("[Webhook Error] " + str(e))

        time.sleep(10)

else:
    print("Exiting.")
