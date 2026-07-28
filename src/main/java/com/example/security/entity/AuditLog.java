package com.example.security.entity;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@ToString
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false)
    private String username;

    private String role;

    @Column(name = "client_ip")
    private String clientIp;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    public AuditLog() {
    }

    public AuditLog(String action, String username, String role, String clientIp, String details, LocalDateTime timestamp) {
        this.action = action;
        this.username = username;
        this.role = role;
        this.clientIp = clientIp;
        this.details = details;
        this.timestamp = timestamp;
    }
}
