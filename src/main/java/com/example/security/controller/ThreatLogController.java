package com.example.security.controller;

import com.example.security.dto.ThreatLogDto;
import com.example.security.entity.ThreatLog;
import com.example.security.service.ThreatLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/logs")
public class ThreatLogController {

    private final ThreatLogService logService;

    public ThreatLogController(ThreatLogService logService) {
        this.logService = logService;
    }

    @GetMapping
    public ResponseEntity<List<ThreatLogDto>> getAllLogs() {
        List<ThreatLogDto> list = logService.findAll().stream()
                .map(ThreatLogDto::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ThreatLogDto> getLogById(@PathVariable("id") Long id) {
        ThreatLog log = logService.findById(id);
        return ResponseEntity.ok(new ThreatLogDto(log));
    }

    @PostMapping
    public ResponseEntity<ThreatLogDto> createLog(@RequestBody ThreatLogDto dto) {
        ThreatLog saved = logService.save(dto.toEntity());
        return ResponseEntity.ok(new ThreatLogDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ThreatLogDto> updateLog(@PathVariable("id") Long id, @RequestBody ThreatLogDto dto) {
        ThreatLog updated = logService.update(id, dto.toEntity());
        return ResponseEntity.ok(new ThreatLogDto(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLog(@PathVariable("id") Long id) {
        logService.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reset")
    public ResponseEntity<Void> resetLogs() {
        logService.resetToDefaultLogs();
        return ResponseEntity.ok().build();
    }
}
