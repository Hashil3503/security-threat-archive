package com.example.security.dto;

import com.example.security.entity.ThreatCategory;
import com.example.security.entity.ThreatLog;

import java.time.LocalDateTime;

public class ThreatLogDto {
    private Long id;
    private Long categoryId;
    private String categoryName;
    private String threatName;
    private String severityLevel;
    private String description;
    private String sourceIp;
    private String destinationIp;
    private Integer port;
    private String status;
    private Integer abuseScore;
    private String aiRecommendation;
    private LocalDateTime loggedAt;

    public ThreatLogDto() {}

    public ThreatLogDto(ThreatLog log) {
        this.id = log.getId();
        if (log.getThreatCategory() != null) {
            this.categoryId = log.getThreatCategory().getId();
            this.categoryName = log.getThreatCategory().getName();
        }
        this.threatName = log.getThreatName();
        this.severityLevel = log.getSeverityLevel();
        this.description = log.getDescription();
        this.sourceIp = log.getSourceIp();
        this.destinationIp = log.getDestinationIp();
        this.port = log.getPort();
        this.status = log.getStatus();
        this.abuseScore = log.getAbuseScore();
        this.aiRecommendation = log.getAiRecommendation();
        this.loggedAt = log.getLoggedAt();
    }

    public ThreatLog toEntity() {
        ThreatLog log = new ThreatLog();
        log.setId(this.id);
        if (this.categoryId != null) {
            ThreatCategory category = new ThreatCategory();
            category.setId(this.categoryId);
            log.setThreatCategory(category);
        }
        log.setThreatName(this.threatName);
        log.setSeverityLevel(this.severityLevel);
        log.setDescription(this.description);
        log.setSourceIp(this.sourceIp);
        log.setDestinationIp(this.destinationIp);
        log.setPort(this.port);
        log.setStatus(this.status);
        log.setAbuseScore(this.abuseScore);
        log.setAiRecommendation(this.aiRecommendation);
        log.setLoggedAt(this.loggedAt);
        return log;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
    public String getThreatName() { return threatName; }
    public void setThreatName(String threatName) { this.threatName = threatName; }
    public String getSeverityLevel() { return severityLevel; }
    public void setSeverityLevel(String severityLevel) { this.severityLevel = severityLevel; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSourceIp() { return sourceIp; }
    public void setSourceIp(String sourceIp) { this.sourceIp = sourceIp; }
    public String getDestinationIp() { return destinationIp; }
    public void setDestinationIp(String destinationIp) { this.destinationIp = destinationIp; }
    public Integer getPort() { return port; }
    public void setPort(Integer port) { this.port = port; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getAbuseScore() { return abuseScore; }
    public void setAbuseScore(Integer abuseScore) { this.abuseScore = abuseScore; }
    public String getAiRecommendation() { return aiRecommendation; }
    public void setAiRecommendation(String aiRecommendation) { this.aiRecommendation = aiRecommendation; }
    public LocalDateTime getLoggedAt() { return loggedAt; }
    public void setLoggedAt(LocalDateTime loggedAt) { this.loggedAt = loggedAt; }
}
