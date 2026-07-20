package com.example.security.service;

import com.example.security.entity.ThreatCategory;
import com.example.security.entity.ThreatLog;
import com.example.security.repository.ThreatCategoryRepository;
import com.example.security.repository.ThreatLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class ThreatLogService extends AbstractCrudService<ThreatLog, Long> {

    private final ThreatLogRepository threatLogRepository;
    private final ThreatCategoryRepository threatCategoryRepository;
    private final SseService sseService;
    private final ThreatIntelligenceService threatIntelligenceService;
    private final GeminiAnalysisService geminiAnalysisService;

    public ThreatLogService(ThreatLogRepository threatLogRepository, 
                            ThreatCategoryRepository threatCategoryRepository,
                            SseService sseService,
                            ThreatIntelligenceService threatIntelligenceService,
                            GeminiAnalysisService geminiAnalysisService) {
        super(threatLogRepository);
        this.threatLogRepository = threatLogRepository;
        this.threatCategoryRepository = threatCategoryRepository;
        this.sseService = sseService;
        this.threatIntelligenceService = threatIntelligenceService;
        this.geminiAnalysisService = geminiAnalysisService;
    }

    /**
     * N+1 문제를 방지하기 위해 Fetch Join을 사용하도록 findAll() 메서드를 오버라이딩합니다.
     */
    @Override
    public List<ThreatLog> findAll() {
        return threatLogRepository.findAllWithCategory();
    }

    @Override
    @Transactional
    public ThreatLog update(Long id, ThreatLog entity) {
        ThreatLog log = findById(id);
        
        if (entity.getThreatCategory() != null && entity.getThreatCategory().getId() != null) {
            ThreatCategory category = threatCategoryRepository.findById(entity.getThreatCategory().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + entity.getThreatCategory().getId()));
            log.setThreatCategory(category);
        }
        
        log.setThreatName(entity.getThreatName());
        log.setSeverityLevel(entity.getSeverityLevel());
        log.setDescription(entity.getDescription());
        log.setSourceIp(entity.getSourceIp());
        log.setDestinationIp(entity.getDestinationIp());
        log.setPort(entity.getPort());
        log.setStatus(entity.getStatus());
        
        // IP 위험도 평가 및 AI 가이드라인 재생성
        int abuseScore = threatIntelligenceService.getAbuseScore(log.getSourceIp());
        log.setAbuseScore(abuseScore);
        
        String categoryName = log.getThreatCategory() != null ? log.getThreatCategory().getName() : "";
        String playbook = geminiAnalysisService.generatePlaybook(log.getThreatName(), categoryName, log.getDescription());
        log.setAiRecommendation(playbook);
        
        // 실시간 업데이트 이벤트 브로드캐스트
        sseService.broadcast(new com.example.security.dto.ThreatLogDto(log));
        
        return log;
    }

    @Override
    @Transactional
    public ThreatLog save(ThreatLog entity) {
        if (entity.getThreatCategory() != null && entity.getThreatCategory().getId() != null) {
            ThreatCategory category = threatCategoryRepository.findById(entity.getThreatCategory().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + entity.getThreatCategory().getId()));
            entity.setThreatCategory(category);
        } else {
            throw new IllegalArgumentException("Threat Category is required.");
        }
        
        // IP 위험도 평가 및 AI 가이드라인 생성
        int abuseScore = threatIntelligenceService.getAbuseScore(entity.getSourceIp());
        entity.setAbuseScore(abuseScore);
        
        String categoryName = entity.getThreatCategory() != null ? entity.getThreatCategory().getName() : "";
        String playbook = geminiAnalysisService.generatePlaybook(entity.getThreatName(), categoryName, entity.getDescription());
        entity.setAiRecommendation(playbook);
        
        ThreatLog saved = super.save(entity);
        
        // 실시간 탐지 이벤트 브로드캐스트
        sseService.broadcast(new com.example.security.dto.ThreatLogDto(saved));
        
        return saved;
    }

    @Override
    @Transactional
    public void deleteById(Long id) {
        ThreatLog log = findById(id);
        com.example.security.dto.ThreatLogDto dto = new com.example.security.dto.ThreatLogDto(log);
        
        super.deleteById(id);
        
        // 실시간 삭제 이벤트 브로드캐스트
        sseService.broadcastDelete(dto);
    }
}
