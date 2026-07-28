package com.example.security.entity;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "blocked_ips")
@Getter
@Setter
@ToString
public class BlockedIp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ip_address", nullable = false, unique = true)
    private String ipAddress;

    private String reason;

    @Column(name = "blocked_at", nullable = false)
    private LocalDateTime blockedAt = LocalDateTime.now();

    public BlockedIp() {
    }

    public BlockedIp(String ipAddress, String reason) {
        this.ipAddress = ipAddress;
        this.reason = reason;
        this.blockedAt = LocalDateTime.now();
    }
}
