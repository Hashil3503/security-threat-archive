package com.example.security.entity;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import jakarta.persistence.*;

@Entity
@Table(name = "threat_logs")
@Getter
@Setter
@ToString
public class ThreatLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ThreatCategory threatCategory;

    @Column(name = "threat_name", nullable = false, length = 100)
    private String threatName;

    @Column(name = "severity_level", nullable = false, length = 20)
    private String severityLevel;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "source_ip", length = 45)
    private String sourceIp;

    @Column(name = "destination_ip", length = 45)
    private String destinationIp;

    @Column(name = "port")
    private Integer port;

    @Column(name = "status", length = 20)
    private String status = "DETECTED";

    @Column(name = "abuse_score")
    private Integer abuseScore = 0;

    @Column(name = "ai_recommendation", columnDefinition = "TEXT")
    private String aiRecommendation;
}