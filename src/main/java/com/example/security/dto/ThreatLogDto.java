package com.example.security.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import com.example.security.entity.ThreatCategory;
import com.example.security.entity.ThreatLog;

import java.time.LocalDateTime;

@Getter
@Setter
@ToString
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
}
