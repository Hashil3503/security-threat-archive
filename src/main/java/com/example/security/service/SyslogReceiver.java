package com.example.security.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;

@Component
public class SyslogReceiver implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(SyslogReceiver.class);

    private final ThreatLogService threatLogService;
    
    @Value("${syslog.port:1514}")
    private int port;
    
    @Value("${syslog.enabled:true}")
    private boolean enabled;

    private DatagramSocket socket;
    private Thread receiverThread;
    private volatile boolean running = false;

    public SyslogReceiver(ThreatLogService threatLogService) {
        this.threatLogService = threatLogService;
    }

    @Override
    public void start() {
        if (!enabled) {
            log.info("Syslog UDP receiver is disabled via configuration.");
            return;
        }
        
        try {
            this.socket = new DatagramSocket(port);
            this.running = true;
            this.receiverThread = new Thread(this::listen, "syslog-receiver-thread");
            this.receiverThread.start();
            log.info("Syslog UDP receiver started successfully on port {}", port);
        } catch (SocketException e) {
            log.error("Failed to start Syslog receiver on port {}: {}", port, e.getMessage());
        }
    }

    private void listen() {
        byte[] buffer = new byte[65535];
        while (running) {
            try {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                socket.receive(packet);
                
                String rawMsg = new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8);
                String senderIp = packet.getAddress().getHostAddress();
                
                // 비동기로 수집된 Syslog 패킷 분석/처리 호출
                threatLogService.processSyslogAsync(rawMsg, senderIp);
                
            } catch (Exception e) {
                if (!running) {
                    break;
                }
                log.error("Error receiving Syslog packet: {}", e.getMessage());
            }
        }
    }

    @Override
    public void stop() {
        log.info("Stopping Syslog UDP receiver...");
        this.running = false;
        if (socket != null && !socket.isClosed()) {
            socket.close();
        }
        if (receiverThread != null) {
            receiverThread.interrupt();
        }
    }

    @Override
    public boolean isRunning() {
        return this.running;
    }
}
