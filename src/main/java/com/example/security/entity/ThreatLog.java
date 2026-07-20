package com.example.security.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "threat_logs")
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

    public ThreatCategory getThreatCategory() {
        return threatCategory;
    }

    public void setThreatCategory(ThreatCategory threatCategory) {
        this.threatCategory = threatCategory;
    }

    public String getThreatName() {
        return threatName;
    }

    public void setThreatName(String threatName) {
        this.threatName = threatName;
    }

    public String getSeverityLevel() {
        return severityLevel;
    }

    public void setSeverityLevel(String severityLevel) {
        this.severityLevel = severityLevel;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getSourceIp() {
        return sourceIp;
    }

    public void setSourceIp(String sourceIp) {
        this.sourceIp = sourceIp;
    }

    public String getDestinationIp() {
        return destinationIp;
    }

    public void setDestinationIp(String destinationIp) {
        this.destinationIp = destinationIp;
    }

    public Integer getPort() {
        return port;
    }

    public void setPort(Integer port) {
        this.port = port;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getAbuseScore() {
        return abuseScore;
    }

    public void setAbuseScore(Integer abuseScore) {
        this.abuseScore = abuseScore;
    }

    public String getAiRecommendation() {
        return aiRecommendation;
    }

    public void setAiRecommendation(String aiRecommendation) {
        this.aiRecommendation = aiRecommendation;
    }
}